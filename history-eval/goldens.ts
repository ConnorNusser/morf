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
