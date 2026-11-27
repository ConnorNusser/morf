// Session rewards = diff between a snapshot taken before a workout and one taken after.
// One pure computeSessionRewards() feeds every surface so they never drift.
import { BodyRegion } from '@/lib/data/bodyRegions';
import { StrengthTier, TIER_THRESHOLDS } from '@/lib/data/strengthStandards';
import { Gender, LoggedWorkout, WeightUnit } from '@/types';
import { LeagueWeekResult } from '@/lib/leagues/results';
import { Achievement, computeAchievements } from './achievements';
import { computeBehavioralSignals } from './behavioralSignals';
import { computeCareerStats } from './careerStats';
import { computeLeagueAchievements } from './leagueAchievements';
import { computeNicheAchievements } from './nicheAchievements';
import { computeFeaturedLiftPRs, computeMainLiftPRs, LiftPR } from './personalRecords';
import { computeStrengthFeats } from './strengthFeats';
import { computeStrengthMilestones } from './strengthMilestones';
import { computeBodyGraph } from './bodyGraph';
import { levelForXp, LevelProgress } from './levelCurve';
import { computeTierTimeline } from './tierTimeline';
import { computeXpLedger, WorkoutXp, XpLedger } from './xp';

// Minimal derived state needed to diff two points in a lifter's career.
export interface RewardSnapshot {
  stats: ReturnType<typeof computeCareerStats>;
  achievements: Achievement[];
  prs: LiftPR[];
  xp: XpLedger;
  level: LevelProgress;
  // Strength tier per body region (null = unranked). Empty without gender + bodyweight.
  regionTiers: Partial<Record<BodyRegion, StrengthTier | null>>;
}

export interface RewardContext {
  unit: WeightUnit;
  overall: number; // overall strength percentile (for tier achievements)
  bodyWeightLbs: number; // for bodyweight-ratio milestones
  now?: Date;
  // Closed-week league finishes (lib/leagues/results storage) — the one achievement
  // input not derivable from history. Omitted → league achievements show locked.
  leagueResults?: LeagueWeekResult[];
  // For XP (weekly-goal bonus, tier-ups) and body-graph tiers. Omitted gender →
  // no tier-up XP and no region tiers; everything else still computes.
  weeklyGoal?: number;
  gender?: Gender;
  age?: number;
}

// Build the snapshot from a history slice; careerData reuses this so fields never drift.
export function buildRewardSnapshot(history: LoggedWorkout[], ctx: RewardContext): RewardSnapshot {
  const stats = computeCareerStats(history, ctx.unit, ctx.now);
  const prsLbs = computeMainLiftPRs(history, 'lbs');
  const milestones = computeStrengthMilestones(prsLbs, ctx.bodyWeightLbs);
  const feats = computeStrengthFeats(prsLbs);
  const niche = computeNicheAchievements(computeBehavioralSignals(history));
  const league = computeLeagueAchievements(ctx.leagueResults ?? []);
  const achievements = [...computeAchievements(stats, ctx.overall), ...niche, ...feats, ...milestones, ...league];

  const profile =
    ctx.gender && ctx.bodyWeightLbs > 0
      ? { bodyWeightLbs: ctx.bodyWeightLbs, gender: ctx.gender, age: ctx.age }
      : null;
  // Tier-up XP uses the fixed main-lift set (not the user's visible-lift filter),
  // so hiding a lift on the dashboard never changes XP.
  const xp = computeXpLedger(history, {
    weeklyGoal: ctx.weeklyGoal,
    tierTimeline: profile ? computeTierTimeline(history, profile) : [],
    achievements,
  });
  const regionTiers: RewardSnapshot['regionTiers'] = {};
  if (profile) {
    for (const r of computeBodyGraph(history, profile, ctx.now)) regionTiers[r.region] = r.tier;
  }

  return {
    stats,
    achievements,
    // Featured (main + secondary) so the celebration diff covers every lift the
    // app treats as PR-worthy; feats/milestones above stay main-lift-only.
    prs: computeFeaturedLiftPRs(history, ctx.unit),
    xp,
    level: levelForXp(xp.totalXp),
    regionTiers,
  };
}

export interface SessionPR {
  lift: LiftPR;
  previous: number | null; // prior best e1RM, or null if first ever for this lift
}

export interface RegionTierUp {
  region: BodyRegion;
  from: StrengthTier | null; // null = region newly ranked
  to: StrengthTier;
}

export interface SessionRewards {
  newAchievements: Achievement[]; // unlocked in `after` but not `before`
  newPRs: SessionPR[]; // featured-lift (main + secondary) e1RM PRs set this session
  hasRewards: boolean; // anything worth celebrating (achievements / PRs)
  xpGained: number;
  levelBefore: LevelProgress;
  levelAfter: LevelProgress;
  leveledUp: boolean;
  regionTierUps: RegionTierUp[];
  // XP row of the session just logged (newest workout in `after` absent from
  // `before`) — the "50 workout · 90 sets · …" breakdown. Undefined if none.
  sessionXp?: WorkoutXp;
  // Achievement XP earned this session (not part of sessionXp).
  achievementXpGained: number;
}

const tierRank = (t: StrengthTier) => TIER_THRESHOLDS.findIndex(x => x.label === t);

export function computeSessionRewards(before: RewardSnapshot, after: RewardSnapshot): SessionRewards {
  const beforeUnlocked = new Set(before.achievements.filter(a => a.unlocked).map(a => a.id));
  const newAchievements = after.achievements.filter(a => a.unlocked && !beforeUnlocked.has(a.id));

  const beforePRs = new Map(before.prs.map(p => [p.exerciseId, p.estimatedOneRM]));
  const newPRs: SessionPR[] = [];
  for (const lift of after.prs) {
    const prev = beforePRs.has(lift.exerciseId) ? beforePRs.get(lift.exerciseId)! : null;
    if (prev === null || lift.estimatedOneRM > prev) newPRs.push({ lift, previous: prev });
  }

  const regionTierUps: RegionTierUp[] = [];
  for (const [region, to] of Object.entries(after.regionTiers) as [BodyRegion, StrengthTier | null][]) {
    if (!to) continue;
    const from = before.regionTiers[region] ?? null;
    if (from === null || tierRank(to) > tierRank(from)) regionTierUps.push({ region, from, to });
  }

  const beforeIds = new Set(before.xp.workouts.map(w => w.workoutId));
  let sessionXp: WorkoutXp | undefined;
  for (const w of after.xp.workouts) {
    if (beforeIds.has(w.workoutId)) continue;
    if (!sessionXp || w.date.getTime() >= sessionXp.date.getTime()) sessionXp = w;
  }

  return {
    newAchievements,
    newPRs,
    hasRewards: newAchievements.length > 0 || newPRs.length > 0,
    xpGained: Math.max(0, after.xp.totalXp - before.xp.totalXp),
    levelBefore: before.level,
    levelAfter: after.level,
    leveledUp: after.level.level > before.level.level,
    regionTierUps,
    sessionXp,
    achievementXpGained: Math.max(0, after.xp.achievementXp - before.xp.achievementXp),
  };
}
