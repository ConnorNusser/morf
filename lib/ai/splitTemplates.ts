/**
 * Shared training types.
 *
 * NOTE: This file previously held AI split-template guidelines (SplitTemplate data,
 * selectTemplate, etc.). Routine generation is now deterministic — see
 * `lib/data/programTemplates.ts` — so only these shared type aliases remain. They live
 * here (rather than moving) because several modules already import them from this path.
 */

export type TrainingGoal = 'hypertrophy' | 'strength' | 'powerbuilding' | 'recomp' | 'athletic' | 'general';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
