// Body graph: per-region state for the 16-region front/back body map.
// A region with a rankable lift (one that has strength standards) gets a
// strength tier; every region also gets a training-volume state, which is what
// unranked regions (traps, forearms, abs, obliques) display. Pure + clock-injectable.
import {
  ALL_BODY_REGIONS,
  BodyRegion,
  regionMeta,
  regionsForExercise,
} from '@/lib/data/bodyRegions';
import {
  calculateStrengthPercentile,
  e1rmLbs,
  getStrengthTier,
  MALE_STANDARDS,
  StrengthTier,
  TIER_THRESHOLDS,
} from '@/lib/data/strengthStandards';
import { DAY_MS } from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { Gender, LoggedWorkout } from '@/types';

export const VOLUME_WINDOW_WEEKS = 4; // sets/week is averaged over this window
export const FRESH_HOURS = 72; // "recently trained" glow
export const SECONDARY_CREDIT = 0.5;

// Weekly-set bands (roughly MEV → MAV for hypertrophy).
export type TrainingLevel = 'none' | 'light' | 'moderate' | 'high';

export function trainingLevel(setsPerWeek: number): TrainingLevel {
  if (setsPerWeek <= 0) return 'none';
  if (setsPerWeek < 6) return 'light';
  if (setsPerWeek < 12) return 'moderate';
  return 'high';
}

export interface BodyGraphProfile {
  bodyWeightLbs: number;
  gender: Gender;
  age?: number;
}

export interface RegionLift {
  exerciseId: string;
  bestE1rmLbs: number;
  percentile: number;
  tier: StrengthTier;
  sets: number; // lifetime working sets, the lift's weight in the region average
}

export interface NextTierTarget {
  tier: StrengthTier;
  exerciseId: string; // the lift that gets there fastest
  targetE1rmLbs: number;
  deltaLbs: number;
}

export interface RegionState {
  region: BodyRegion;
  // Strength (null when no rankable lift trains this region as a primary mover).
  percentile: number | null;
  tier: StrengthTier | null;
  lifts: RegionLift[]; // rankable lifts feeding the tier, strongest first
  next: NextTierTarget | null;
  // Volume (always present).
  setsPerWeek: number; // credited sets/week over VOLUME_WINDOW_WEEKS
  training: TrainingLevel;
  lastTrained: Date | null;
  fresh: boolean;
}

