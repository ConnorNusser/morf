// Presentation helpers for the account level (header pill, XP card, level-up
// banner, Career hero) plus the one-time "You're Level N" intro gate. Pure, so
// the copy and gating are unit-testable without RN.
import { LevelProgress, LevelTitle, nextLevelTitle } from './levelCurve';
import { WorkoutXp, XP_RULES, XpLedger } from './xp';

// 18240 → "18,240" without relying on Intl (Hermes builds vary).
export function formatXp(n: number): string {
  const v = Math.max(0, Math.round(n));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface LevelPillParts {
  levelLabel: string; // "Lv 23"
  title: string; // "Elite"
  toNextLabel: string; // "370 to 24"
}

export function levelPillParts(lp: LevelProgress): LevelPillParts {
  return {
    levelLabel: `Lv ${lp.level}`,
    title: lp.title,
    toNextLabel: `${formatXp(lp.xpToNext)} to ${lp.level + 1}`,
  };
}

// "50 workout · 90 sets · 40 PR · ×1.05 streak · +100 goal". Zero parts are
// dropped; the multiplier only shows when it actually boosted the session.
// `extraXp` is session XP not tied to the workout row (achievement unlocks).
export function formatXpBreakdown(w: WorkoutXp | undefined, extraXp = 0): string {
  const parts: string[] = [];
  if (w) {
    if (w.base > 0) parts.push(`${w.base} workout`);
    if (w.sets > 0) parts.push(`${w.sets} sets`);
    if (w.prs > 0) parts.push(`${w.prs} PR`);
    if (w.multiplier > 1 && w.base + w.sets + w.prs > 0) {
      parts.push(`×${trimMultiplier(w.multiplier)} streak`);
    }
    if (w.weeklyGoal > 0) parts.push(`+${w.weeklyGoal} goal`);
    if (w.tierUp > 0) parts.push(`+${w.tierUp} tier up`);
  }
  if (extraXp > 0) parts.push(`+${extraXp} achievements`);
  return parts.join(' · ');
}

function trimMultiplier(m: number): string {
  return m.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// The next rank, only when it's within `within` levels — "close enough
// to be a carrot". Null at the top or when it's still far off.
export function upcomingTitle(level: number, within = 5): LevelTitle | null {
  const next = nextLevelTitle(level);
  if (!next) return null;
  return next.minLevel - level <= within ? next : null;
}

// "Next rank at 30: Champion"
export function nextRankLine(next: LevelTitle): string {
  return `Next rank at ${next.minLevel}: ${next.title}`;
}

// How the XP bar should sweep on the completion screen. When the session
// crossed a level the bar fills to the end, wraps, then fills into the new level.
export interface XpBarSweep {
  from: number; // 0..1 starting fill
  to: number; // 0..1 final fill (within the final level)
  wraps: boolean;
}

export function xpBarSweep(before: LevelProgress, after: LevelProgress): XpBarSweep {
  const wraps = after.level > before.level;
  return {
    from: clamp01(before.progress),
    to: clamp01(after.progress),
    wraps,
  };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ---- One-time "You're Level N" intro ----
// Existing users get retroactive XP on update, so instead of a chain of
// level-up toasts they see one intro card. `lastSeenLevel` is the last level
// the user was shown (intro dismissed, or a completion screen); once any level
// has been shown the intro never fires, and later off-workout level-ups (e.g.
// from an achievement) just advance it silently.
export interface LevelIntroState {
  introSeen: boolean;
  lastSeenLevel: number | null;
}

export interface LevelIntroDecision {
  showIntro: boolean;
  markIntroSeen: boolean; // persist the flag without showing anything
  syncLastSeenLevel: number | null; // write this lastSeenLevel (null = leave it)
}

export function decideLevelIntro(state: LevelIntroState, level: LevelProgress): LevelIntroDecision {
  const advanced =
    state.lastSeenLevel === null || level.level > state.lastSeenLevel ? level.level : null;

  if (state.introSeen) {
    return { showIntro: false, markIntroSeen: false, syncLastSeenLevel: advanced };
  }
  // A level was already shown (e.g. a workout finished before Home was opened),
  // or there's nothing retroactive to introduce (brand-new user).
  if (state.lastSeenLevel !== null || level.totalXp <= 0) {
    return { showIntro: false, markIntroSeen: true, syncLastSeenLevel: advanced };
  }
  // Show; lastSeenLevel is written when the intro is dismissed.
  return { showIntro: true, markIntroSeen: false, syncLastSeenLevel: null };
}

// Typical XP the next session will earn, for the striped "ghost" segment on the
// hero's XP bar: the median of the last few sessions' streak-boosted workout XP
// (goal/tier bonuses excluded — they're not every session), rounded to 5.
// Falls back to a standard 18-set session for new users.
export const DEFAULT_SESSION_SETS = 18;

export function projectNextWorkoutXp(ledger: XpLedger, lookback = 5): number {
  const recent = ledger.workouts.filter(w => w.base > 0).slice(-lookback);
  const raw = recent.length
    ? median(recent.map(w => (w.base + w.sets + w.prs) * w.multiplier))
    : XP_RULES.workout + DEFAULT_SESSION_SETS * XP_RULES.perSet;
  return Math.max(5, Math.round(raw / 5) * 5);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
