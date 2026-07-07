// Inverse of workoutNoteParser: render a workout back into freeform note syntax
// ("Bench Press 135x8, 155x6") so "repeat last workout" can pre-fill the box.
import { GeneratedWorkout, WorkoutExerciseSession, WorkoutSetCompletion } from '@/types';
import { getExercise } from '@/lib/workout/workouts';

// Real name, or a title-cased id so a missing lookup never blanks the line.
function resolveName(exerciseId: string): string {
  const match = getExercise(exerciseId);
  if (match) return match.name;
  return exerciseId
    .split('-')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// One set -> token: weighted "135x8", bodyweight "x8", timed/cardio "5min"/"30s".
function formatSet(set: WorkoutSetCompletion): string | null {
  if (set.duration && set.duration > 0) {
    const mins = Math.round(set.duration / 60);
    return mins >= 1 ? `${mins}min` : `${set.duration}s`;
  }
  if (set.weight > 0) return `${set.weight}x${set.reps}`;
  if (set.reps > 0) return `x${set.reps}`;
  return null;
}

function formatExercise(exercise: WorkoutExerciseSession): string | null {
  const sets = (exercise.completedSets || []).filter(s => s.completed);
  if (sets.length === 0) return null;
  const tokens = sets.map(formatSet).filter((t): t is string => t !== null);
  if (tokens.length === 0) return null;
  return `${resolveName(exercise.id)} ${tokens.join(', ')}`;
}

export function workoutToNoteText(workout: GeneratedWorkout): string {
  return (workout.exercises || [])
    .map(ex => formatExercise(ex))
    .filter((line): line is string => line !== null)
    .join('\n');
}