function isRankable(exerciseId: string): boolean {
  return exerciseId in MALE_STANDARDS;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Smallest e1RM (lbs) that reaches `targetPercentile` on a lift, or null if the
// standards cap below it. Percentile is monotonic in e1RM, so bisect.
export function e1rmForPercentile(
  targetPercentile: number,
  exerciseId: string,
  profile: BodyGraphProfile,
): number | null {
  const pct = (w: number) =>
    calculateStrengthPercentile(w, profile.bodyWeightLbs, profile.gender, exerciseId, profile.age);
  let hi = profile.bodyWeightLbs * 8;
  if (pct(hi) < targetPercentile) return null;
  let lo = 0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (pct(mid) >= targetPercentile) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}

function nextTierTarget(
  lifts: RegionLift[],
  percentile: number,
  profile: BodyGraphProfile,
): NextTierTarget | null {
  const next = TIER_THRESHOLDS.find(t => t.threshold > percentile);
  if (!next || lifts.length === 0) return null;
  const totalWeight = lifts.reduce((s, l) => s + l.sets, 0);

  // Raising one lift's percentile by Δ moves the weighted average by Δ·w/W;
  // pick the lift needing the smallest e1RM jump.
  let best: NextTierTarget | null = null;
  for (const lift of lifts) {
    const needed = lift.percentile + ((next.threshold - percentile) * totalWeight) / lift.sets;
    if (needed > 99) continue;
    const target = e1rmForPercentile(needed, lift.exerciseId, profile);
    if (target === null) continue;
    const delta = Math.max(1, target - lift.bestE1rmLbs);
    if (!best || delta < best.deltaLbs) {
      best = { tier: next.label, exerciseId: lift.exerciseId, targetE1rmLbs: target, deltaLbs: delta };
    }
  }
  return best;
}

export function computeBodyGraph(
  history: LoggedWorkout[],
  profile: BodyGraphProfile,
  now: Date = new Date(),
): RegionState[] {
  const windowStart = now.getTime() - VOLUME_WINDOW_WEEKS * 7 * DAY_MS;
  const credited = new Map<BodyRegion, number>();
  const lastTrained = new Map<BodyRegion, number>();
  // Per rankable lift: best e1RM + lifetime working sets.
  const liftStats = new Map<string, { best: number; sets: number }>();

  for (const w of history) {
    const t = new Date(w.createdAt).getTime();
    for (const ex of w.exercises || []) {
      const working = (ex.completedSets || []).filter(s => s.completed && s.isWarmup !== true);
      if (working.length === 0) continue;

      const catalog = getExercise(ex.id);
      const regions = catalog
        ? regionsForExercise(catalog)
        : { primary: [] as BodyRegion[], secondary: [] as BodyRegion[] };

      for (const r of [...regions.primary, ...regions.secondary]) {
        if (t > (lastTrained.get(r) ?? -Infinity)) lastTrained.set(r, t);
      }
      if (t >= windowStart && t <= now.getTime()) {
        for (const r of regions.primary) credited.set(r, (credited.get(r) ?? 0) + working.length);
        for (const r of regions.secondary) {
          credited.set(r, (credited.get(r) ?? 0) + working.length * SECONDARY_CREDIT);
        }
      }

      if (isRankable(ex.id)) {
        const stats = liftStats.get(ex.id) ?? { best: 0, sets: 0 };
        stats.sets += working.length;
        for (const s of working) {
          if (s.weight > 0 && s.reps > 0) stats.best = Math.max(stats.best, e1rmLbs(s.weight, s.reps, s.unit));
        }
        liftStats.set(ex.id, stats);
      }
    }
  }

  // Region → rankable lifts whose primary regions include it.
  const regionLifts = new Map<BodyRegion, RegionLift[]>();
  const canRank = profile.bodyWeightLbs > 0;
  if (canRank) {
    for (const [exerciseId, stats] of liftStats) {
      if (stats.best <= 0) continue;
      const catalog = getExercise(exerciseId);
      if (!catalog) continue;
      const percentile = calculateStrengthPercentile(
        stats.best,
        profile.bodyWeightLbs,
        profile.gender,
        exerciseId,
        profile.age,
      );
      const lift: RegionLift = {
        exerciseId,
        bestE1rmLbs: Math.round(stats.best),
        percentile: Math.round(percentile),
        tier: getStrengthTier(percentile),
        sets: stats.sets,
      };
      for (const r of regionsForExercise(catalog).primary) {
        const list = regionLifts.get(r) ?? [];
        list.push(lift);
        regionLifts.set(r, list);
      }
    }
  }

  const freshCutoff = now.getTime() - FRESH_HOURS * 60 * 60 * 1000;
  return ALL_BODY_REGIONS.map(region => {
    const lifts = (regionLifts.get(region) ?? []).sort((a, b) => b.percentile - a.percentile);
    const totalWeight = lifts.reduce((s, l) => s + l.sets, 0);
    const percentile = lifts.length
      ? Math.round(lifts.reduce((s, l) => s + l.percentile * l.sets, 0) / totalWeight)
      : null;
    const setsPerWeek = round1((credited.get(region) ?? 0) / VOLUME_WINDOW_WEEKS);
    const last = lastTrained.get(region);
    return {
      region,
      percentile,
      tier: percentile === null ? null : getStrengthTier(percentile),
      lifts,
      next: percentile === null ? null : nextTierTarget(lifts, percentile, profile),
      setsPerWeek,
      training: trainingLevel(setsPerWeek),
      lastTrained: last === undefined ? null : new Date(last),
      fresh: last !== undefined && last >= freshCutoff && last <= now.getTime(),
    };
  });
}

function tierRank(tier: StrengthTier): number {
  return TIER_THRESHOLDS.findIndex(t => t.label === tier);
}

// Sub-tier ranks a region must trail the overall tier by to count as lagging.
export const LAGGING_GAP = 2;

// The weakest ranked region, if it trails the overall tier by at least
// LAGGING_GAP sub-tiers (e.g. overall B+, hamstrings C+). Drives Home's nudge.
export function findLaggingRegion(regions: RegionState[], overallPercentile: number): RegionState | null {
  if (overallPercentile <= 0) return null;
  const overallRank = tierRank(getStrengthTier(overallPercentile));
  let worst: RegionState | null = null;
  for (const r of regions) {
    if (r.tier === null) continue;
    if (overallRank - tierRank(r.tier) < LAGGING_GAP) continue;
    if (!worst || (r.percentile ?? 0) < (worst.percentile ?? 0)) worst = r;
  }
  return worst;
}

export function regionLabel(region: BodyRegion): string {
  return regionMeta(region).label;
}
