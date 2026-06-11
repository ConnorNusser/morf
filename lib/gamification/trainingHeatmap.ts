// A GitHub-style training consistency heatmap — the "don't break the chain"
// visual. Pure + clock-injectable. Columns are Monday-start weeks; each cell is
// a day, flagged trained with a relative-volume intensity (0..1).
import { GeneratedWorkout } from '@/types';

export interface HeatCell {
  date: Date;
  trained: boolean;
  intensity: number; // 0..1 relative to the user's biggest training day in range
  future: boolean; // day hasn't happened yet (current week tail)
}

export interface TrainingHeatmap {
  weeks: HeatCell[][]; // weeks[w] = 7 cells (Mon..Sun)
  totalDays: number; // distinct trained days in range
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  // Total (un-converted) volume per day — only used for relative intensity.
  const volumeByDay = new Map<string, number>();
  for (const w of workouts) {
    let vol = 0;
    for (const ex of w.exercises || []) {
      for (const set of ex.completedSets || []) {
        if (set.completed) vol += set.weight * set.reps;
      }
    }
    const key = dateKey(new Date(w.createdAt));
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
      week.push({
        date,
        trained,
        intensity: maxVol > 0 ? vol / maxVol : 0,
        future: key > todayKey,
      });
    }
    grid.push(week);
  }

  return { weeks: grid, totalDays };
}
