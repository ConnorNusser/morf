// Pure option building for the routine generator flow: the duration/experience
// tables, the starting-hint split, the request options, and the browse filter.
import type { GenerateRoutineOptions, ProgramTemplate, TrainingGoal } from '@/lib/ai/aiRoutineGenerator';
import type { TrainingAdvancement } from '@/types';

export type WorkoutDuration = 30 | 60 | 90 | 120;

export const DURATION_OPTIONS: { id: WorkoutDuration; label: string; exercises: string; min: number; max: number }[] = [
  { id: 30, label: '30 min', exercises: '3-4 exercises', min: 3, max: 4 },
  { id: 60, label: '1 hour', exercises: '~5 exercises', min: 5, max: 5 },
  { id: 90, label: '1.5 hours', exercises: '6-7 exercises', min: 6, max: 7 },
  { id: 120, label: '2 hours', exercises: '~8 exercises', min: 8, max: 8 },
];

export const EXPERIENCE_OPTIONS: { id: TrainingAdvancement; years: number; title: string; desc: string }[] = [
  { id: 'beginner', years: 0, title: 'Less than 1 year', desc: 'New to strength training or returning after a long break' },
  { id: 'intermediate', years: 2, title: '1-3 years', desc: 'Consistent training, comfortable with main lifts' },
  { id: 'advanced', years: 4, title: '3+ years', desc: 'Experienced lifter, pushing significant weight' },
];

// Starting-hint split for the AI; the freeform prompt lets the model adapt it.
export function selectProgramTemplate(goal: TrainingGoal, days: number): ProgramTemplate {
  if (goal === 'strength') {
    return days <= 3 ? 'full_body' : 'strength';
  }
  if (goal === 'hypertrophy') {
    if (days <= 3) return 'ppl';
    if (days === 4) return 'upper_lower';
    return days >= 6 ? 'ppl' : 'bro_split';
  }
  if (goal === 'powerbuilding') {
    if (days <= 3) return 'full_body';
    if (days === 4) return 'upper_lower';
    return 'powerbuilding';
  }
  // recomp, athletic, and general all share the default split mapping
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  return 'ppl';
}

export interface RoutineGeneratorSelections {
  selectedGoal: TrainingGoal | null;
  selectedDays: number | null;
  selectedDuration: WorkoutDuration | null;
  selectedExperience: TrainingAdvancement | null;
  selectedFocus: string[];
  ignoredMuscles: string[];
  includedExercises: string[];
  excludedExercises: string[];
}

// The flow only reaches generation once goal, days, and duration are picked.
export function buildRoutineOptions(selections: RoutineGeneratorSelections): GenerateRoutineOptions {
  const {
    selectedGoal,
    selectedDays,
    selectedDuration,
    selectedExperience,
    selectedFocus,
    ignoredMuscles,
    includedExercises,
    excludedExercises,
  } = selections;
  const experienceLevel = selectedExperience || 'beginner';
  const durationConfig = DURATION_OPTIONS.find(d => d.id === selectedDuration);
  return {
    programTemplate: selectProgramTemplate(selectedGoal!, selectedDays!),
    trainingGoal: selectedGoal!,
    weeklyDays: selectedDays!,
    focusMuscles: selectedFocus.length > 0 ? selectedFocus : undefined,
    ignoredMuscles: ignoredMuscles.length > 0 ? ignoredMuscles : undefined,
    trainingYears: EXPERIENCE_OPTIONS.find(e => e.id === experienceLevel)?.years,
    experienceLevel,
    workoutDuration: selectedDuration!,
    exercisesPerWorkout: durationConfig ? { min: durationConfig.min, max: durationConfig.max } : undefined,
    includedExercises: includedExercises.length > 0 ? includedExercises : undefined,
    excludedExercises: excludedExercises.length > 0 ? excludedExercises : undefined,
  };
}

export interface BrowseExercise {
  id: string;
  name: string;
  muscleGroup: string;
}

// Narrow the browse list by the muscle chip, then by the search text (name or muscle).
export function filterBrowseExercises(
  availableExercises: BrowseExercise[],
  selectedMuscleFilter: string | null,
  exerciseSearchQuery: string
): BrowseExercise[] {
  let exercises = availableExercises;

  if (selectedMuscleFilter) {
    exercises = exercises.filter(e => e.muscleGroup === selectedMuscleFilter);
  }

  if (exerciseSearchQuery.trim()) {
    const query = exerciseSearchQuery.toLowerCase().trim();
    exercises = exercises.filter(e =>
      e.name.toLowerCase().includes(query) ||
      (e.muscleGroup && e.muscleGroup.toLowerCase().includes(query))
    );
  }

  return exercises;
}
