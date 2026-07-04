// "Next milestone" — the single lift closest to a meaningful round/plate target.
// Grounded in goal-gradient / endowed-progress research: framing reflection as
// movement toward a NEAR target is the strongest evidence-backed motivation lever,
// so we surface the one target the lifter is closest to actually hitting.
import { ExerciseWithMax, WeightUnit } from '@/types';

export interface NextMilestone {
  exerciseId: string;
  label: string;   // e.g. "3-plate Squat" or "300-lb Deadlift"
  gap: number;     // how far away, in the display unit
  unit: WeightUnit;
}

// Plate totals (bar + full plates per side) → the culturally resonant targets.
// lbs: 45 bar + 45s. kg: 20 bar + 20s.
const PLATES: Record<WeightUnit, Record<number, number>> = {
  lbs: { 135: 1, 225: 2, 315: 3, 405: 4, 495: 5 },
  kg: { 60: 1, 100: 2, 140: 3, 180: 4, 220: 5 },
};
// Round numbers fill the gaps between plates so there's usually a target in reach.
const ROUNDS: Record<WeightUnit, number[]> = {
  lbs: [100, 150, 200, 250, 300, 350, 400, 450, 500],
  kg: [50, 80, 120, 160, 200, 240],
};
// How close (absolute + relative) a target must be to feel attainable — the
// goal-gradient pull is strongest near the target, and a far-off number is just noise.
const MAX_GAP: Record<WeightUnit, number> = { lbs: 25, kg: 12 };
const MAX_GAP_PCT = 0.08;

const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

function milestoneSet(unit: WeightUnit): number[] {
  return [...new Set([...Object.keys(PLATES[unit]).map(Number), ...ROUNDS[unit]])].sort((a, b) => a - b);
}

/**
 * The lift closest to its next round/plate milestone, or null if nothing is within
 * reach. Picks the smallest RELATIVE gap so the most-attainable target wins.
 */
export function nextMilestone(exercises: ExerciseWithMax[], unit: WeightUnit): NextMilestone | null {
  const targets = milestoneSet(unit);
  const plates = PLATES[unit];
  let best: (NextMilestone & { rel: number }) | null = null;

  for (const ex of exercises) {
    if (ex.metric === 'bodyweight' || ex.maxWeight <= 0) continue;
    const next = targets.find(t => t > ex.maxWeight);
    if (!next) continue;
    const gap = next - ex.maxWeight;
    if (gap > MAX_GAP[unit] || gap > next * MAX_GAP_PCT) continue;

    const isBarbell = /barbell/i.test(ex.id) || /\(barbell\)/i.test(ex.name);
    const plateCount = plates[next];
    const unitAdj = unit === 'lbs' ? 'lb' : 'kg'; // singular as an adjective: "200-lb", not "200-lbs"
    const label = isBarbell && plateCount
      ? `${plateCount}-plate ${shortName(ex.name)}`
      : `${next}-${unitAdj} ${shortName(ex.name)}`;

    const rel = gap / next;
    if (!best || rel < best.rel) best = { exerciseId: ex.id, label, gap, unit, rel };
  }

  return best ? { exerciseId: best.exerciseId, label: best.label, gap: best.gap, unit: best.unit } : null;
}
