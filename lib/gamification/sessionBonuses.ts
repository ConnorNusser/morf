// Surprise session bonuses — variable-reward callouts derived purely from the
// before/after snapshot diff. Every bonus is a true fact about this session;
// the "variable" part is that the user can't predict which (if any) will fire,
// which is what makes finishing a workout worth anticipating. Never invent a
// reward here: a bonus that isn't a real accomplishment reads as noise and
// devalues the ones that are.
import { formatCompact } from './careerStats';
import type { RewardSnapshot } from './sessionRewards'; // type-only: keeps the module cycle compile-time only

export interface SessionBonus {
  id: string;
  title: string;
  detail: string;
  icon: string; // Ionicons name
}

// Lifetime-volume boundary (in the user's unit). Nobody tracks their lifetime
// total, so crossing one always lands as a surprise.
const VOLUME_BOUNDARY = 250_000;
// Workout counts already celebrated by achievements — don't double-fire.
const ACHIEVEMENT_WORKOUT_TARGETS = new Set([1, 10, 50, 100, 250, 500]);
const MAX_BONUSES = 2;

export function computeSessionBonuses(before: RewardSnapshot, after: RewardSnapshot): SessionBonus[] {
  const b = before.stats;
  const a = after.stats;
  const unit = a.unit;
  const bonuses: SessionBonus[] = [];

  // Biggest single session ever (needs a prior session to compare against).
  if (b.totalWorkouts > 0 && a.biggestSessionVolume > b.biggestSessionVolume) {
    bonuses.push({
      id: 'biggest-session',
      title: 'Biggest session ever',
      detail: `${formatCompact(a.biggestSessionVolume)} ${unit} moved — your best single workout yet`,
      icon: 'flash',
    });
  }

  // Heaviest single set of their life.
  const prevHeaviest = b.heaviestSet?.weight ?? 0;
  const heaviest = a.heaviestSet;
  if (prevHeaviest > 0 && heaviest && heaviest.weight > prevHeaviest) {
    bonuses.push({
      id: 'heaviest-set',
      title: 'Heaviest set of your life',
      detail: `${Math.round(heaviest.weight)} ${unit} × ${heaviest.reps} — up from ${Math.round(prevHeaviest)}`,
      icon: 'barbell',
    });
  }

  // New all-time consecutive-day record (3+ so day two of ever doesn't fire).
  if (a.longestDayStreak > b.longestDayStreak && a.longestDayStreak >= 3) {
    bonuses.push({
      id: 'day-streak-record',
      title: 'New consistency record',
      detail: `${a.longestDayStreak} days in a row — you've never strung together more`,
      icon: 'flame',
    });
  }

  // Crossed a lifetime-volume boundary.
  if (Math.floor(a.totalVolume / VOLUME_BOUNDARY) > Math.floor(b.totalVolume / VOLUME_BOUNDARY)) {
    const boundary = Math.floor(a.totalVolume / VOLUME_BOUNDARY) * VOLUME_BOUNDARY;
    bonuses.push({
      id: 'volume-boundary',
      title: `${formatCompact(boundary)} ${unit} lifetime`,
      detail: `This session pushed your career total past ${formatCompact(boundary)}`,
      icon: 'trending-up',
    });
  }

  // Round workout counts (every 25) that no achievement already celebrates.
  if (
    a.totalWorkouts > b.totalWorkouts &&
    a.totalWorkouts % 25 === 0 &&
    !ACHIEVEMENT_WORKOUT_TARGETS.has(a.totalWorkouts)
  ) {
    bonuses.push({
      id: 'workout-count',
      title: `Workout #${a.totalWorkouts}`,
      detail: `That's ${a.totalWorkouts} sessions logged — quietly stacking up`,
      icon: 'layers',
    });
  }

  // Every 5th consecutive week is worth calling out by name.
  if (a.currentStreak > b.currentStreak && a.currentStreak >= 5 && a.currentStreak % 5 === 0) {
    bonuses.push({
      id: 'streak-week',
      title: `${a.currentStreak} straight weeks`,
      detail: 'Most people never make it past week two',
      icon: 'ribbon',
    });
  }

  return bonuses.slice(0, MAX_BONUSES);
}
