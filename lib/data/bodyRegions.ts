// Body-graph regions: the 16 muscle areas drawn on the front/back body map.
// Finer than MuscleGroup (which drives PPL colors, heatmaps and AI focusAreas);
// every region rolls up to exactly one MuscleGroup so those keep working.
import { Exercise, MuscleGroup } from '@/types';
import { EXERCISE_REGIONS } from './exerciseRegions';

export type BodyRegion =
  | 'chest'
  | 'shoulders' // front + side delts
  | 'rear-delts'
  | 'traps'
  | 'lats'
  | 'upper-back'
  | 'lower-back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export type BodyView = 'front' | 'back' | 'both';

export interface BodyRegionMeta {
  id: BodyRegion;
  label: string;
  group: MuscleGroup;
  view: BodyView;
}

// Head-to-toe order; also the display order for region lists.
export const BODY_REGIONS: BodyRegionMeta[] = [
  { id: 'traps', label: 'Traps', group: 'back', view: 'back' },
  { id: 'shoulders', label: 'Shoulders', group: 'shoulders', view: 'front' },
  { id: 'rear-delts', label: 'Rear Delts', group: 'shoulders', view: 'back' },
  { id: 'chest', label: 'Chest', group: 'chest', view: 'front' },
  { id: 'lats', label: 'Lats', group: 'back', view: 'back' },
  { id: 'upper-back', label: 'Upper Back', group: 'back', view: 'back' },
  { id: 'lower-back', label: 'Lower Back', group: 'back', view: 'back' },
  { id: 'biceps', label: 'Biceps', group: 'arms', view: 'front' },
  { id: 'triceps', label: 'Triceps', group: 'arms', view: 'back' },
  { id: 'forearms', label: 'Forearms', group: 'arms', view: 'both' },
  { id: 'abs', label: 'Abs', group: 'core', view: 'front' },
  { id: 'obliques', label: 'Obliques', group: 'core', view: 'front' },
  { id: 'glutes', label: 'Glutes', group: 'glutes', view: 'back' },
  { id: 'quads', label: 'Quads', group: 'legs', view: 'front' },
  { id: 'hamstrings', label: 'Hamstrings', group: 'legs', view: 'back' },
  { id: 'calves', label: 'Calves', group: 'legs', view: 'both' },
];

export const ALL_BODY_REGIONS: BodyRegion[] = BODY_REGIONS.map(r => r.id);

const META = new Map(BODY_REGIONS.map(r => [r.id, r]));

export function regionMeta(region: BodyRegion): BodyRegionMeta {
  return META.get(region)!;
}

// Coarse fallback for exercises without an explicit entry (custom exercises):
// each MuscleGroup maps to the region(s) it most plausibly means.
const GROUP_FALLBACK: Record<MuscleGroup, BodyRegion[]> = {
  chest: ['chest'],
  back: ['upper-back', 'lats'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],
  legs: ['quads', 'hamstrings'],
  glutes: ['glutes'],
  core: ['abs'],
  'full-body': [],
};

export function regionsForMuscles(muscles: MuscleGroup[]): BodyRegion[] {
  return [...new Set(muscles.flatMap(m => GROUP_FALLBACK[m] ?? []))];
}

export interface ExerciseRegions {
  primary: BodyRegion[];
  secondary: BodyRegion[];
}

// Regions an exercise trains. Catalog ids use the reviewed explicit map; anything
// else derives from its MuscleGroups so custom exercises still light up the graph.
export function regionsForExercise(
  exercise: Pick<Exercise, 'id' | 'primaryMuscles'> & { secondaryMuscles?: MuscleGroup[] },
): ExerciseRegions {
  const explicit = EXERCISE_REGIONS[exercise.id];
  if (explicit) return { primary: explicit[0], secondary: explicit[1] };
  const primary = regionsForMuscles(exercise.primaryMuscles ?? []);
  const secondary = regionsForMuscles(exercise.secondaryMuscles ?? []).filter(r => !primary.includes(r));
  return { primary, secondary };
}
