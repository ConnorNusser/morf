// Account XP ledger, derived purely from workout history (no stored counters).
// Rebuilding from history is what makes XP retroactive: existing users open the
// update already at the level their past training earned. Pure + clock-free.
import { e1rmLbs } from '@/lib/data/strengthStandards';
import { dateKey, weekStart } from '@/lib/utils/utils';
import { DEFAULT_WEEKLY_GOAL } from '@/lib/workout/weeklyGoal';
import { ALL_FEATURED_SECONDARY_LIFTS, ALL_MAIN_LIFTS, LoggedWorkout } from '@/types';
import { Achievement } from './achievements';
import { Rarity } from './rarity';
import { TierMilestone } from './tierTimeline';

export const XP_RULES = {
  workout: 50, // per workout with at least MIN_SETS completed working sets
  minSetsForWorkout: 3,
  perSet: 5,
  maxSetsPerWorkout: 30, // sets beyond this earn nothing (anti-farming)
  pr: 40, // per featured-lift e1RM PR (beating a previous best)
  maxPrsPerWorkout: 3,
  weeklyGoal: 100, // once per Monday-start week, on the session that hits the goal
  tierUp: 150, // per overall-tier rank gained (first tier earned doesn't count)
  streakStep: 0.05, // multiplier gained per consecutive trained week after the first
  streakCap: 1.5,
} as const;

export const ACHIEVEMENT_XP: Record<Rarity, number> = {
  common: 25,
  rare: 50,
  epic: 100,
  legendary: 200,
};

const PR_LIFTS = new Set<string>([...ALL_MAIN_LIFTS, ...ALL_FEATURED_SECONDARY_LIFTS]);

export interface WorkoutXp {
  workoutId: string;
  date: Date;
  base: number; // workout completion
  sets: number; // per-set XP
  prs: number; // PR bonus
  prCount: number;
  multiplier: number; // streak multiplier applied to base + sets + prs
  weeklyGoal: number; // goal bonus (not multiplied)
  tierUp: number; // tier-up bonus (not multiplied)
  total: number;
}

export interface XpLedger {
  totalXp: number;
  workouts: WorkoutXp[]; // chronological
  achievementXp: number; // undated, from currently unlocked achievements
}

export interface XpContext {
  weeklyGoal?: number; // current goal, applied retroactively
  tierTimeline?: TierMilestone[]; // from computeTierTimeline; each step after the first pays tierUp
  achievements?: Achievement[];
}

function isWorkingSet(set: { completed: boolean; isWarmup?: boolean }): boolean {
  return set.completed && set.isWarmup !== true;
}

function streakMultiplier(consecutiveWeeks: number): number {
  return Math.min(XP_RULES.streakCap, 1 + XP_RULES.streakStep * Math.max(0, consecutiveWeeks - 1));
}

export function computeXpLedger(history: LoggedWorkout[], ctx: XpContext = {}): XpLedger {
  const goal = ctx.weeklyGoal ?? DEFAULT_WEEKLY_GOAL;
  const chronological = [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Tier-ups keyed by the day they happened. The timeline's first entry is the
  // first tier earned, not a promotion.
  const tierUpsByDay = new Map<string, number>();
  for (const m of (ctx.tierTimeline ?? []).slice(1)) {
    const k = dateKey(new Date(m.date));
    tierUpsByDay.set(k, (tierUpsByDay.get(k) ?? 0) + 1);
  }

  const bestE1rm = new Map<string, number>();
  const weekDays = new Map<number, Set<string>>(); // week start ms → trained day keys
  const goalPaidWeeks = new Set<number>();
  const tierPaidDays = new Set<string>();
  let lastWeek: number | null = null;
  let streakWeeks = 0;

  const workouts: WorkoutXp[] = [];
  for (const w of chronological) {
    const date = new Date(w.createdAt);
    const wk = weekStart(date).getTime();
    const day = dateKey(date);

    // Consecutive trained weeks, counting this one.
    if (lastWeek === null || wk !== lastWeek) {
      const prev = new Date(wk);
      prev.setDate(prev.getDate() - 7);
      streakWeeks = lastWeek !== null && lastWeek === weekStart(prev).getTime() ? streakWeeks + 1 : 1;
      lastWeek = wk;
    }

    let setCount = 0;
    let prCount = 0;
    for (const ex of w.exercises || []) {
      let sessionBest = 0;
      for (const set of ex.completedSets || []) {
        if (!isWorkingSet(set)) continue;
        setCount++;
        if (PR_LIFTS.has(ex.id) && set.weight > 0 && set.reps > 0) {
          sessionBest = Math.max(sessionBest, e1rmLbs(set.weight, set.reps, set.unit));
        }
      }
      if (sessionBest > 0) {
        const prev = bestE1rm.get(ex.id);
        if (prev !== undefined && sessionBest > prev) prCount++;
        if (prev === undefined || sessionBest > prev) bestE1rm.set(ex.id, sessionBest);
      }
    }

    const counts = setCount >= XP_RULES.minSetsForWorkout;
    const base = counts ? XP_RULES.workout : 0;
    const sets = Math.min(setCount, XP_RULES.maxSetsPerWorkout) * XP_RULES.perSet;
    const cappedPrs = Math.min(prCount, XP_RULES.maxPrsPerWorkout);
    const prs = cappedPrs * XP_RULES.pr;
    const multiplier = streakMultiplier(streakWeeks);

    let weeklyGoal = 0;
    if (counts) {
      const days = weekDays.get(wk) ?? new Set<string>();
      days.add(day);
      weekDays.set(wk, days);
      if (days.size >= goal && !goalPaidWeeks.has(wk)) {
        goalPaidWeeks.add(wk);
        weeklyGoal = XP_RULES.weeklyGoal;
      }
    }

    let tierUp = 0;
    if (!tierPaidDays.has(day) && tierUpsByDay.has(day)) {
      tierPaidDays.add(day);
      tierUp = tierUpsByDay.get(day)! * XP_RULES.tierUp;
    }

    const total = Math.round((base + sets + prs) * multiplier) + weeklyGoal + tierUp;
    workouts.push({
      workoutId: w.id,
      date,
      base,
      sets,
      prs,
      prCount: cappedPrs,
      multiplier,
      weeklyGoal,
      tierUp,
      total,
    });
  }

  const achievementXp = (ctx.achievements ?? [])
    .filter(a => a.unlocked)
    .reduce((sum, a) => sum + (ACHIEVEMENT_XP[a.rarity] ?? 0), 0);

  return {
    totalXp: workouts.reduce((s, w) => s + w.total, 0) + achievementXp,
    workouts,
    achievementXp,
  };
}
