/**
 * Golden expected values — computed BY HAND from the fixtures, independently of the
 * app's own functions. Each carries the arithmetic so the check stays a real check.
 * If a "simplification" ever breaks volume math, unit conversion, or the 1RM formula,
 * these fail.
 */

/** Per-fixture: sum of calculateWorkoutStats across every workout in the scenario. */
export const WORKOUT_STATS_GOLDENS: Record<string, { totalSets: number; totalVolumeLbs: number }> = {
  // bench 135×10 + 155×8 + 155×8 = 1350+1240+1240 = 3830 ; ohp 75×10 + 85×8 = 750+680 = 1430
  // sets 3+2=5 ; vol 3830+1430 = 5260
  single: { totalSets: 5, totalVolumeLbs: 5260 },

  // kg→lbs each set: (60×2.20462)×10 + (70×2.20462)×8 + (70×2.20462)×8
  //   = 1322.772 + 1234.5872 + 1234.5872 = 3791.9464 → round 3792 ; sets 3
  kgUnit: { totalSets: 3, totalVolumeLbs: 3792 },

  // pull-up 0×12/0×10/0×8 + push-up 0×20/0×18 → weight 0 skipped from volume,
  // but every completed set still counts toward totalSets. sets 3+2=5 ; vol 0
  bodyweight: { totalSets: 5, totalVolumeLbs: 0 },

  // ex1 completedSets [] → 0 ; ex2 one set 225×5, unit undefined → treated lbs → 1125
  // sets 1 ; vol 1125
  corrupt: { totalSets: 1, totalVolumeLbs: 1125 },
};

/** OneRMCalculator.estimate spot values + invariants (guard against formula drift). */
export const ONE_RM_GOLDENS: { weight: number; reps: number; expected: number }[] = [
  // epley round(155×1.26667)=196 ; brzycki round(155×36/29)=192 ; lombardi round(155×8^0.1)=191
  //   → round((196+192+191)/3) = round(193) = 193
  { weight: 155, reps: 8, expected: 193 },
  // epley round(225×1.16667)=263 ; brzycki round(225×36/32)=253 ; lombardi round(225×5^0.1)=264
  //   → round((263+253+264)/3) = round(260) = 260
  { weight: 225, reps: 5, expected: 260 },
  // reps === 1 → identity
  { weight: 315, reps: 1, expected: 315 },
  // reps > 15 → formulas unreliable → identity
  { weight: 135, reps: 20, expected: 135 },
];

/**
 * PR-day counts per exercise from buildPRDays — a PR is a NEW all-time best at the
 * time logged (a training day whose best e1RM strictly beats every PRIOR day),
 * first-ever day EXCLUDED. Counted by hand from the fixtures; weight increases
 * monotonically ⇒ e1RM increases monotonically, so every ascending day is a record.
 */
export const PR_DAY_GOLDENS: Record<string, { exerciseId: string; prDayCount: number }> = {
  // prHeavy: bench top set 155+i×5 (i=0..7) → 8 strictly-ascending days; drop the
  // first (nothing prior to beat) → 7 real PRs. The old `>=` chip lit only 1 of 8.
  prHeavy: { exerciseId: 'bench-press-barbell', prDayCount: 7 },

  // dense: bench top set 155+(i%20) over 150 distinct days. Days i=0..19 climb
  // 155→174 (one workout each); drop i=0 → i=1..19 = 19 new records. Every later
  // cycle only re-hits ≤174, so no further PRs — the peak re-hits at i=39,59,… are
  // correctly silent (the old `>=` fired a chip on all ~7 of them).
  dense: { exerciseId: 'bench-press-barbell', prDayCount: 19 },

  // single: one bench day → first-ever day, excluded → 0 (no chip for a new user).
  single: { exerciseId: 'bench-press-barbell', prDayCount: 0 },
};

/**
 * ExerciseCard trend signals from computeExerciseTrend (topWeight metric, lbs display).
 * The card collapses history to one best-per-training-day bucket and reads the delta
 * off the FULL logged window + the last-6 buckets as the sparkline — no live clock,
 * no 3-month cutoff. Hand-computed from the fixtures:
 *   sparse squat: top set per day 205 → 215 → 225 across 3 gappy days (58/30/5d ago).
 *     delta = 225 − 205 = +20 ; sparkline = [205,215,225] (len 3). The OLD code showed
 *     nothing here: history < 3 months (no delta) and <2 recent bi-weekly windows (no bars).
 *   kgUnit: all sets on ONE day → a single bucket → no delta, no sparkline (needs ≥2 days).
 *   dense: bench top set 155+(i%20) over 150 ascending days. earliest bucket i=0 = 155,
 *     latest i=149 = 155+(149%20)=164 → delta = +9 ; last 6 buckets i=144..149 = %20
 *     4..9 → [159,160,161,162,163,164] (len 6).
 */
export const TREND_GOLDENS: Record<
  string,
  { exerciseId: string; deltaDisplay: number; isPositive: boolean; sparkline: number[] }
