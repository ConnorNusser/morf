/**
 * Program Template Library
 * ------------------------------------------------------------------------------------
 * A deterministic, attributed library of workout programs used to build routines
 * without calling the AI (the AI is reserved for refinement + limited-equipment cases).
 *
 * Three composition levels keep the data DRY and every exercise ID valid:
 *   1. SLOTS         — a movement pattern with candidate exercise IDs in PRIORITY order.
 *                      Equipment substitution falls out of this ordering: e.g. a squat
 *                      resolves barbell → smith → hack → leg-press → goblet → bodyweight,
 *                      so "no rack" automatically becomes a smith/hack squat.
 *   2. DAY_TEMPLATES — a single training day: 4 `core` slots + extra `accessories`
 *                      used to expand toward the requested exercise count (up to ~8).
 *   3. PROGRAMS      — thin compositions: an ordered list of day-template keys plus the
 *                      goals/days they suit, a volume flavor, and a cited source.
 *
 * The selector filters PROGRAMS by the user's clickthrough choices (goal + days) and
 * RNG-picks among the matches for variety.
 */

import type { MuscleGroup, TrainingAdvancement } from '@/types';
import type { TrainingGoal } from '@/lib/ai/splitTemplates';
import type { ProgramTemplate } from '@/lib/ai/prompts/routineGeneration.prompt';

/** Volume / rep-scheme flavor applied when materializing a day. */
export type VolumeFlavor = 'strength' | 'power' | 'hypertrophy' | 'powerbuilding' | 'athletic' | 'endurance';

/** A movement pattern. `options` are exercise IDs in descending preference order. */
export interface ExerciseSlot {
  label: string;
  target: MuscleGroup;
  options: string[];
}

export interface DayTemplate {
  name: string;
  focus: string;
  targetMuscles: MuscleGroup[];
  core: ExerciseSlot[];        // the ~4 anchor movements
  accessories: ExerciseSlot[]; // pulled in (in order) to reach the requested count
}

export interface ProgramSource {
  program: string;
  url: string;
}

export interface ProgramDef {
  key: string;
  name: string;
  style: ProgramTemplate;
  goals: TrainingGoal[];
  days: number;
  volume: VolumeFlavor;
  /** Ordered DAY_TEMPLATES keys, one per training day. */
  dayPlan: string[];
  source: ProgramSource;
  /** Optional: experience levels this program is well suited to. */
  bestFor?: TrainingAdvancement[];
}

// ====================================================================================
// 1. SLOTS — movement patterns (exercise IDs in priority order)
// ====================================================================================

