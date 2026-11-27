// Presentation helpers for the body graph UI (BodyGraph, MuscleDetailSheet,
// LaggingMuscleCard, MuscleTierUpRow). Pure, so the copy and fill rules are
// unit-tested without rendering.
import { BodyRegion, regionMeta } from '@/lib/data/bodyRegions';
import { StrengthTier } from '@/lib/data/strengthStandards';
import { convertWeight, WeightUnit } from '@/types';
import { NextTierTarget, RegionState, TrainingLevel } from './bodyGraph';

// ---- Fill state ----

export type RegionFill =
  | { kind: 'tier'; tier: StrengthTier }
  | { kind: 'volume'; intensity: number } // 0..1 stripe strength
  | { kind: 'untrained' };

const VOLUME_INTENSITY: Record<Exclude<TrainingLevel, 'none'>, number> = {
  light: 0.45,
  moderate: 0.75,
  high: 1,
};

// Ranked → tier color; unranked with recent volume → hatch scaled by volume;
// otherwise dim neutral.
export function regionFill(state: Pick<RegionState, 'tier' | 'training'> | undefined): RegionFill {
  if (!state) return { kind: 'untrained' };
  if (state.tier) return { kind: 'tier', tier: state.tier };
  if (state.training === 'none') return { kind: 'untrained' };
  return { kind: 'volume', intensity: VOLUME_INTENSITY[state.training] };
}

// ---- Next tier ----

// Weight to add, in the user's unit, rounded up so the number is enough:
// whole lb, or 0.5 kg.
export function roundDelta(deltaLbs: number, unit: WeightUnit): number {
  if (unit === 'kg') return Math.max(0.5, Math.ceil(convertWeight(deltaLbs, 'lbs', 'kg') * 2) / 2);
  return Math.max(1, Math.ceil(deltaLbs));
}

export function unitLabel(unit: WeightUnit): string {
  return unit === 'kg' ? 'kg' : 'lb';
}

// "+12 lb on Bench Press (Barbell) → A-"
export function formatNextTierLine(next: NextTierTarget, exerciseName: string, unit: WeightUnit): string {
  return `+${roundDelta(next.deltaLbs, unit)} ${unitLabel(unit)} on ${exerciseName} → ${next.tier}`;
}

// ---- Weekly sets vs. the 10–20 hypertrophy band ----

export const SETS_TARGET = { min: 10, max: 20 } as const;
const SETS_SCALE_MIN = 25;

export interface SetsBar {
  scale: number; // bar's full-width value
  fill: number; // 0..1
  bandStart: number; // 0..1
  bandEnd: number; // 0..1
  status: 'below' | 'in' | 'above';
}

export function setsBar(setsPerWeek: number): SetsBar {
  const scale = Math.max(SETS_SCALE_MIN, Math.ceil(setsPerWeek));
  const sets = Math.max(0, setsPerWeek);
  return {
    scale,
    fill: Math.min(1, sets / scale),
    bandStart: SETS_TARGET.min / scale,
    bandEnd: SETS_TARGET.max / scale,
    status: sets < SETS_TARGET.min ? 'below' : sets > SETS_TARGET.max ? 'above' : 'in',
  };
}

// 4.5 stays 4.5; 12.3 → 12; whole numbers drop the decimal.
export function formatSetsPerWeek(sets: number): string {
  if (sets >= 10 || Number.isInteger(sets)) return String(Math.round(sets));
  return sets.toFixed(1);
}

// ---- Copy ----

const SINGULAR: ReadonlySet<BodyRegion> = new Set(['chest', 'upper-back', 'lower-back']);

// "Hamstrings are lagging · C tier · 4 sets/wk"
export function laggingLine(state: Pick<RegionState, 'region' | 'tier' | 'setsPerWeek'>): string {
  const label = regionMeta(state.region).label;
  const verb = SINGULAR.has(state.region) ? 'is' : 'are';
  const parts = [`${label} ${verb} lagging`];
  if (state.tier) parts.push(`${state.tier} tier`);
  parts.push(`${formatSetsPerWeek(state.setsPerWeek)} sets/wk`);
  return parts.join(' · ');
}

// "Chest B → B+" / "Quads ranked: C"
export function formatTierUp(up: { region: BodyRegion; from: StrengthTier | null; to: StrengthTier }): string {
  const label = regionMeta(up.region).label;
  return up.from === null ? `${label} ranked: ${up.to}` : `${label} ${up.from} → ${up.to}`;
}

// Free-text request for the AI generator (the PlanBuilder's customRequest):
// the parent MuscleGroup drives exercise selection, the region sets the emphasis.
export function trainRegionRequest(region: BodyRegion): string {
  const meta = regionMeta(region);
  const group = meta.group === 'full-body' ? 'full-body' : meta.group;
  return `A ${group} workout that prioritizes my ${meta.label.toLowerCase()}`;
}

// 1 → "1st", 12 → "12th", 62 → "62nd".
export function ordinal(n: number): string {
  const v = Math.round(n);
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[v % 10] ?? 'th';
  return `${v}${suffix}`;
}

// e1RM in the user's unit, whole numbers.
export function formatE1rm(lbs: number, unit: WeightUnit): string {
  const v = unit === 'kg' ? convertWeight(lbs, 'lbs', 'kg') : lbs;
  return `${Math.round(v)} ${unitLabel(unit)}`;
}

// Minimal region states for a highlight-only graph (completion screen): tier-up
// regions carry their new tier, everything else renders as untrained.
export function tierUpGraphStates(tierUps: { region: BodyRegion; to: StrengthTier }[]): RegionState[] {
  return tierUps.map(({ region, to }) => ({
    region,
    percentile: null,
    tier: to,
    lifts: [],
    next: null,
    setsPerWeek: 0,
    training: 'none',
    lastTrained: null,
    fresh: false,
  }));
}