> = {
  sparse: { exerciseId: 'squat-barbell', deltaDisplay: 20, isPositive: true, sparkline: [205, 215, 225] },
  kgUnit: { exerciseId: 'bench-press-barbell', deltaDisplay: 0, isPositive: false, sparkline: [] },
  dense: {
    exerciseId: 'bench-press-barbell',
    deltaDisplay: 9,
    isPositive: true,
    sparkline: [159, 160, 161, 162, 163, 164],
  },
};

/**
 * PR recency from computePRRecency(exerciseStats, REFERENCE_NOW) — the deep-history
 * "how long since this lift last set a record" signal that flips the hero from a
 * celebratory gain to a plateau nudge. `null` means the exercise never set a PR, so it
 * is absent from the map (no signal). daysSincePR/sessionsSincePR hand-computed against
 * REFERENCE_NOW; plateau gate = daysSincePR >= 21 AND sessionsSincePR >= 4.
 */
export const PR_RECENCY_GOLDENS: Record<
  string,
  { exerciseId: string; daysSincePR: number | null; sessionsSincePR: number | null; isPlateau: boolean }
> = {
  // dense: bench 155+(i%20) over days daysAgo(150-i), i=0..149. Peak 174 first hit at
  // i=19 → day daysAgo(131); every later cycle only re-hits ≤174, so the last PR stays
  // at daysAgo(131). daysSincePR = 131 ; sessions after it = i=20..149 = 130 distinct
  // days. 131>=21 && 130>=4 ⇒ plateau. This is the fact the old +gain caption hid.
  dense: { exerciseId: 'bench-press-barbell', daysSincePR: 131, sessionsSincePR: 130, isPlateau: true },

  // prHeavy: strictly ascending, last PR on the final day daysAgo(7). daysSincePR = 7,
  // no sessions logged after it ⇒ 0. 7 < 21 ⇒ NOT a plateau (stays celebratory).
  prHeavy: { exerciseId: 'bench-press-barbell', daysSincePR: 7, sessionsSincePR: 0, isPlateau: false },

  // single: one bench day → first-ever day excluded → 0 PRs → absent from the map (null).
  single: { exerciseId: 'bench-press-barbell', daysSincePR: null, sessionsSincePR: null, isPlateau: false },
};

/**
 * Activity freshness from computeActivityStatus(exerciseStats, REFERENCE_NOW) — the
 * clock-injectable "how long since you last trained" signal that flips the hero from a
 * beginner "1 of 3 sessions" nudge to a comeback prompt. daysSinceLastWorkout is the whole
 * days from the MOST-RECENT logged history entry to REFERENCE_NOW; lapse gate = >= 14 days.
 * Hand-computed from the fixtures:
 *   lapsed: last session = squat daysAgo(45) → 45 days ; 45 >= 14 ⇒ lapsed (the fact the
 *     old page buried under "1 of 3 sessions logged").
 *   single: bench+ohp daysAgo(0) → 0 days ; not lapsed.
 *   sparse: last squat daysAgo(5) → 5 days ; not lapsed.
 *   dense: last bench = daysAgo(150 - 149) = daysAgo(1) → 1 day ; not lapsed.
 */
export const ACTIVITY_GOLDENS: Record<string, { daysSinceLastWorkout: number; isLapsed: boolean }> = {
  lapsed: { daysSinceLastWorkout: 45, isLapsed: true },
  single: { daysSinceLastWorkout: 0, isLapsed: false },
  sparse: { daysSinceLastWorkout: 5, isLapsed: false },
  dense: { daysSinceLastWorkout: 1, isLapsed: false },
};

/**
 * buildExerciseStats over the `bodyweight` fixture — the previously UNASSERTED dim-3
 * "empty & edge states" failure. The fixture logs 5 completed calisthenics sets
 * (pull-up 12/10/8, push-up 20/18), every one at weight 0. The OLD inline ingestion
 * dropped all of them (`if (weight <= 0) return;`), so the Exercises tab rendered "No
 * exercises tracked" for a user who had just logged a full workout. buildExerciseStats
 * now KEEPS them, scored on a reps signal:
 *   pull-up-bodyweight: best set 12 reps → bestReps 12, no 1RM (metric 'bodyweight')
 *   push-up-bodyweight: best set 20 reps → bestReps 20, no 1RM (metric 'bodyweight')
 * Both sit on ONE training day ⇒ the reps trend has an empty sparkline (needs ≥2 days),
 * which is a valid, finite, non-crashing state.
 */
export const BODYWEIGHT_STATS_GOLDEN: {
  trackedIds: string[];
  rows: Record<string, { metric: 'weight' | 'bodyweight'; bestReps: number; estimated1RM: number }>;
} = {
  trackedIds: ['pull-up-bodyweight', 'push-up-bodyweight'],
  rows: {
    'pull-up-bodyweight': { metric: 'bodyweight', bestReps: 12, estimated1RM: 0 },
    'push-up-bodyweight': { metric: 'bodyweight', bestReps: 20, estimated1RM: 0 },
  },
};
