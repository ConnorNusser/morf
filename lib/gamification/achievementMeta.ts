// Static achievement metadata by id, so clients can render a badge from just an id.
// Built by running the reward snapshot over an EMPTY history (every def returns locked/zeroed).
import { Rarity } from './rarity';
import { buildRewardSnapshot } from './sessionRewards';

export interface AchievementMeta {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
}

let cache: Map<string, AchievementMeta> | null = null;

export function achievementMeta(id: string): AchievementMeta | undefined {
  if (!cache) {
    const { achievements } = buildRewardSnapshot([], { unit: 'lbs', overall: 0, bodyWeightLbs: 0 });
    cache = new Map(
      achievements.map(a => [
        a.id,
        { id: a.id, title: a.title, description: a.description, icon: a.icon, rarity: a.rarity },
      ]),
    );
  }
  return cache.get(id);
}