export const SLOTS = {
  // --- Push ---
  horiz_press: { label: 'Horizontal Press', target: 'chest', options: ['bench-press-barbell', 'bench-press-dumbbells', 'bench-press-smith-machine', 'bench-press-machine', 'push-up-bodyweight'] },
  incline_press: { label: 'Incline Press', target: 'chest', options: ['incline-bench-press-barbell', 'incline-bench-press-dumbbells', 'bench-press-machine', 'push-up-bodyweight'] },
  chest_fly: { label: 'Chest Fly', target: 'chest', options: ['chest-fly-cables', 'flyes-dumbbells', 'chest-fly-machine', 'crossover-cables'] },
  dips: { label: 'Dips', target: 'chest', options: ['dip-bodyweight'] },
  ohp: { label: 'Overhead Press', target: 'shoulders', options: ['overhead-press-barbell', 'shoulder-press-dumbbells', 'arnold-press-dumbbells', 'overhead-press-machine'] },
  lateral_raise: { label: 'Lateral Raise', target: 'shoulders', options: ['lateral-raise-dumbbells', 'lateral-raise-cables'] },
  rear_delt: { label: 'Rear Delt', target: 'shoulders', options: ['rear-delt-fly-cables', 'rear-delt-fly-dumbbells'] },
  triceps: { label: 'Triceps', target: 'arms', options: ['tricep-pushdown-cables', 'skull-crushers-dumbbells', 'overhead-tricep-extension-cables', 'tricep-extension-dumbbells', 'dip-bodyweight'] },

  // --- Pull ---
  vert_pull: { label: 'Vertical Pull', target: 'back', options: ['pull-up-bodyweight', 'lat-pulldown-cables', 'assisted-pull-up-machine'] },
  row: { label: 'Horizontal Row', target: 'back', options: ['row-barbell', 'row-dumbbells', 'row-cables', 'seated-row-machine', 'rowing-machine'] },
  deadlift: { label: 'Deadlift', target: 'back', options: ['deadlift-barbell', 'sumo-deadlift-barbell', 'romanian-deadlift-dumbbells'] },
  biceps: { label: 'Biceps', target: 'arms', options: ['bicep-curl-barbell', 'bicep-curl-dumbbells', 'bicep-curl-cables', 'preacher-curl-dumbbells'] },
  hammer: { label: 'Hammer Curl', target: 'arms', options: ['hammer-curl-dumbbells', 'bicep-curl-cables'] },
  shrugs: { label: 'Shrugs', target: 'back', options: ['shrugs-barbell', 'shrugs-dumbbells'] },

  // --- Legs ---
  squat: { label: 'Squat', target: 'legs', options: ['squat-barbell', 'front-squat-barbell', 'squat-smith-machine', 'hack-squat-machine', 'leg-press-machine', 'goblet-squat-dumbbells', 'goblet-squat-kettlebell', 'squat-bodyweight'] },
  hinge: { label: 'Hip Hinge', target: 'glutes', options: ['romanian-deadlift-barbell', 'romanian-deadlift-dumbbells', 'deadlift-barbell', 'swing-kettlebell'] },
  lunge: { label: 'Lunge / Split Squat', target: 'legs', options: ['bulgarian-split-squat-dumbbells', 'walking-lunge-dumbbells', 'lunges-barbell'] },
  leg_press: { label: 'Leg Press', target: 'legs', options: ['leg-press-machine', 'hack-squat-machine', 'goblet-squat-dumbbells', 'squat-bodyweight'] },
  leg_ext: { label: 'Leg Extension', target: 'legs', options: ['leg-extension-machine', 'wall-sit-bodyweight'] },
  leg_curl: { label: 'Leg Curl', target: 'legs', options: ['leg-curl-machine', 'romanian-deadlift-dumbbells'] },
  hip_thrust: { label: 'Hip Thrust', target: 'glutes', options: ['hip-thrust-barbell', 'hip-thrust-dumbbells', 'hip-thrust-machine', 'swing-kettlebell'] },
  calf: { label: 'Calf Raise', target: 'legs', options: ['calf-raise-machine'] },

  // --- Core ---
  core: { label: 'Core', target: 'core', options: ['plank-bodyweight'] },
} satisfies Record<string, ExerciseSlot>;

export type SlotKey = keyof typeof SLOTS;

// ====================================================================================
// 2. DAY_TEMPLATES — single training days built from slots
// ====================================================================================

const T = (
  name: string,
  focus: string,
  targetMuscles: MuscleGroup[],
  core: SlotKey[],
  accessories: SlotKey[]
): DayTemplate => ({
  name,
  focus,
  targetMuscles,
  core: core.map(k => SLOTS[k]),
  accessories: accessories.map(k => SLOTS[k]),
});

