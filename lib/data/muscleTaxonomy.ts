// Fine-grained muscle taxonomy — the foundation for scientific volume/frequency
// checks. The exercise DB labels muscles coarsely ("legs", "back"), which spans
// quads/hams/glutes and lats/traps/etc. — too blunt to compare against MEV→MRV
// volume landmarks or 2×/week frequency. This maps every built-in exercise to the
// specific sub-muscles it trains, splitting primary (full credit) from secondary
// (half credit, per the Renaissance Periodization convention).
import { MuscleGroup } from '@/types';

export type SubMuscle =
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'lats'
  | 'upper_back'
  | 'traps'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs';

export const ALL_SUBMUSCLES: SubMuscle[] = [
  'quads', 'hamstrings', 'glutes', 'calves',
  'chest', 'front_delts', 'side_delts', 'rear_delts',
  'lats', 'upper_back', 'traps', 'lower_back',
  'biceps', 'triceps', 'forearms', 'abs',
];

// Roll a sub-muscle back up to the coarse UI group (for grouping / display).
export const SUBMUSCLE_GROUP: Record<SubMuscle, MuscleGroup> = {
  quads: 'legs', hamstrings: 'legs', glutes: 'glutes', calves: 'legs',
  chest: 'chest',
  front_delts: 'shoulders', side_delts: 'shoulders', rear_delts: 'shoulders',
  lats: 'back', upper_back: 'back', traps: 'back', lower_back: 'back',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  abs: 'core',
};

export interface SubMuscleTargets {
  primary: SubMuscle[]; // full-credit movers
  secondary: SubMuscle[]; // half-credit assistance
}

