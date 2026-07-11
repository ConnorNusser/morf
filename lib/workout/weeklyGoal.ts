// Weekly training-goal signal for the home dashboard. Pure + clock-injectable.
// Week starts Monday; index 0 = Monday … 6 = Sunday.
import { LoggedWorkout, convertWeight } from '@/types';
import { dateKey, weekStart as mondayOf } from '@/lib/utils/utils';

export const DEFAULT_WEEKLY_GOAL = 4;
export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 7;

export interface WeekProgress {
  daysTrained: number; // distinct days trained this week
  goal: number;
  metGoal: boolean;
  trainedDays: boolean[]; // length 7, index 0 = Monday … 6 = Sunday
  workoutsByDay: LoggedWorkout[][]; // length 7, workouts logged on each day
  weekStart: Date;
}

export function getWeekProgress(
  workouts: LoggedWorkout[],
  goal: number = DEFAULT_WEEKLY_GOAL,
  now: Date = new Date()
): WeekProgress {
  const weekStart = mondayOf(now);

  const dayKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    dayKeys.push(dateKey(day));
  }

  const workoutsByDay: LoggedWorkout[][] = dayKeys.map(() => []);
  for (const w of workouts) {
    const idx = dayKeys.indexOf(dateKey(new Date(w.createdAt)));
    if (idx >= 0) workoutsByDay[idx].push(w);
  }

  const trainedDays = workoutsByDay.map(day => day.length > 0);
  const daysTrained = trainedDays.filter(Boolean).length;
  return {
    daysTrained,
    goal,
    metGoal: daysTrained >= goal,
    trainedDays,
    workoutsByDay,
    weekStart,
  };
}

// Training-load summary for the home "This week" card. Volume in lbs (caller
// formats into the user's preferred unit).
export interface WeeklyLoad {
  volumeLbs: number; // Σ weight×reps over completed sets this week
  sets: number; // completed sets this week
  deltaPct: number | null; // % volume change vs last week; null if no prior data
}

function workoutLoad(workout: LoggedWorkout): { volumeLbs: number; sets: number } {
  let volumeLbs = 0;
  let sets = 0;
  for (const exercise of workout.exercises || []) {
    for (const set of exercise.completedSets || []) {
      if (!set.completed) continue;
      sets++;
      volumeLbs += convertWeight(set.weight, set.unit, 'lbs') * set.reps;
    }
  }
  return { volumeLbs, sets };
}

export function getWeeklyLoad(
  workouts: LoggedWorkout[],
  now: Date = new Date()
): WeeklyLoad {
  const thisWeekStart = mondayOf(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  let volumeLbs = 0;
  let sets = 0;
  let prevVolumeLbs = 0;
  for (const workout of workouts) {
    const created = new Date(workout.createdAt);
    if (created >= thisWeekStart) {
      const load = workoutLoad(workout);
      volumeLbs += load.volumeLbs;
      sets += load.sets;
    } else if (created >= lastWeekStart) {
      prevVolumeLbs += workoutLoad(workout).volumeLbs;
    }
  }

  const deltaPct =
    prevVolumeLbs > 0 ? Math.round(((volumeLbs - prevVolumeLbs) / prevVolumeLbs) * 100) : null;
  return { volumeLbs: Math.round(volumeLbs), sets, deltaPct };
}
