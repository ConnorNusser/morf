// Session rewards = diff between a snapshot taken before a workout and one taken after.
// One pure computeSessionRewards() feeds every surface so they never drift.
import { GeneratedWorkout, WeightUnit } from '@/types';
import { Achievement, computeAchievements } from './achievements';
import { computeNextUnlocks, NextUnlock } from './nextUnlocks';
import { computeSessionBonuses, SessionBonus } from './sessionBonuses';
import { computeBehavioralSignals } from './behavioralSignals';
import { computeCareerStats } from './careerStats';
import { computeNicheAchievements } from './nicheAchievements';
import { computeFeaturedLiftPRs, computeMainLiftPRs, LiftPR } from './personalRecords';
import { computeStrengthFeats } from './strengthFeats';
import { computeStrengthMilestones } from './strengthMilestones';

// Minimal derived state needed to diff two points in a lifter's career.
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

// Build the snapshot from a history slice; careerData reuses this so fields never drift.
export function buildRewardSnapshot(history: GeneratedWorkout[], ctx: RewardContext): RewardSnapshot {
  const stats = computeCareerStats(history, ctx.unit, ctx.now);
  const prsLbs = computeMainLiftPRs(history, 'lbs');
  const milestones = computeStrengthMilestones(prsLbs, ctx.bodyWeightLbs);
  const feats = computeStrengthFeats(prsLbs);
  const niche = computeNicheAchievements(computeBehavioralSignals(history));
  const achievements = [...computeAchievements(stats, ctx.overall), ...niche, ...feats, ...milestones];
  return {
    stats,
    achievements,
    // Featured (main + secondary) so the celebration diff covers every lift the
    // app treats as PR-worthy; feats/milestones above stay main-lift-only.
    prs: computeFeaturedLiftPRs(history, ctx.unit),
  };
}

export interface SessionPR {
  lift: LiftPR;
  previous: number | null; // prior best e1RM, or null if first ever for this lift
}

export interface SessionRewards {
  newAchievements: Achievement[]; // unlocked in `after` but not `before`
  newPRs: SessionPR[]; // featured-lift (main + secondary) e1RM PRs set this session
  bonuses: SessionBonus[]; // surprise callouts (variable reward — see sessionBonuses.ts)
  nextUnlocks: NextUnlock[]; // nearest locked achievements (goal gradient — see nextUnlocks.ts)
  hasRewards: boolean; // anything worth celebrating
}

export function computeSessionRewards(before: RewardSnapshot, after: RewardSnapshot): SessionRewards {
  const beforeUnlocked = new Set(before.achievements.filter(a => a.unlocked).map(a => a.id));
  const newAchievements = after.achievements.filter(a => a.unlocked && !beforeUnlocked.has(a.id));

  const beforePRs = new Map(before.prs.map(p => [p.exerciseId, p.estimatedOneRM]));
  const newPRs: SessionPR[] = [];
  for (const lift of after.prs) {
    const prev = beforePRs.has(lift.exerciseId) ? beforePRs.get(lift.exerciseId)! : null;
    if (prev === null || lift.estimatedOneRM > prev) newPRs.push({ lift, previous: prev });
  }

  // Don't repeat what an unlock already says: an achievement earned this session
  // outranks a bonus about the same fact, and celebrating one fact twice
  // devalues both. Map each bonus to the achievement families that cover it.
  const bonusOverlaps: Record<string, (achievementId: string) => boolean> = {
    'volume-boundary': id => id.startsWith('volume-'),
    'biggest-session': id => id.startsWith('session-'),
    'day-streak-record': id => id.startsWith('streak-'),
    'heaviest-set': id => id.startsWith('plates-'),
  };
  const bonuses = computeSessionBonuses(before, after).filter(bonus => {
    const overlaps = bonusOverlaps[bonus.id];
    return !overlaps || !newAchievements.some(a => overlaps(a.id));
  });

  return {
    newAchievements,
    newPRs,
    bonuses,
    nextUnlocks: computeNextUnlocks(after.achievements, 2, before.achievements),
    hasRewards: newAchievements.length > 0 || newPRs.length > 0 || bonuses.length > 0,
  };
}

// Format a PR delta, e.g. "+15 lbs" or "New PR" for a first-ever lift.
export function formatPRDelta(pr: SessionPR): string {
  if (pr.previous === null) return 'New PR';
  const delta = Math.round(pr.lift.estimatedOneRM - pr.previous);
  return `+${delta} ${pr.lift.unit}`;
}