// Per-exercise sub-muscle mapping for the 68 built-in lifts. Cardio / flexibility
// / timed-hold exercises are intentionally omitted (they don't contribute working
// sets to volume landmarks).
export const EXERCISE_SUBMUSCLES: Record<string, SubMuscleTargets> = {
  // Bodyweight
  'push-up-bodyweight': { primary: ['chest'], secondary: ['front_delts', 'triceps'] },
  'squat-bodyweight': { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'pull-up-bodyweight': { primary: ['lats'], secondary: ['biceps', 'upper_back'] },
  'dip-bodyweight': { primary: ['chest', 'triceps'], secondary: ['front_delts'] },
  'wall-sit-bodyweight': { primary: ['quads'], secondary: ['glutes'] },

  // Barbell
  'squat-barbell': { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back'] },
  'deadlift-barbell': { primary: ['hamstrings', 'glutes', 'lower_back'], secondary: ['lats', 'traps', 'quads'] },
  'bench-press-barbell': { primary: ['chest'], secondary: ['front_delts', 'triceps'] },
  'overhead-press-barbell': { primary: ['front_delts'], secondary: ['side_delts', 'triceps'] },
  'row-barbell': { primary: ['lats', 'upper_back'], secondary: ['biceps', 'rear_delts'] },
  'romanian-deadlift-barbell': { primary: ['hamstrings', 'glutes'], secondary: ['lower_back'] },
  'incline-bench-press-barbell': { primary: ['chest', 'front_delts'], secondary: ['triceps'] },
  'front-squat-barbell': { primary: ['quads'], secondary: ['glutes', 'abs'] },
  'sumo-deadlift-barbell': { primary: ['glutes', 'quads', 'hamstrings'], secondary: ['lower_back', 'traps'] },
  'bicep-curl-barbell': { primary: ['biceps'], secondary: ['forearms'] },
  'hip-thrust-barbell': { primary: ['glutes'], secondary: ['hamstrings'] },
  'lunges-barbell': { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'shrugs-barbell': { primary: ['traps'], secondary: [] },

  // Dumbbell
  'bench-press-dumbbells': { primary: ['chest'], secondary: ['front_delts', 'triceps'] },
  'goblet-squat-dumbbells': { primary: ['quads', 'glutes'], secondary: ['abs'] },
  'shoulder-press-dumbbells': { primary: ['front_delts'], secondary: ['side_delts', 'triceps'] },
  'bicep-curl-dumbbells': { primary: ['biceps'], secondary: ['forearms'] },
  'preacher-curl-dumbbells': { primary: ['biceps'], secondary: [] },
  'tricep-extension-dumbbells': { primary: ['triceps'], secondary: [] },
  'lateral-raise-dumbbells': { primary: ['side_delts'], secondary: [] },
  'walking-lunge-dumbbells': { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'row-dumbbells': { primary: ['lats', 'upper_back'], secondary: ['biceps', 'rear_delts'] },
  'flyes-dumbbells': { primary: ['chest'], secondary: [] },
  'hammer-curl-dumbbells': { primary: ['biceps', 'forearms'], secondary: [] },
  'rear-delt-fly-dumbbells': { primary: ['rear_delts'], secondary: ['upper_back'] },
  'incline-bench-press-dumbbells': { primary: ['chest', 'front_delts'], secondary: ['triceps'] },
  'romanian-deadlift-dumbbells': { primary: ['hamstrings', 'glutes'], secondary: ['lower_back'] },
  'skull-crushers-dumbbells': { primary: ['triceps'], secondary: [] },
  'arnold-press-dumbbells': { primary: ['front_delts', 'side_delts'], secondary: ['triceps'] },
  'hip-thrust-dumbbells': { primary: ['glutes'], secondary: ['hamstrings'] },
  'bulgarian-split-squat-dumbbells': { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'shrugs-dumbbells': { primary: ['traps'], secondary: [] },

  // Cables
  'lat-pulldown-cables': { primary: ['lats'], secondary: ['biceps', 'upper_back'] },
  'row-cables': { primary: ['lats', 'upper_back'], secondary: ['biceps', 'rear_delts'] },
  'bicep-curl-cables': { primary: ['biceps'], secondary: [] },
  'tricep-pushdown-cables': { primary: ['triceps'], secondary: [] },
  'chest-fly-cables': { primary: ['chest'], secondary: [] },
  'lateral-raise-cables': { primary: ['side_delts'], secondary: [] },
  'rear-delt-fly-cables': { primary: ['rear_delts'], secondary: ['upper_back'] },
  'crossover-cables': { primary: ['chest'], secondary: [] },
  'overhead-tricep-extension-cables': { primary: ['triceps'], secondary: [] },

  // Machines
  'leg-press-machine': { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'leg-extension-machine': { primary: ['quads'], secondary: [] },
  'leg-curl-machine': { primary: ['hamstrings'], secondary: [] },
  'bench-press-machine': { primary: ['chest'], secondary: ['front_delts', 'triceps'] },
  'seated-row-machine': { primary: ['lats', 'upper_back'], secondary: ['biceps', 'rear_delts'] },
  'overhead-press-machine': { primary: ['front_delts'], secondary: ['side_delts', 'triceps'] },
  'chest-fly-machine': { primary: ['chest'], secondary: [] },
  'assisted-pull-up-machine': { primary: ['lats'], secondary: ['biceps', 'upper_back'] },
  'hack-squat-machine': { primary: ['quads'], secondary: ['glutes'] },
  'calf-raise-machine': { primary: ['calves'], secondary: [] },
  'hip-thrust-machine': { primary: ['glutes'], secondary: ['hamstrings'] },
  'squat-smith-machine': { primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  'bench-press-smith-machine': { primary: ['chest'], secondary: ['front_delts', 'triceps'] },

  // Kettlebell
  'swing-kettlebell': { primary: ['glutes', 'hamstrings'], secondary: ['lower_back', 'side_delts'] },
  'goblet-squat-kettlebell': { primary: ['quads', 'glutes'], secondary: ['abs'] },
};

// Coarse-group → a representative sub-muscle, for falling back on custom exercises
// that aren't in the map above.
const GROUP_FALLBACK: Record<MuscleGroup, SubMuscle | null> = {
  chest: 'chest', back: 'lats', shoulders: 'side_delts', arms: 'biceps',
  legs: 'quads', glutes: 'glutes', core: 'abs', 'full-body': null,
};

// Resolve an exercise to its sub-muscle targets. Falls back to a best-guess from
// coarse primary muscles for custom / unmapped exercises.
export function getSubMuscles(
  exerciseId: string,
  coarsePrimary?: MuscleGroup[],
): SubMuscleTargets {
  const mapped = EXERCISE_SUBMUSCLES[exerciseId];
  if (mapped) return mapped;
  const primary = (coarsePrimary ?? [])
    .map(g => GROUP_FALLBACK[g])
    .filter((s): s is SubMuscle => s !== null);
  return { primary: [...new Set(primary)], secondary: [] };
}
