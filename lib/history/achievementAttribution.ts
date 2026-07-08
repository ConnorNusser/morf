// Pin achievements on the session that earned them by replaying history: per workout
// (oldest→newest) compute career stats through that point and credit any newly-crossed
// achievement. Retroactive, no unlock timestamps. Strength-percentile achievements skip
// (percentile needs per-date bodyweight we don't keep). Cost O(sessions × sets).
import { computeAchievements } from '@/lib/gamification/achievements';
import { computeCareerStats } from '@/lib/gamification/careerStats';
import { Rarity } from '@/lib/gamification/rarity';
import { GeneratedWorkout, WeightUnit } from '@/types';

export interface EarnedAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
}

export function attributeAchievements(
  history: GeneratedWorkout[],
  unit: WeightUnit,
): Record<string, EarnedAchievement[]> {
  const chrono = [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const out: Record<string, EarnedAchievement[]> = {};
  const earned = new Set<string>();
  for (let i = 0; i < chrono.length; i++) {
    // "now" = the session's own date, so time-relative metrics read as they stood that day.
    const stats = computeCareerStats(chrono.slice(0, i + 1), unit, new Date(chrono[i].createdAt));
    for (const a of computeAchievements(stats, 0)) {
      if (!a.unlocked || earned.has(a.id)) continue;
      earned.add(a.id);
      (out[chrono[i].id] ??= []).push({
        id: a.id,
        title: a.title,
        description: a.description,
        icon: a.icon,
        rarity: a.rarity,
      });
    }
  }
  return out;
}
