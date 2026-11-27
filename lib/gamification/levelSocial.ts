// Social side of the level system: what gets synced into users.user_data, how
// other users' synced levels are read back, and how the Level leaderboard ranks.
// Pure — no storage or network — so it's node-testable. Level itself is still
// computed locally from history (levelCurve/xp); the synced copy is display-only.

/** The level fields this module owns inside users.user_data. */
export interface SyncedLevel {
  level: number;
  totalXp: number;
}

/** user_data patch for the current level (snake_case to match the jsonb keys). */
export function levelUserDataPatch(level: SyncedLevel): { level: number; total_xp: number } {
  return { level: Math.max(1, Math.floor(level.level)), total_xp: Math.max(0, Math.floor(level.totalXp)) };
}

/**
 * Shallow-merge a patch into an existing user_data blob without clobbering keys
 * the patch doesn't mention. An explicit `undefined` in the patch deletes the key.
 */
export function mergeUserData<T extends object>(
  existing: T | null | undefined,
  patch: Partial<T>,
): T {
  const merged: Record<string, unknown> = { ...(existing ?? {}), ...patch };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete merged[k];
  }
  return merged as T;
}

/** True when every key in the patch already holds that value (skip the write). */
export function patchIsNoop(existing: object | null | undefined, patch: object): boolean {
  const current = (existing ?? {}) as Record<string, unknown>;
  return Object.entries(patch).every(([k, v]) => current[k] === v);
}

/**
 * Read a synced level back out of untyped jsonb. Null unless `level` is a
 * finite number ≥ 1; a missing/garbled total_xp falls back to 0.
 */
export function parseSyncedLevel(raw: { level?: unknown; total_xp?: unknown } | null | undefined): SyncedLevel | null {
  if (!raw) return null;
  const level = typeof raw.level === 'string' ? Number(raw.level) : raw.level;
  if (typeof level !== 'number' || !Number.isFinite(level) || level < 1) return null;
  const xpRaw = typeof raw.total_xp === 'string' ? Number(raw.total_xp) : raw.total_xp;
  const totalXp = typeof xpRaw === 'number' && Number.isFinite(xpRaw) && xpRaw > 0 ? Math.floor(xpRaw) : 0;
  return { level: Math.floor(level), totalXp };
}

export interface LevelBoardRow extends SyncedLevel {
  userId: string;
  username: string;
}

/** Level desc, then total XP desc, then username for a stable order. */
export function compareLevelRows(a: LevelBoardRow, b: LevelBoardRow): number {
  return b.level - a.level || b.totalXp - a.totalXp || a.username.localeCompare(b.username);
}

/**
 * Rank the Level board. Rows without a synced level are expected to be filtered
 * out before this (they're omitted from the board, not listed at the bottom).
 *
 * `me` is the viewer's locally computed level — the source of truth, fresher
 * than their synced copy. It replaces the viewer's row when present; with
 * `insertMe` (complete boards like Friends) it's added when absent. Top-N boards
 * never insert, since the viewer's true rank may be far below the cut.
 */
export function rankLevelBoard<T extends LevelBoardRow>(
  rows: T[],
  me?: T | null,
  opts: { insertMe?: boolean } = {},
): T[] {
  let list = rows;
  if (me) {
    const has = rows.some(r => r.userId === me.userId);
    if (has) list = rows.map(r => (r.userId === me.userId ? { ...r, level: me.level, totalXp: me.totalXp } : r));
    else if (opts.insertMe) list = [...rows, me];
  }
  return [...list].sort(compareLevelRows);
}

export interface LevelPlacement {
  /** 1-based rank, or null when below a full top-N board (rank unknown). */
  rank: number | null;
  /** XP needed to pass the row directly ahead; null at #1 or rank unknown. */
  xpToPass: number | null;
  aheadName: string | null;
}

/**
 * Where the viewer's local level sits on a ranked board (pass `ranked` from
 * rankLevelBoard). `boardLimit` is the
 * fetch cap: on a full board, landing after the last row means "somewhere below".
 */
export function levelPlacement(
  ranked: LevelBoardRow[],
  me: SyncedLevel & { userId: string },
  boardLimit?: number,
): LevelPlacement {
  // On the board already (rankLevelBoard swapped in the local level): use that
  // slot so the bar and the row always agree.
  const own = ranked.findIndex(r => r.userId === me.userId);
  const others = ranked.filter(r => r.userId !== me.userId);
  // Otherwise ties go to whoever is already on the board — passing means strictly more XP.
  let index = own >= 0
    ? own
    : others.findIndex(r => me.level > r.level || (me.level === r.level && me.totalXp > r.totalXp));
  if (index === -1) index = others.length;
  if (boardLimit != null && index >= boardLimit && others.length >= boardLimit) {
    return { rank: null, xpToPass: null, aheadName: null };
  }
  const ahead = index > 0 ? others[index - 1] : null;
  return {
    rank: index + 1,
    xpToPass: ahead ? Math.max(1, ahead.totalXp - me.totalXp + 1) : null,
    aheadName: ahead?.username ?? null,
  };
}