export const DAY_TEMPLATES: Record<string, DayTemplate> = {
  // Full body
  fb_strength_a: T('Full Body A', 'Squat focus', ['legs', 'chest', 'back'], ['squat', 'horiz_press', 'row'], ['ohp', 'biceps', 'core']),
  fb_strength_b: T('Full Body B', 'Deadlift focus', ['back', 'legs', 'shoulders'], ['deadlift', 'ohp', 'vert_pull'], ['leg_press', 'rear_delt', 'core']),
  fb_strength_c: T('Full Body C', 'Bench focus', ['chest', 'legs', 'back'], ['horiz_press', 'squat', 'row'], ['hinge', 'triceps', 'core']),
  fb_hyper_a: T('Full Body A', 'Push emphasis', ['chest', 'legs', 'shoulders'], ['horiz_press', 'squat', 'vert_pull'], ['lateral_raise', 'triceps', 'leg_curl', 'core']),
  fb_hyper_b: T('Full Body B', 'Pull emphasis', ['back', 'legs', 'arms'], ['row', 'hinge', 'incline_press'], ['biceps', 'lateral_raise', 'leg_ext', 'core']),
  fb_hyper_c: T('Full Body C', 'Balanced', ['legs', 'chest', 'back'], ['leg_press', 'incline_press', 'vert_pull'], ['chest_fly', 'hammer', 'calf', 'core']),
  fb_athletic: T('Full Body Athletic', 'Power & conditioning', ['legs', 'back', 'chest'], ['squat', 'hinge', 'horiz_press'], ['row', 'ohp', 'core']),

  // Push / Pull / Legs
  push: T('Push', 'Chest, shoulders, triceps', ['chest', 'shoulders', 'arms'], ['horiz_press', 'ohp', 'incline_press'], ['lateral_raise', 'chest_fly', 'triceps', 'dips']),
  push_b: T('Push (Shoulder)', 'Shoulder-led push', ['shoulders', 'chest', 'arms'], ['ohp', 'incline_press', 'chest_fly'], ['lateral_raise', 'triceps', 'rear_delt', 'dips']),
  pull: T('Pull', 'Back and biceps', ['back', 'arms'], ['row', 'vert_pull', 'biceps'], ['rear_delt', 'hammer', 'shrugs', 'deadlift']),
  pull_b: T('Pull (Width)', 'Lat-led pull', ['back', 'arms'], ['vert_pull', 'row', 'hammer'], ['rear_delt', 'biceps', 'shrugs', 'deadlift']),
  legs: T('Legs', 'Quads, hamstrings, glutes', ['legs', 'glutes'], ['squat', 'hinge', 'leg_press'], ['leg_curl', 'leg_ext', 'calf', 'lunge']),
  legs_b: T('Legs (Posterior)', 'Hamstring & glute focus', ['legs', 'glutes'], ['hinge', 'leg_press', 'leg_curl'], ['hip_thrust', 'lunge', 'calf', 'leg_ext']),

  // Upper / Lower
  upper_power: T('Upper Power', 'Heavy upper compounds', ['chest', 'back', 'shoulders'], ['horiz_press', 'row', 'ohp', 'vert_pull'], ['biceps', 'triceps', 'rear_delt']),
  lower_power: T('Lower Power', 'Heavy lower compounds', ['legs', 'glutes'], ['squat', 'hinge', 'leg_press'], ['leg_curl', 'calf', 'core']),
  upper_hyper: T('Upper Hypertrophy', 'Upper volume', ['chest', 'back', 'arms'], ['incline_press', 'row', 'lateral_raise', 'vert_pull'], ['chest_fly', 'biceps', 'triceps', 'rear_delt']),
  lower_hyper: T('Lower Hypertrophy', 'Lower volume', ['legs', 'glutes'], ['hinge', 'leg_press', 'leg_ext', 'leg_curl'], ['hip_thrust', 'lunge', 'calf', 'core']),
  upper_gen: T('Upper Body', 'Balanced upper', ['chest', 'back', 'shoulders'], ['horiz_press', 'row', 'ohp'], ['vert_pull', 'biceps', 'triceps', 'lateral_raise']),
  lower_gen: T('Lower Body', 'Balanced lower', ['legs', 'glutes'], ['squat', 'hinge', 'leg_press'], ['leg_curl', 'lunge', 'calf', 'core']),

  // Body-part split (bro / Arnold)
  chest_day: T('Chest', 'Chest specialization', ['chest'], ['horiz_press', 'incline_press', 'chest_fly'], ['dips', 'ohp', 'triceps']),
  back_day: T('Back', 'Back specialization', ['back'], ['deadlift', 'row', 'vert_pull'], ['shrugs', 'rear_delt', 'biceps']),
  shoulder_day: T('Shoulders', 'Shoulder specialization', ['shoulders'], ['ohp', 'lateral_raise', 'rear_delt'], ['shrugs', 'incline_press', 'core']),
  arm_day: T('Arms', 'Biceps & triceps', ['arms'], ['biceps', 'triceps', 'hammer'], ['dips', 'rear_delt', 'core']),
  leg_day: T('Legs', 'Leg specialization', ['legs', 'glutes'], ['squat', 'leg_press', 'hinge'], ['leg_ext', 'leg_curl', 'calf', 'lunge']),
  back_shoulders: T('Back & Shoulders', 'Pull + delts', ['back', 'shoulders'], ['row', 'vert_pull', 'lateral_raise'], ['rear_delt', 'shrugs', 'biceps']),
  chest_arms: T('Chest & Arms', 'Push + arms', ['chest', 'arms'], ['incline_press', 'chest_fly', 'triceps'], ['biceps', 'dips', 'hammer']),
};

