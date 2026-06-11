// Weekly training-goal signal for the home dashboard. Pure + clock-injectable,
// matching the style of retentionSignals.ts. Week starts Monday (the common
// training-week convention); index 0 = Monday … 6 = Sunday.
import { GeneratedWorkout } from '@/types';

export const DEFAULT_WEEKLY_GOAL = 4;
export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 7;

// Local YYYY-MM-DD, matching retentionSignals / recapStats.
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Monday 00:00 of the week containing `d`.
function startOfWeek(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay(); // 0 = Sun … 6 = Sat
  const diffToMonday = (day + 6) % 7; // Sun -> 6, Mon -> 0, …
  start.setDate(start.getDate() - diffToMonday);
  return start;
}

export interface WeekProgress {
  daysTrained: number; // distinct days trained this week
  goal: number;
  metGoal: boolean;
  trainedDays: boolean[]; // length 7, index 0 = Monday … 6 = Sunday
  workoutsByDay: GeneratedWorkout[][]; // length 7, workouts logged on each day
  weekStart: Date;
}

export function getWeekProgress(
  workouts: GeneratedWorkout[],
  goal: number = DEFAULT_WEEKLY_GOAL,
  now: Date = new Date()
): WeekProgress {
  const weekStart = startOfWeek(now);

  // Bucket each workout into its day of this week (index 0 = Monday).
  const dayKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    dayKeys.push(dateKey(day));
  }

  const workoutsByDay: GeneratedWorkout[][] = dayKeys.map(() => []);
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
