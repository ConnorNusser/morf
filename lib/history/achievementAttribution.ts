// Pin achievements on the session that earned them — by replaying history.
//
// For each workout (oldest → newest) we compute career stats over the history
// up to and including it, run the achievement engine, and credit any
// achievement that just crossed its target to that workout. Deterministic and
// retroactive: no unlock timestamps involved, so it works for imported
// history and fresh installs alike.
//
// Strength-percentile achievements are skipped (percentile needs bodyweight
// history we don't keep per-date); everything computable from workouts alone
// (milestones, streaks, volume, heaviest set) attributes exactly.
//
// Cost: O(sessions × total sets) — a prefix stats pass per workout. Trivial at
// realistic history sizes (hundreds of sessions); memoize at the call site.
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
    // "now" is the session's own date, so time-relative metrics (membership
    // length, streaks) read as they stood that day, not as of today.
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
