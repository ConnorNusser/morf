// Static achievement metadata by id — title/description/icon/rarity are fixed
// per achievement, so any client can render a badge (and its spotlight) from
// just an id string. This is what lets feed posts and profiles share earned
// achievements as tiny id lists: the art and copy are bundled with the app.
//
// Built by running the reward snapshot over an EMPTY history: every achievement
// def comes back (locked, zeroed) carrying its static fields.
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
