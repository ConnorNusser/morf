// Bodyweight-ratio strength milestones (e.g. "2× bodyweight deadlift") — the
// iconic goals lifters chase. Produced as Achievement items so they flow through
// the same unlocked / new / acknowledge machinery as the other achievements.
import { Achievement } from './achievements';
import { LiftPR } from './personalRecords';
import { Rarity } from './rarity';

interface MilestoneDef {
  liftId: string;
  name: string;
  tiers: { ratio: number; rarity: Rarity }[];
}

// Sensible bodyweight multiples per main lift, with rarity scaling to how hard
// the ratio is to reach (a 2.5× deadlift is far rarer than a 1× bench).
const MILESTONES: MilestoneDef[] = [
  { liftId: 'bench-press-barbell', name: 'Bench', tiers: [{ ratio: 1, rarity: 'rare' }, { ratio: 1.5, rarity: 'epic' }] },
  { liftId: 'squat-barbell', name: 'Squat', tiers: [{ ratio: 1.5, rarity: 'rare' }, { ratio: 2, rarity: 'epic' }] },
  { liftId: 'deadlift-barbell', name: 'Deadlift', tiers: [{ ratio: 2, rarity: 'epic' }, { ratio: 2.5, rarity: 'legendary' }] },
  { liftId: 'overhead-press-barbell', name: 'Press', tiers: [{ ratio: 0.75, rarity: 'rare' }, { ratio: 1, rarity: 'epic' }] },
];

const ratioLabel = (r: number): string => `${r}×`;

// `prs` and `bodyWeight` must share a unit (the ratio is unit-invariant).
export function computeStrengthMilestones(prs: LiftPR[], bodyWeight: number): Achievement[] {
  if (!bodyWeight || bodyWeight <= 0) return [];
  const best = new Map(prs.map(p => [p.exerciseId, p.estimatedOneRM]));
  const out: Achievement[] = [];
  for (const m of MILESTONES) {
    const e1rm = best.get(m.liftId) ?? 0;
    for (const { ratio, rarity } of m.tiers) {
      const targetWeight = ratio * bodyWeight;
      out.push({
        id: `bw-${m.liftId}-${ratio}`,
        title: `${ratioLabel(ratio)} ${m.name}`,
        description: `${m.name} ${ratioLabel(ratio)} bodyweight`,
        icon: 'barbell',
        category: 'strength',
        rarity,
        current: Math.round((e1rm / bodyWeight) * 100), // % of bodyweight
        target: Math.round(ratio * 100),
        unlocked: e1rm >= targetWeight,
        progress: Math.max(0, Math.min(1, e1rm / Math.max(1, targetWeight))),
      });
    }
  }
  return out;
}
