// Bodyweight-ratio strength milestones (e.g. "2× bodyweight deadlift") — the
// iconic goals lifters chase. Produced as Achievement items so they flow through
// the same unlocked / new / acknowledge machinery as the other achievements.
import { Achievement } from './achievements';
import { LiftPR } from './personalRecords';

interface MilestoneDef {
  liftId: string;
  name: string;
  ratios: number[];
}

// Sensible bodyweight multiples per main lift.
const MILESTONES: MilestoneDef[] = [
  { liftId: 'bench-press-barbell', name: 'Bench', ratios: [1, 1.5] },
  { liftId: 'squat-barbell', name: 'Squat', ratios: [1.5, 2] },
  { liftId: 'deadlift-barbell', name: 'Deadlift', ratios: [2, 2.5] },
  { liftId: 'overhead-press-barbell', name: 'Press', ratios: [0.75, 1] },
];

const ratioLabel = (r: number): string => (Number.isInteger(r) ? `${r}×` : `${r}×`);

// `prs` and `bodyWeight` must share a unit (the ratio is unit-invariant).
export function computeStrengthMilestones(prs: LiftPR[], bodyWeight: number): Achievement[] {
  if (!bodyWeight || bodyWeight <= 0) return [];
  const best = new Map(prs.map(p => [p.exerciseId, p.estimatedOneRM]));
  const out: Achievement[] = [];
  for (const m of MILESTONES) {
    const e1rm = best.get(m.liftId) ?? 0;
    for (const ratio of m.ratios) {
      const targetWeight = ratio * bodyWeight;
      out.push({
        id: `bw-${m.liftId}-${ratio}`,
        title: `${ratioLabel(ratio)} ${m.name}`,
        description: `${m.name} ${ratioLabel(ratio)} bodyweight`,
        icon: 'barbell',
        category: 'strength',
        current: Math.round((e1rm / bodyWeight) * 100), // % of bodyweight
        target: Math.round(ratio * 100),
        unlocked: e1rm >= targetWeight,
        progress: Math.max(0, Math.min(1, e1rm / Math.max(1, targetWeight))),
      });
    }
  }
  return out;
}
