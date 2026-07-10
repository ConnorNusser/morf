import { getBaseTier, StrengthTier, StrengthTierBase } from '@/lib/data/strengthStandards';

/**
 * Pure leaderboard analytics: 90-day movement (rank / 1RM / percentile),
 * gap-to-next, and tier-band grouping. All inputs come from Supabase rows
 * fetched by userSyncService; nothing here touches the network, so it's
 * unit-testable in the node jest environment.
 */

export interface LiftSnapshotRow {
  user_id: string;
  estimated_1rm: number;
}

export interface LiftMovement {
  /** current 1RM minus the user's best as of the cutoff; null when they had no lift then. */
  rmDelta: number | null;
  /** old rank minus current rank (positive = climbed); null when unranked at the cutoff. */
  rankDelta: number | null;
}

/** Each user's best 1RM across a set of lift rows (mirrors the user_best_lifts view). */
export function bestByUser(rows: LiftSnapshotRow[]): Record<string, number> {
  const best: Record<string, number> = {};
  for (const row of rows) {
    if (!(row.user_id in best) || row.estimated_1rm > best[row.user_id]) {
      best[row.user_id] = row.estimated_1rm;
    }
  }
  return best;
}

/** 1-based ranks with SQL rank() semantics: ties share a rank, the next rank skips. */
export function rankByValue(valueByUser: Record<string, number>): Record<string, number> {
  const sorted = Object.entries(valueByUser).sort((a, b) => b[1] - a[1]);
  const ranks: Record<string, number> = {};
  let lastValue: number | null = null;
  let lastRank = 0;
  sorted.forEach(([userId, value], index) => {
    const rank = value === lastValue ? lastRank : index + 1;
    ranks[userId] = rank;
    lastValue = value;
    lastRank = rank;
  });
  return ranks;
}

/**
 * 90-day movement per user on a lift board: current standing vs the board
 * reconstructed from lifts recorded on or before the cutoff.
 */
export function liftMovement(
  current: { userId: string; oneRm: number; rank?: number }[],
  rowsAsOfCutoff: LiftSnapshotRow[],
): Record<string, LiftMovement> {
  const oldBest = bestByUser(rowsAsOfCutoff);
  const oldRanks = rankByValue(oldBest);

  const movement: Record<string, LiftMovement> = {};
  for (const entry of current) {
    const had = entry.userId in oldBest;
    movement[entry.userId] = {
      rmDelta: had ? entry.oneRm - oldBest[entry.userId] : null,
      rankDelta:
        had && entry.rank != null ? oldRanks[entry.userId] - entry.rank : null,
    };
  }
  return movement;
}

/** Latest percentile snapshot on or before the cutoff date (YYYY-MM-DD), or null. */
export function percentileAsOf(
  history: { percentile: number; date: string }[] | null | undefined,
  cutoffDate: string,
): number | null {
  if (!history || history.length === 0) return null;
  let latest: { percentile: number; date: string } | null = null;
  for (const entry of history) {
    if (entry.date <= cutoffDate && (!latest || entry.date > latest.date)) {
      latest = entry;
    }
  }
  return latest ? latest.percentile : null;
}

/** Value gap to the entry directly above (null for #1 or an out-of-range index). */
export function gapToAhead<T>(
  sortedDesc: T[],
  index: number,
  valueOf: (entry: T) => number,
): number | null {
  if (index <= 0 || index >= sortedDesc.length) return null;
  return valueOf(sortedDesc[index - 1]) - valueOf(sortedDesc[index]);
}

export interface TierBand<T> {
  /** Base tier of the band, or null for entries with no tier. */
  tier: StrengthTierBase | null;
  entries: T[];
  /** Index of the band's first entry in the original list (drives rank display). */
  startIndex: number;
}

/**
 * Splits a sorted-by-value leaderboard into consecutive base-tier bands
 * (S, A, B…). Runs are grouped as they appear, so an out-of-order anomaly
 * in the data produces an extra band rather than a wrong sort.
 */
export function groupByTierBand<T>(
  entries: T[],
  tierOf: (entry: T) => StrengthTier | null | undefined,
): TierBand<T>[] {
  const bands: TierBand<T>[] = [];
  entries.forEach((entry, index) => {
    const tier = tierOf(entry);
    const base = tier ? getBaseTier(tier) : null;
    const last = bands[bands.length - 1];
    if (last && last.tier === base) {
      last.entries.push(entry);
    } else {
      bands.push({ tier: base, entries: [entry], startIndex: index });
    }
  });
  return bands;
}

/** ISO date (YYYY-MM-DD) `days` days before `now` — cutoff key for history lookups. */
export function cutoffDateISO(now: Date, days: number): string {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().split('T')[0];
}