// ====================================================================================
// 3. PROGRAMS — thin, attributed compositions
// ====================================================================================

export const PROGRAMS: ProgramDef[] = [
  // ---------- 3 day ----------
  // StrongLifts 5x5 — https://stronglifts.com/5x5/
  { key: 'stronglifts_5x5', name: 'StrongLifts 5x5', style: 'full_body', goals: ['strength', 'general'], days: 3, volume: 'strength', dayPlan: ['fb_strength_a', 'fb_strength_b', 'fb_strength_c'], source: { program: 'StrongLifts 5x5', url: 'https://stronglifts.com/5x5/' }, bestFor: ['beginner', 'intermediate'] },
  // Starting Strength — https://startingstrength.com/get-started/programs
  { key: 'starting_strength', name: 'Starting Strength', style: 'full_body', goals: ['strength'], days: 3, volume: 'strength', dayPlan: ['fb_strength_a', 'fb_strength_b', 'fb_strength_a'], source: { program: 'Starting Strength', url: 'https://startingstrength.com/get-started/programs' }, bestFor: ['beginner'] },
  // Greyskull LP — https://www.reddit.com/r/Fitness/wiki/phraks-gslp
  { key: 'greyskull_lp', name: 'Greyskull LP', style: 'full_body', goals: ['strength', 'general'], days: 3, volume: 'power', dayPlan: ['fb_strength_a', 'fb_strength_b', 'fb_strength_c'], source: { program: 'Greyskull LP', url: 'https://www.reddit.com/r/Fitness/wiki/phraks-gslp' }, bestFor: ['beginner', 'intermediate'] },
  // 3-Day Full Body Hypertrophy — https://www.muscleandstrength.com/workouts/3-day-full-body-workout-routine
  { key: 'full_body_hypertrophy_3', name: '3-Day Full Body Hypertrophy', style: 'full_body', goals: ['hypertrophy', 'general', 'recomp'], days: 3, volume: 'hypertrophy', dayPlan: ['fb_hyper_a', 'fb_hyper_b', 'fb_hyper_c'], source: { program: '3-Day Full Body', url: 'https://www.muscleandstrength.com/workouts/3-day-full-body-workout-routine' } },
  // 3-Day PPL — https://www.muscleandstrength.com/workouts/3-day-push-pull-legs
  { key: 'ppl_3', name: '3-Day Push/Pull/Legs', style: 'ppl', goals: ['hypertrophy', 'general'], days: 3, volume: 'hypertrophy', dayPlan: ['push', 'pull', 'legs'], source: { program: 'Push/Pull/Legs', url: 'https://www.muscleandstrength.com/workouts/3-day-push-pull-legs' } },
  // Athletic Full Body — https://www.muscleandstrength.com/workouts/athlean
  { key: 'athletic_full_body_3', name: 'Athletic Full Body', style: 'full_body', goals: ['athletic', 'general'], days: 3, volume: 'athletic', dayPlan: ['fb_athletic', 'fb_strength_b', 'fb_athletic'], source: { program: 'Athletic Full Body', url: 'https://www.muscleandstrength.com/workouts/total-package-athletic-build-workout' } },
  // Recomp Full Body — https://www.muscleandstrength.com/workouts/body-recomposition
  { key: 'recomp_full_body_3', name: 'Recomp Full Body', style: 'full_body', goals: ['recomp', 'general'], days: 3, volume: 'endurance', dayPlan: ['fb_hyper_a', 'fb_hyper_b', 'fb_hyper_c'], source: { program: 'Body Recomposition', url: 'https://www.muscleandstrength.com/articles/body-recomposition' } },

  // ---------- 4 day ----------
  // PHUL — https://www.muscleandstrength.com/workouts/phul-workout
  { key: 'phul', name: 'PHUL', style: 'upper_lower', goals: ['powerbuilding', 'hypertrophy', 'strength'], days: 4, volume: 'powerbuilding', dayPlan: ['upper_power', 'lower_power', 'upper_hyper', 'lower_hyper'], source: { program: 'PHUL — Power Hypertrophy Upper Lower', url: 'https://www.muscleandstrength.com/workouts/phul-workout' } },
  // 4-Day Upper/Lower Hypertrophy — https://www.muscleandstrength.com/workouts/4-day-upper-lower-split
  { key: 'upper_lower_hyper_4', name: '4-Day Upper/Lower', style: 'upper_lower', goals: ['hypertrophy', 'general'], days: 4, volume: 'hypertrophy', dayPlan: ['upper_hyper', 'lower_hyper', 'upper_gen', 'lower_gen'], source: { program: '4-Day Upper/Lower Split', url: 'https://www.muscleandstrength.com/workouts/4-day-upper-lower-split' } },
  // 4-Day Upper/Lower Strength — https://www.muscleandstrength.com/workouts/4-day-upper-lower-strength
  { key: 'upper_lower_strength_4', name: '4-Day Upper/Lower Strength', style: 'upper_lower', goals: ['strength', 'powerbuilding'], days: 4, volume: 'strength', dayPlan: ['upper_power', 'lower_power', 'upper_power', 'lower_power'], source: { program: 'Upper/Lower Strength', url: 'https://www.muscleandstrength.com/workouts/4-day-upper-lower-split' } },
  // Athletic Upper/Lower
  { key: 'athletic_upper_lower_4', name: 'Athletic Upper/Lower', style: 'upper_lower', goals: ['athletic', 'general'], days: 4, volume: 'athletic', dayPlan: ['upper_power', 'lower_power', 'upper_gen', 'lower_gen'], source: { program: 'Athletic Upper/Lower', url: 'https://www.muscleandstrength.com/workouts/total-package-athletic-build-workout' } },
  // Recomp Upper/Lower
  { key: 'recomp_upper_lower_4', name: 'Recomp Upper/Lower', style: 'upper_lower', goals: ['recomp', 'general'], days: 4, volume: 'endurance', dayPlan: ['upper_hyper', 'lower_hyper', 'upper_gen', 'lower_gen'], source: { program: 'Recomp Upper/Lower', url: 'https://www.muscleandstrength.com/articles/body-recomposition' } },
  // General 4-day
  { key: 'general_upper_lower_4', name: 'Balanced Upper/Lower', style: 'upper_lower', goals: ['general', 'recomp'], days: 4, volume: 'hypertrophy', dayPlan: ['upper_gen', 'lower_gen', 'upper_hyper', 'lower_hyper'], source: { program: '4-Day Upper/Lower Split', url: 'https://www.muscleandstrength.com/workouts/4-day-upper-lower-split' } },

  // ---------- 5 day ----------
  // PHAT — Layne Norton — https://www.muscleandstrength.com/workouts/layne-norton-phat-workout
  { key: 'phat', name: 'PHAT', style: 'powerbuilding', goals: ['powerbuilding', 'strength', 'hypertrophy'], days: 5, volume: 'powerbuilding', dayPlan: ['upper_power', 'lower_power', 'back_shoulders', 'lower_hyper', 'chest_arms'], source: { program: 'PHAT — Layne Norton', url: 'https://www.muscleandstrength.com/workouts/layne-norton-phat-workout' } },
  // Classic Bro Split — https://www.muscleandstrength.com/workouts/5-day-bodybuilding-split
  { key: 'bro_split_5', name: '5-Day Body-Part Split', style: 'bro_split', goals: ['hypertrophy'], days: 5, volume: 'hypertrophy', dayPlan: ['chest_day', 'back_day', 'leg_day', 'shoulder_day', 'arm_day'], source: { program: '5-Day Bodybuilding Split', url: 'https://www.muscleandstrength.com/workouts/5-day-bodybuilding-split' } },
  // Arnold Golden Six-ish 5-day — https://www.muscleandstrength.com/workouts/arnold-schwarzenegger-blueprint
  { key: 'arnold_5', name: 'Arnold-Style 5-Day', style: 'bro_split', goals: ['hypertrophy', 'powerbuilding'], days: 5, volume: 'hypertrophy', dayPlan: ['chest_arms', 'back_shoulders', 'leg_day', 'chest_day', 'back_day'], source: { program: 'Arnold Blueprint', url: 'https://www.muscleandstrength.com/workouts/arnold-schwarzenegger-blueprint' } },
  // 5-day Powerbuilding (PPL + Upper/Lower)
  { key: 'powerbuilding_5', name: '5-Day Powerbuilding', style: 'powerbuilding', goals: ['powerbuilding', 'strength'], days: 5, volume: 'powerbuilding', dayPlan: ['upper_power', 'lower_power', 'push', 'pull', 'legs'], source: { program: '5-Day Powerbuilding', url: 'https://www.muscleandstrength.com/workouts/5-day-powerbuilding-split' } },
  // Athletic 5-day
  { key: 'athletic_5', name: 'Athletic 5-Day', style: 'powerbuilding', goals: ['athletic', 'general'], days: 5, volume: 'athletic', dayPlan: ['upper_power', 'lower_power', 'fb_athletic', 'upper_gen', 'lower_gen'], source: { program: 'Athletic 5-Day', url: 'https://www.muscleandstrength.com/workouts/total-package-athletic-build-workout' } },

  // ---------- 6 day ----------
  // Reddit PPL (Metallicadpa) — https://www.reddit.com/r/Fitness/comments/2vlcnv/
  { key: 'ppl_6', name: '6-Day Push/Pull/Legs', style: 'ppl', goals: ['hypertrophy', 'general'], days: 6, volume: 'hypertrophy', dayPlan: ['push', 'pull', 'legs', 'push_b', 'pull_b', 'legs_b'], source: { program: 'r/Fitness PPL (Metallicadpa)', url: 'https://www.reddit.com/r/Fitness/comments/2vlcnv/a_linear_progression_based_ppl_program_for/' } },
  // PPL Powerbuilding 6-day
  { key: 'ppl_powerbuilding_6', name: '6-Day PPL Powerbuilding', style: 'ppl', goals: ['powerbuilding', 'strength'], days: 6, volume: 'powerbuilding', dayPlan: ['push', 'pull', 'legs', 'push_b', 'pull_b', 'legs_b'], source: { program: '6-Day PPL Powerbuilding', url: 'https://www.muscleandstrength.com/workouts/6-day-powerbuilding-split' } },
  // Arnold 6-day — https://www.muscleandstrength.com/workouts/arnold-schwarzenegger-blueprint
  { key: 'arnold_6', name: 'Arnold 6-Day', style: 'bro_split', goals: ['hypertrophy'], days: 6, volume: 'hypertrophy', dayPlan: ['chest_arms', 'back_shoulders', 'leg_day', 'chest_day', 'back_day', 'shoulder_day'], source: { program: 'Arnold Blueprint', url: 'https://www.muscleandstrength.com/workouts/arnold-schwarzenegger-blueprint' } },
  // Athletic PPL 6-day
  { key: 'athletic_ppl_6', name: '6-Day Athletic PPL', style: 'ppl', goals: ['athletic', 'general'], days: 6, volume: 'athletic', dayPlan: ['push', 'pull', 'legs', 'push_b', 'pull_b', 'legs_b'], source: { program: 'Athletic PPL', url: 'https://www.muscleandstrength.com/workouts/6-day-pplppl-dumbbell-and-bodyweight-workout' } },
  // Recomp PPL 6-day
  { key: 'recomp_ppl_6', name: '6-Day Recomp PPL', style: 'ppl', goals: ['recomp', 'general'], days: 6, volume: 'endurance', dayPlan: ['push', 'pull', 'legs', 'push_b', 'pull_b', 'legs_b'], source: { program: 'Recomp PPL', url: 'https://www.muscleandstrength.com/articles/body-recomposition' } },

  // ---------- 3 day (extra variety) ----------
  // Ice Cream Fitness 5x5 — https://www.muscleandstrength.com/workouts/jason-blaha-ice-cream-fitness-5x5-novice-workout
  { key: 'ice_cream_fitness', name: 'Ice Cream Fitness 5x5', style: 'full_body', goals: ['strength', 'hypertrophy'], days: 3, volume: 'strength', dayPlan: ['fb_strength_a', 'fb_strength_b', 'fb_strength_c'], source: { program: 'Ice Cream Fitness 5x5', url: 'https://www.muscleandstrength.com/workouts/jason-blaha-ice-cream-fitness-5x5-novice-workout' }, bestFor: ['beginner'] },
  // Madcow 5x5 — https://stronglifts.com/madcow/
  { key: 'madcow_5x5', name: 'Madcow 5x5', style: 'strength', goals: ['strength', 'powerbuilding'], days: 3, volume: 'power', dayPlan: ['fb_strength_a', 'fb_strength_b', 'fb_strength_c'], source: { program: 'Madcow 5x5', url: 'https://stronglifts.com/madcow/' }, bestFor: ['intermediate'] },
  // 3-Day Full Body Powerbuilding — https://www.muscleandstrength.com/workouts/3-day-powerbuilding-split
  { key: 'full_body_power_3', name: '3-Day Full Body Power', style: 'full_body', goals: ['powerbuilding', 'strength'], days: 3, volume: 'powerbuilding', dayPlan: ['fb_strength_a', 'fb_hyper_b', 'fb_strength_c'], source: { program: 'Full Body Powerbuilding', url: 'https://www.muscleandstrength.com/workouts/3-day-powerbuilding-split' } },
  // 3-Day Minimalist Full Body
  { key: 'minimalist_full_body_3', name: 'Minimalist Full Body', style: 'full_body', goals: ['general', 'hypertrophy'], days: 3, volume: 'hypertrophy', dayPlan: ['fb_hyper_b', 'fb_hyper_c', 'fb_hyper_a'], source: { program: '3-Day Full Body', url: 'https://www.muscleandstrength.com/workouts/3-day-full-body-workout-routine' } },

  // ---------- 4 day (extra variety) ----------
  // nSuns 531 LP — https://www.reddit.com/r/Fitness/comments/4y0gni/
  { key: 'nsuns_4', name: 'nSuns 531 LP', style: 'upper_lower', goals: ['strength', 'powerbuilding'], days: 4, volume: 'power', dayPlan: ['upper_power', 'lower_power', 'upper_power', 'lower_power'], source: { program: 'nSuns 531 LP', url: 'https://www.reddit.com/r/Fitness/comments/4y0gni/nsuns_lp_spreadsheets_2/' }, bestFor: ['intermediate', 'advanced'] },
  // 4-Day Power Hypertrophy
  { key: 'power_hypertrophy_4', name: '4-Day Power Hypertrophy', style: 'upper_lower', goals: ['powerbuilding', 'hypertrophy'], days: 4, volume: 'powerbuilding', dayPlan: ['upper_power', 'lower_power', 'upper_hyper', 'lower_hyper'], source: { program: 'Power Hypertrophy 4-Day', url: 'https://www.muscleandstrength.com/workouts/4-day-upper-lower-split' } },
  // 4-Day Hypertrophy Upper/Lower
  { key: 'hypertrophy_ul_4b', name: 'Hypertrophy Upper/Lower', style: 'upper_lower', goals: ['hypertrophy', 'recomp'], days: 4, volume: 'hypertrophy', dayPlan: ['upper_hyper', 'lower_hyper', 'upper_hyper', 'lower_hyper'], source: { program: 'Hypertrophy Upper/Lower', url: 'https://www.muscleandstrength.com/workouts/4-day-upper-lower-split' } },

  // ---------- 5 day (extra variety) ----------
  // 5-Day Upper/Lower/Full
  { key: 'upper_lower_full_5', name: '5-Day Upper/Lower/Full', style: 'powerbuilding', goals: ['hypertrophy', 'powerbuilding'], days: 5, volume: 'hypertrophy', dayPlan: ['upper_power', 'lower_power', 'upper_hyper', 'lower_hyper', 'fb_hyper_c'], source: { program: '5-Day Upper/Lower/Full', url: 'https://www.muscleandstrength.com/workouts/5-day-workout-routines' } },
  // 5-Day Classic Split
  { key: 'bro_split_5b', name: 'Classic 5-Day Split', style: 'bro_split', goals: ['hypertrophy', 'general'], days: 5, volume: 'hypertrophy', dayPlan: ['chest_day', 'back_day', 'shoulder_day', 'leg_day', 'arm_day'], source: { program: '5-Day Split', url: 'https://www.muscleandstrength.com/workouts/5-day-bodybuilding-split' } },
  // 5-Day PPL + Upper/Lower
  { key: 'ppl_ul_5', name: 'PPL + Upper/Lower', style: 'ppl', goals: ['hypertrophy', 'athletic'], days: 5, volume: 'hypertrophy', dayPlan: ['push', 'pull', 'legs', 'upper_hyper', 'lower_hyper'], source: { program: 'PPL/UL Hybrid', url: 'https://www.muscleandstrength.com/workouts/5-day-push-pull-legs-and-upper-lower-split' } },
  // 5-Day Recomp
  { key: 'recomp_5', name: '5-Day Recomp', style: 'powerbuilding', goals: ['recomp', 'general'], days: 5, volume: 'endurance', dayPlan: ['upper_hyper', 'lower_hyper', 'push', 'pull', 'legs'], source: { program: 'Recomp 5-Day', url: 'https://www.muscleandstrength.com/articles/body-recomposition' } },

  // ---------- 6 day (extra variety) ----------
  // 6-Day High-Volume PPL
  { key: 'ppl_6b', name: '6-Day High-Volume PPL', style: 'ppl', goals: ['hypertrophy'], days: 6, volume: 'hypertrophy', dayPlan: ['push_b', 'pull_b', 'legs_b', 'push', 'pull', 'legs'], source: { program: 'High-Volume PPL', url: 'https://www.muscleandstrength.com/workouts/6-day-push-pull-legs' } },
  // 6-Day Arnold Volume
  { key: 'arnold_volume_6', name: 'Arnold Volume 6-Day', style: 'bro_split', goals: ['hypertrophy', 'powerbuilding'], days: 6, volume: 'powerbuilding', dayPlan: ['chest_arms', 'back_shoulders', 'leg_day', 'chest_day', 'back_day', 'leg_day'], source: { program: 'Arnold Blueprint', url: 'https://www.muscleandstrength.com/workouts/arnold-schwarzenegger-blueprint' } },
];

