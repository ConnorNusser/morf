// Routine progress dashboard aggregation: per-routine exercise status, totals, muscle balance.
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { CalculatedRoutine, LoggedWorkout, MuscleGroup } from '@/types';

export type ExerciseStatus = 'improving' | 'stable' | 'declining' | 'new';

export interface WeightDataPoint {
  weight: number;
  date: Date;
  sessionNumber: number;
}

export interface ExerciseProgress {
  exerciseId: string;
  name: string;
  currentWeight: number;
  startWeight: number;
  weightHistory: WeightDataPoint[];
  repBonus: number;
  status: ExerciseStatus;
}

export interface RoutineProgress {
  id: string;
  name: string;
  exercises: ExerciseProgress[];
  completions: number;
  lastWorkoutDate: Date | null;
  improving: number;
  stable: number;
  declining: number;
}

export interface RoutineProgressTotals {
  totalSessions: number;
  totalImproving: number;
  totalStable: number;
  totalDeclining: number;
}

export interface MuscleBalanceAxis {
  key: MuscleGroup;
  label: string;
}

export interface MuscleBalance {
  axes: MuscleBalanceAxis[];
  values: number[];
  max: number;
  total: number;
}

// Next-session guidance for a row, or null when there's nothing to show.
export function getStatusLabel(exercise: Pick<ExerciseProgress, 'status' | 'repBonus'>): string | null {
  if (exercise.status === 'improving' && exercise.repBonus >= 3) return 'Weight ↑ next session';
  if (exercise.status === 'improving' && exercise.repBonus > 0) {
    return `+${exercise.repBonus} rep${exercise.repBonus > 1 ? 's' : ''} per set`;
  }
  if (exercise.status === 'declining') return 'Consider deload';
  return null;
}

export function buildRoutineProgressList(
  calculatedRoutines: CalculatedRoutine[],
  workoutHistory: LoggedWorkout[]
): RoutineProgress[] {
  return calculatedRoutines.map(routine => {
    const exercises: ExerciseProgress[] = [];
    let improving = 0;
    let stable = 0;
    let declining = 0;

    const routineWorkouts = workoutHistory
      .filter(w => w.routineId === routine.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const lastWorkout = routineWorkouts[routineWorkouts.length - 1];
    const lastWorkoutDate = lastWorkout ? new Date(lastWorkout.createdAt) : null;

    for (const exercise of routine.exercises) {
      const weightHistory: WeightDataPoint[] = [];
      let sessionNum = 0;
      for (const workout of routineWorkouts) {
        const ex = workout.exercises.find(e => e.id === exercise.exerciseId);
        if (!ex?.completedSets?.length) continue;
        const completedSets = ex.completedSets.filter(s => s.completed && s.weight > 0);
        if (completedSets.length === 0) continue;
        sessionNum++;
        weightHistory.push({
          weight: Math.max(...completedSets.map(s => s.weight)),
          date: new Date(workout.createdAt),
          sessionNumber: sessionNum,
        });
      }

      const startWeight = weightHistory.length > 0 ? weightHistory[0].weight : 0;
      const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : exercise.workingWeight;

      // Status comes from the reactive engine's indicator (record-anchored).
      let status: ExerciseStatus = 'new';
      if (weightHistory.length === 0) {
        status = 'new';
      } else if (exercise.progression === 'decrease') {
        status = 'declining';
        declining++;
      } else if (exercise.progression === 'increase') {
        status = 'improving';
        improving++;
      } else {
        status = 'stable';
        stable++;
      }

      exercises.push({
        exerciseId: exercise.exerciseId,
        name: exercise.exerciseName,
        currentWeight,
        startWeight,
        weightHistory,
        repBonus: 0,
        status,
      });
    }

    return {
      id: routine.id,
      name: routine.name,
      exercises,
      completions: routineWorkouts.length,
      lastWorkoutDate,
      improving,
      stable,
      declining,
    };
  });
}

export function summarizeRoutineProgress(routineProgressList: RoutineProgress[]): RoutineProgressTotals {
  const totalSessions = routineProgressList.reduce((sum, r) => sum + r.completions, 0);
  const totalImproving = routineProgressList.reduce((sum, r) => sum + r.improving, 0);
  const totalStable = routineProgressList.reduce((sum, r) => sum + r.stable, 0);
  const totalDeclining = routineProgressList.reduce((sum, r) => sum + r.declining, 0);

  return {
    totalSessions,
    totalImproving,
    totalStable,
    totalDeclining,
  };
}

// Working sets per muscle group for the radar; glutes fold into Legs, full-body lifts skipped.
export function computeMuscleBalance(workoutHistory: LoggedWorkout[]): MuscleBalance {
  const axes: MuscleBalanceAxis[] = [
    { key: 'chest', label: 'Chest' },
    { key: 'shoulders', label: 'Shoulders' },
    { key: 'arms', label: 'Arms' },
    { key: 'legs', label: 'Legs' },
    { key: 'core', label: 'Core' },
    { key: 'back', label: 'Back' },
  ];
  const counts: Record<string, number> = {};
  axes.forEach(a => { counts[a.key] = 0; });
  for (const workout of workoutHistory) {
    for (const ex of workout.exercises) {
      const sets = ex.completedSets?.filter(s => s.completed && s.weight > 0).length ?? 0;
      if (!sets) continue;
      let muscle = getCatalogExercise(ex.id)?.primaryMuscles?.[0] as MuscleGroup | undefined;
      if (!muscle || muscle === 'full-body') continue;
      if (muscle === 'glutes') muscle = 'legs';
      if (counts[muscle] !== undefined) counts[muscle] += sets;
    }
  }
  const values = axes.map(a => counts[a.key]);
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, v) => sum + v, 0);
  return { axes, values, max, total };
}
