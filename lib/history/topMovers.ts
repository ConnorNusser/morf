import { ExerciseWithMax, WeightUnit } from '@/types';
import { computeExerciseTrend } from '@/lib/history/exerciseTrend';

// Pure (no React / react-native) so the Workouts-hub "movers" selection is unit-testable
// and shares ONE definition of per-lift progress with the Exercises tab. This answers the
// Workouts hub's missing question — "how is THIS lift progressing?" — at a glance, without
// a tab hop, and does it honestly: every value here is a single lift's est-1RM (or rep
// count), and every delta is signed over the SAME window the sparkline draws, so a stalling
// or deloading lift shows red. There is deliberately no summed-lbs aggregate (that would be
// monotonic and always-green); the portfolio-level answer stays the hero's percentile.

export interface Mover {
  id: string;
  name: string;
  isCustom: boolean;
  /** Calisthenics lift scored on reps (no meaningful 1RM). */
  isBodyweight: boolean;
  /** Headline value: est-1RM (weighted) or best reps (bodyweight), display unit. */
  value: number;
  /** Signed change across the rendered sparkline window (display unit). CAN be negative. */
  delta: number;
  /** Up-to-6 recent day-bucket bests, oldest->newest — the same series the pill measures. */
  sparkline: number[];
  /** The source row, forwarded straight to ExerciseHistoryModal on tap. */
  exercise: ExerciseWithMax;
}

export interface TopMoversOptions {
  /** Max rows to render — kept small to stay a hero-adjacent teaser, not a second list. */
  limit?: number;
  /** Only lifts trained within this many days count as "movers" (current focus, not stale). */
  recentDays?: number;
  /** Clock injection for deterministic tests. */
  now?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rank the lifter's recently-trained lifts by how much they are moving right now.
 *
 * Selection favours the strongest gainers (celebrate) but reserves the final slot for the
 * single worst decliner (flag what needs attention), then tops up with the next-largest
 * movers if either side is short. A lift needs at least two logged day-buckets (a real
 * trajectory) and a non-zero recent change to qualify — a flat or single-session lift is
 * not "moving" and is left out rather than padding the strip with noise.
 */
export function computeTopMovers(
  exercises: ExerciseWithMax[],
  weightUnit: WeightUnit,
  opts: TopMoversOptions = {}
): Mover[] {
  const limit = opts.limit ?? 3;
  const recentDays = opts.recentDays ?? 60;
  const now = opts.now ?? Date.now();
  const cutoff = now - recentDays * DAY_MS;

  const candidates: Mover[] = [];
  for (const ex of exercises) {
    const isBodyweight = ex.metric === 'bodyweight';
    const value = isBodyweight ? ex.bestReps ?? 0 : ex.estimated1RM;
    if (value <= 0) continue;

    // Stale lifts aren't current movers — they belong in the full Exercises list.
    const lastUsed = ex.lastUsed ? ex.lastUsed.getTime() : 0;
    if (lastUsed < cutoff) continue;

    // Reuse the shared day-bucketing + unit handling; bodyweight rows trend on reps.
    const trend = computeExerciseTrend(ex.history, weightUnit, isBodyweight ? 'reps' : 'topWeight');
    const spark = trend.sparkline;
    if (spark.length < 2) continue; // no trajectory to show

    // Delta is measured over EXACTLY the drawn window (last->first of the sparkline), so the
    // pill and the bars always tell the same story — unlike a full-history delta that can
    // disagree with a 6-point chart. This is what lets the number fall when a lift regresses.
    const delta = Math.round(spark[spark.length - 1] - spark[0]);
    if (delta === 0) continue; // flat = not a mover

    candidates.push({
      id: ex.id,
      name: ex.name,
      isCustom: ex.isCustom,
      isBodyweight,
      value,
      delta,
      sparkline: spark,
      exercise: ex,
    });
  }

  const recencyOf = (m: Mover) => (m.exercise.lastUsed ? m.exercise.lastUsed.getTime() : 0);

  const gainers = candidates
    .filter(m => m.delta > 0)
    .sort((a, b) => b.delta - a.delta || recencyOf(b) - recencyOf(a));
  const decliners = candidates
    .filter(m => m.delta < 0)
    .sort((a, b) => a.delta - b.delta || recencyOf(b) - recencyOf(a));

  const worstDecliner = decliners[0];
  const ordered: Mover[] = [];

  // Strongest gainers first; hold the last slot for the worst decliner when one exists.
  const gainerSlots = worstDecliner ? Math.max(0, limit - 1) : limit;
  ordered.push(...gainers.slice(0, gainerSlots));
  if (worstDecliner) ordered.push(worstDecliner);

  // Top up any spare slots (few gainers, or an all-declining deload week) with the next
  // biggest remaining movers regardless of direction.
  if (ordered.length < limit) {
    const used = new Set(ordered.map(m => m.id));
    const rest = candidates
      .filter(m => !used.has(m.id))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || recencyOf(b) - recencyOf(a));
    ordered.push(...rest.slice(0, limit - ordered.length));
  }

  return ordered.slice(0, limit);
}
