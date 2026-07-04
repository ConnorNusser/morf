// Render a saved workout back into the freeform note syntax the parser reads,
// so "repeat last workout" can pre-fill the note box with editable text. This
// is the inverse of workoutNoteParser: GeneratedWorkout -> "Bench Press 135x8, 155x6".
import { GeneratedWorkout, WorkoutExerciseSession, WorkoutSetCompletion } from '@/types';
import { getExercise } from '@/lib/workout/workouts';

// Turn an exercise id into something human-readable, preferring the real name
// but degrading to a title-cased id so a missing lookup never blanks the line.
function resolveName(exerciseId: string): string {
  const match = getExercise(exerciseId);
  if (match) return match.name;
  return exerciseId
    .split('-')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// One completed set -> note token. Weighted: "135x8"; bodyweight: "x8";
// timed/cardio fall back to their duration so the line still round-trips.
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

/** Format a saved workout as editable note text, one exercise per line. */
export function workoutToNoteText(workout: GeneratedWorkout): string {
  return (workout.exercises || [])
    .map(ex => formatExercise(ex))
    .filter((line): line is string => line !== null)
    .join('\n');
}
