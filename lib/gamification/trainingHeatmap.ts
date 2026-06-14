// A GitHub-style training consistency heatmap — the "don't break the chain"
// visual. Pure + clock-injectable. Columns are Monday-start weeks; each cell is
// a day, flagged trained with a relative-volume intensity (0..1).
import { GeneratedWorkout } from '@/types';
import { dateKey } from '@/lib/utils/utils';
import { getWorkoutById } from '@/lib/workout/workouts';
import { MUSCLE_TO_PPL, PPLCategory } from '@/lib/data/pplCategories';

// A day's dominant split == the dashboard's Push/Pull/Legs categories, so the
// heatmap colors (PPL_COLORS) and classification match the rest of the app.
export type TrainingSplit = PPLCategory;

function classifyExercise(exerciseId: string): PPLCategory | null {
  const muscle = getWorkoutById(exerciseId)?.primaryMuscles?.[0];
  return muscle ? MUSCLE_TO_PPL[muscle] : null;
}

// The category with the most exercises that day — mirrors WeeklyGoalCard's
// dominantPPL (count-based, same push>pull>legs tie-break) so a given day reads
// the same color on the dashboard and in the heatmap.
function dominantSplit(counts: Record<PPLCategory, number>): PPLCategory | null {
  if (counts.push + counts.pull + counts.legs === 0) return null;
  return (['push', 'pull', 'legs'] as PPLCategory[]).reduce((best, c) =>
    counts[c] > counts[best] ? c : best,
  );
}

export interface HeatCell {
  date: Date;
  trained: boolean;
  intensity: number; // 0..1 relative to the user's biggest training day in range
  volume: number; // that day's training volume (in the unit it was logged), for tooltips
  future: boolean; // day hasn't happened yet (current week tail)
  split: TrainingSplit | null; // dominant Push/Pull/Legs that day (null if untrained / unclassified)
}

export interface TrainingHeatmap {
  weeks: HeatCell[][]; // weeks[w] = 7 cells (Mon..Sun)
  totalDays: number; // distinct trained days in range
}

// Discrete shade steps for a trained day, so the scale reads as legible buckets
// (light → heavy volume) instead of a continuous mush. Shared by the card, the
// modal grid and their legends so all three stay in lockstep. The floor is kept
// high so even a light day still reads as its Push/Pull/Legs color (matching the
// solid dots on the dashboard) rather than washing out toward the background.
export const HEAT_OPACITIES = [0.62, 0.75, 0.88, 1] as const;

// Bucket a 0..1 volume intensity into an index into HEAT_OPACITIES.
export function heatLevel(intensity: number): number {
  if (intensity <= 0.25) return 0;
  if (intensity <= 0.5) return 1;
  if (intensity <= 0.75) return 2;
  return 3;
}


function startOfWeekMonday(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // back to Monday
  return s;
}

export function computeTrainingHeatmap(
  workouts: GeneratedWorkout[],
  weeks = 12,
  now: Date = new Date(),
): TrainingHeatmap {
  // Total (un-converted) volume per day — only used for relative intensity —
  // plus per-day volume split into Push/Pull/Legs so each day can be colored.
  const volumeByDay = new Map<string, number>();
  const splitByDay = new Map<string, Record<PPLCategory, number>>();
  for (const w of workouts) {
    const key = dateKey(new Date(w.createdAt));
    let vol = 0;
    const counts = splitByDay.get(key) ?? { push: 0, pull: 0, legs: 0 };
    for (const ex of w.exercises || []) {
      for (const set of ex.completedSets || []) {
        if (set.completed) vol += set.weight * set.reps;
      }
      const cat = classifyExercise(ex.id);
      if (cat) counts[cat] += 1;
    }
    splitByDay.set(key, counts);
    volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + vol);
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = dateKey(today);
  const firstMonday = startOfWeekMonday(today);
  firstMonday.setDate(firstMonday.getDate() - (weeks - 1) * 7);

  // Max daily volume in the rendered range, for normalization.
  let maxVol = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(firstMonday);
    d.setDate(d.getDate() + i);
    maxVol = Math.max(maxVol, volumeByDay.get(dateKey(d)) ?? 0);
  }

  const grid: HeatCell[][] = [];
  let totalDays = 0;
  for (let w = 0; w < weeks; w++) {
    const week: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(firstMonday);
      date.setDate(date.getDate() + w * 7 + d);
      const key = dateKey(date);
      const vol = volumeByDay.get(key) ?? 0;
      const trained = volumeByDay.has(key);
      if (trained) totalDays += 1;
      const splits = splitByDay.get(key);
      week.push({
        date,
        trained,
        intensity: maxVol > 0 ? vol / maxVol : 0,
        volume: Math.round(vol),
        future: key > todayKey,
        split: splits ? dominantSplit(splits) : null,
      });
    }
    grid.push(week);
  }

  return { weeks: grid, totalDays };
}
