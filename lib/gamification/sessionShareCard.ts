// Pure derivations behind the post-workout celebration screen and its
// shareable recap card: PR rows, the single-lift brag, the wins line, which
// card layouts are on offer, and the pre-written share text.
import { e1rmLbs, StrengthTier } from '@/lib/data/strengthStandards';
import { formatCompact } from '@/lib/gamification/careerStats';
import { Rarity, rarityRank } from '@/lib/gamification/rarity';
import { SessionRewards } from '@/lib/gamification/sessionRewards';
import { convertWeightForPreference } from '@/lib/utils/utils';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { ParsedExercise, ParsedExerciseSummary } from '@/lib/workout/workoutTextParser';
import { UserProgress, WeightUnit, convertWeight } from '@/types';

export interface PRInfo {
  exerciseName: string;
  exerciseId?: string;
  newPR: number;
  previousPR: number;
  improvement: number;
  percentile?: number;
}

export interface LiftSpotlight {
  name: string;
  percentile: number;
  e1rm: number;
  weight: number;
  reps: number;
}

export type CardVariant = 'overall' | 'lift' | 'prs' | 'achievement' | 'volume';

// Drop trailing "(Equipment)" so PR rows fit on one line.
export const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

// Generated fallback titles ("Workout - 7/9/2026") read as filler on the share
// card — swap them for a clean day-based headline.
export function cardTitleFor(title: string | null | undefined): string {
  const t = (title || '').trim();
  if (t && !/^workout\b/i.test(t)) return t;
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return `${day} workout`;
}

// PR rows from the history diff — the source of truth once rewards land.
export function prsFromRewards(rewards: SessionRewards, userLifts: UserProgress[]): PRInfo[] {
  return rewards.newPRs.map(({ lift, previous }) => ({
    exerciseName: lift.name,
    exerciseId: lift.exerciseId,
    newPR: Math.round(lift.estimatedOneRM),
    previousPR: Math.round(previous ?? 0),
    improvement: previous !== null ? Math.round(lift.estimatedOneRM - previous) : 0,
    percentile: userLifts.find(l => l.workoutId === lift.exerciseId)?.percentileRanking,
  }));
}

// The single-lift brag: the highest-percentile featured lift trained this
// session ("stronger than 85% of Bench Press lifters") — the share moment.
export function findLiftSpotlight(
  exercises: (ParsedExercise | ParsedExerciseSummary)[],
  userLifts: UserProgress[],
  weightUnit: WeightUnit,
): LiftSpotlight | null {
  let best: LiftSpotlight | null = null;
  for (const exercise of exercises) {
    if (!exercise.matchedExerciseId) continue;
    const lift = userLifts.find((l) => l.workoutId === exercise.matchedExerciseId);
    if (!lift || lift.percentileRanking <= 0) continue;
    let top: { e1rm: number; weight: number; reps: number } | null = null;
    for (const set of exercise.sets || []) {
      if ((set.weight || 0) <= 0 || (set.reps || 0) <= 0) continue;
      const e1rm = e1rmLbs(set.weight, set.reps, set.unit);
      const weightPref = set.unit === weightUnit ? set.weight : convertWeight(set.weight, set.unit, weightUnit);
      if (!top || e1rm > top.e1rm) top = { e1rm, weight: weightPref, reps: set.reps };
    }
    if (!top) continue;
    if (!best || lift.percentileRanking > best.percentile) {
      const info = getCatalogExercise(exercise.matchedExerciseId);
      best = {
        name: shortName(info?.name || exercise.name),
        percentile: lift.percentileRanking,
        e1rm: Math.round(weightUnit === 'kg' ? convertWeight(top.e1rm, 'lbs', 'kg') : top.e1rm),
        weight: Math.round(top.weight),
        reps: top.reps,
      };
    }
  }
  return best;
}

// "2 PRs · 1 achievement unlocked" — the session's wins, or nothing at all.
export function buildWinsLine(prCount: number, achCount: number): string | null {
  const parts: string[] = [];
  if (prCount > 0) parts.push(`${prCount} ${prCount === 1 ? 'PR' : 'PRs'}`);
  if (achCount > 0) parts.push(`${achCount} ${achCount === 1 ? 'achievement' : 'achievements'}`);
  return parts.length > 0 ? `${parts.join(' · ')} unlocked` : null;
}

// Session volume (stored in lbs) in the lifter's unit, e.g. "12.4k lbs"; null when nothing was moved.
export function formatVolumeDisplay(volume: number | undefined, weightUnit: WeightUnit): string | null {
  return volume && volume > 0
    ? `${formatCompact(Math.round(convertWeightForPreference(volume, 'lbs', weightUnit)))} ${weightUnit}`
    : null;
}

// The rarest achievement earned this session fronts the achievement card.
export function pickSpotlightAchievement<T extends { rarity: Rarity }>(list: T[]): T | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))[0];
}

// Card layouts on offer — tap the card to flip through them:
// identity, lift brag, PR haul, achievement unlock, and the session's workload.
export function buildCardVariants(has: {
  lift: boolean;
  prs: boolean;
  achievement: boolean;
  volume: boolean;
}): CardVariant[] {
  const v: CardVariant[] = ['overall'];
  if (has.lift) v.push('lift');
  if (has.prs) v.push('prs');
  if (has.achievement) v.push('achievement');
  if (has.volume) v.push('volume');
  return v;
}

// X is text-first → a pre-written brag, no image required.
export function buildSharePostText({
  liftSpotlight,
  overallTier,
  overallAfter,
  volumeDisplay,
  weightUnit,
}: {
  liftSpotlight: LiftSpotlight | null;
  overallTier: StrengthTier | null;
  overallAfter: number;
  volumeDisplay: string | null;
  weightUnit: WeightUnit;
}): string {
  return liftSpotlight
    ? `${liftSpotlight.name} ${liftSpotlight.e1rm} ${weightUnit} 1RM today — stronger than ${liftSpotlight.percentile}% of lifters. Tracked with morf.`
    : overallTier
      ? `Stronger than ${overallAfter}% of lifters. Tracked with morf.`
      : `${volumeDisplay ?? 'A lot'} lifted today. Tracked with morf.`;
}
