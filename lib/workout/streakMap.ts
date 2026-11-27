// "Workout map" for the streak sheet: a trail of Monday-start weeks — recent
// past, this week ("you are here"), and a few upcoming — with milestone flags
// at streak lengths worth chasing. Pure + clock-injectable; uses the same
// week rules as getWeekStreak (a week counts with ≥1 workout).
import { LoggedWorkout } from '@/types';
import { dateKey, weekStart } from '@/lib/utils/utils';
import { getWeekStreak } from './streak';

export const STREAK_MILESTONES = [4, 8, 12, 26, 52] as const;

export type WeekNodeState = 'goal' | 'trained' | 'missed' | 'current' | 'upcoming';

export interface WeekNode {
  weekStart: Date;
  daysTrained: number; // distinct days with a workout
  goal: number;
  state: WeekNodeState;
  isCurrent: boolean;
  // Streak length this week would bring you to (only for current/upcoming weeks
  // on the live streak, and past weeks inside it).
  streakAt: number | null;
  milestone: number | null; // a STREAK_MILESTONES value reached at this node
}

export interface StreakMap {
  current: number;
  longest: number;
  nextMilestone: number | null;
  weeksToNextMilestone: number | null;
  thisWeek: { daysTrained: number; goal: number; trainedDays: boolean[] }; // Mon..Sun
  nodes: WeekNode[]; // chronological
}

function addWeeks(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + 7 * n);
  return x;
}

export function buildStreakMap(
  history: LoggedWorkout[],
  goal: number,
  now: Date = new Date(),
  pastWeeks = 7,
  futureWeeks = 4,
): StreakMap {
  const streak = getWeekStreak(history, now);
  const thisWeek = weekStart(now);

  // week key → distinct trained day keys
  const days = new Map<string, Set<string>>();
  for (const w of history) {
    const d = new Date(w.createdAt);
    const k = dateKey(weekStart(d));
    const set = days.get(k) ?? new Set<string>();
    set.add(dateKey(d));
    days.set(k, set);
  }
  const countFor = (wk: Date) => days.get(dateKey(wk))?.size ?? 0;

  const trainedDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() + i);
    return (days.get(dateKey(thisWeek))?.has(dateKey(d))) ?? false;
  });

  // The live streak covers the `current` weeks ending at this week (if trained)
  // or last week (this week still open).
  const streakEnd = streak.trainedThisWeek ? thisWeek : addWeeks(thisWeek, -1);
  const streakStart = addWeeks(streakEnd, -(streak.current - 1));
  const nextAfterThisWeek = streak.trainedThisWeek ? streak.current : streak.current + 1;

  const nodes: WeekNode[] = [];
  for (let i = -pastWeeks; i <= futureWeeks; i++) {
    const wk = addWeeks(thisWeek, i);
    const n = countFor(wk);
    const isCurrent = i === 0;
    let state: WeekNodeState;
    if (i > 0) state = 'upcoming';
    else if (isCurrent) state = n >= goal ? 'goal' : 'current';
    else state = n === 0 ? 'missed' : n >= goal ? 'goal' : 'trained';

    let streakAt: number | null = null;
    if (streak.current > 0 && i <= 0 && wk >= streakStart && wk <= streakEnd) {
      streakAt = Math.round((wk.getTime() - streakStart.getTime()) / (7 * 86_400_000)) + 1;
    }
    if (isCurrent && !streak.trainedThisWeek) streakAt = nextAfterThisWeek;
    if (i > 0) streakAt = nextAfterThisWeek + i;

    const milestone =
      streakAt !== null && (STREAK_MILESTONES as readonly number[]).includes(streakAt) ? streakAt : null;
    nodes.push({ weekStart: wk, daysTrained: n, goal, state, isCurrent, streakAt, milestone });
  }

  const nextMilestone = STREAK_MILESTONES.find(m => m > streak.current) ?? null;
  return {
    current: streak.current,
    longest: streak.longest,
    nextMilestone,
    weeksToNextMilestone: nextMilestone === null ? null : nextMilestone - streak.current,
    thisWeek: { daysTrained: countFor(thisWeek), goal, trainedDays },
    nodes,
  };
}
