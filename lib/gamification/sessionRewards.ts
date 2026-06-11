// The gamification "event backbone". Because every Career number is derived
// purely from workout history, the rewards a single session earned are simply
// the diff between a snapshot taken before the workout and one taken after.
// One pure computeSessionRewards() feeds every surface so they never drift.
import { GeneratedWorkout, WeightUnit } from '@/types';
import { Achievement, computeAchievements } from './achievements';
import { computeBehavioralSignals } from './behavioralSignals';
import { computeCareerStats } from './careerStats';
import { computeNicheAchievements } from './nicheAchievements';
import { computeMainLiftPRs, LiftPR } from './personalRecords';
import { computeStrengthMilestones } from './strengthMilestones';

// The minimal derived state needed to diff two points in a lifter's career.
export interface RewardSnapshot {
  stats: ReturnType<typeof computeCareerStats>;
  achievements: Achievement[];
  prs: LiftPR[];
}

export interface RewardContext {
  unit: WeightUnit;
  overall: number; // overall strength percentile (for tier achievements)
  bodyWeightLbs: number; // for bodyweight-ratio milestones
  now?: Date;
}

// Build the snapshot from a history slice. Mirrors how careerData assembles the
// same fields, so careerData reuses this (see careerData.ts) — single source.
export function buildRewardSnapshot(history: GeneratedWorkout[], ctx: RewardContext): RewardSnapshot {
  const stats = computeCareerStats(history, ctx.unit, ctx.now);
  const milestones = computeStrengthMilestones(computeMainLiftPRs(history, 'lbs'), ctx.bodyWeightLbs);
  const niche = computeNicheAchievements(computeBehavioralSignals(history));
  const achievements = [...computeAchievements(stats, ctx.overall), ...niche, ...milestones];
  return {
    stats,
    achievements,
    prs: computeMainLiftPRs(history, ctx.unit),
  };
}

export interface SessionPR {
  lift: LiftPR;
  previous: number | null; // prior best e1RM, or null if first ever for this lift
}

export interface SessionRewards {
  newAchievements: Achievement[]; // unlocked in `after` but not `before`
  newPRs: SessionPR[]; // main-lift e1RM PRs set this session
  hasRewards: boolean; // anything worth celebrating
}

// Diff two snapshots into the rewards the session between them earned. Pure.
export function computeSessionRewards(before: RewardSnapshot, after: RewardSnapshot): SessionRewards {
  const beforeUnlocked = new Set(before.achievements.filter(a => a.unlocked).map(a => a.id));
  const newAchievements = after.achievements.filter(a => a.unlocked && !beforeUnlocked.has(a.id));

  const beforePRs = new Map(before.prs.map(p => [p.exerciseId, p.estimatedOneRM]));
  const newPRs: SessionPR[] = [];
  for (const lift of after.prs) {
    const prev = beforePRs.has(lift.exerciseId) ? beforePRs.get(lift.exerciseId)! : null;
    if (prev === null || lift.estimatedOneRM > prev) newPRs.push({ lift, previous: prev });
  }

  return {
    newAchievements,
    newPRs,
    hasRewards: newAchievements.length > 0 || newPRs.length > 0,
  };
}

// Format a PR delta for display, e.g. "+15 lbs" or "New PR" for a first-ever lift.
export function formatPRDelta(pr: SessionPR): string {
  if (pr.previous === null) return 'New PR';
  const delta = Math.round(pr.lift.estimatedOneRM - pr.previous);
  return `+${delta} ${pr.lift.unit}`;
}
