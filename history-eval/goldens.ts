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