/**
 * Rep schemes per volume flavor. Returned per (isCompound, isCore) so anchors stay
 * heavier and accessories higher-rep. `reps` is the base (low end of the range) — the
 * double-progression engine walks it up from there.
 */
export const REP_SCHEMES: Record<VolumeFlavor, { coreCompound: { sets: number; reps: number }; coreIso: { sets: number; reps: number }; accessory: { sets: number; reps: number } }> = {
  strength: { coreCompound: { sets: 5, reps: 5 }, coreIso: { sets: 3, reps: 8 }, accessory: { sets: 3, reps: 10 } },
  power: { coreCompound: { sets: 4, reps: 5 }, coreIso: { sets: 3, reps: 8 }, accessory: { sets: 3, reps: 10 } },
  hypertrophy: { coreCompound: { sets: 4, reps: 8 }, coreIso: { sets: 3, reps: 12 }, accessory: { sets: 3, reps: 12 } },
  powerbuilding: { coreCompound: { sets: 4, reps: 6 }, coreIso: { sets: 3, reps: 10 }, accessory: { sets: 3, reps: 12 } },
  athletic: { coreCompound: { sets: 4, reps: 6 }, coreIso: { sets: 3, reps: 10 }, accessory: { sets: 3, reps: 12 } },
  endurance: { coreCompound: { sets: 3, reps: 12 }, coreIso: { sets: 3, reps: 15 }, accessory: { sets: 2, reps: 15 } },
};
