// Profile emblems the lifter picks; each is gated on an achievement. Unlock state is pure.
import { Achievement } from './achievements';

export interface ProfileIconDef {
  id: string;
  icon: string; // Ionicons name
  label: string;
  achievementId: string | null; // null = always unlocked (the default emblem)
  hint: string; // human "how to unlock"
}

export const PROFILE_ICONS: ProfileIconDef[] = [
  { id: 'barbell', icon: 'barbell', label: 'Barbell', achievementId: null, hint: 'Starter emblem' },
  { id: 'flash', icon: 'flash', label: 'Bolt', achievementId: 'workouts-10', hint: 'Log 10 workouts' },
  { id: 'flame', icon: 'flame', label: 'Flame', achievementId: 'streak-7', hint: '7-day training streak' },
  { id: 'fitness', icon: 'fitness', label: 'Athlete', achievementId: 'workouts-50', hint: 'Log 50 workouts' },
  { id: 'trophy', icon: 'trophy', label: 'Trophy', achievementId: 'workouts-100', hint: 'Log 100 workouts' },
  { id: 'shield', icon: 'shield', label: 'Shield', achievementId: 'tier-b', hint: 'Reach B tier' },
  { id: 'ribbon', icon: 'ribbon', label: 'Ribbon', achievementId: 'streak-30', hint: '30-day training streak' },
  { id: 'medal', icon: 'medal', label: 'Medal', achievementId: 'volume-1m', hint: 'Lift 1M total' },
  { id: 'star', icon: 'star', label: 'Star', achievementId: 'tier-a', hint: 'Reach A tier' },
  { id: 'paw', icon: 'paw', label: 'Beast', achievementId: 'session-20k', hint: 'Move 20K in one session' },
  { id: 'diamond', icon: 'diamond', label: 'Diamond', achievementId: 'days-100', hint: 'Train on 100 days' },
  { id: 'skull', icon: 'skull', label: 'Skull', achievementId: 'tier-s', hint: 'Reach S tier' },
  { id: 'planet', icon: 'planet', label: 'Planet', achievementId: 'volume-10m', hint: 'Lift 10M total' },
  { id: 'rocket', icon: 'rocket', label: 'Rocket', achievementId: 'volume-5m', hint: 'Lift 5M total' },
];

const DEFAULT_PROFILE_ICON_ID = 'barbell';

export interface IconUnlockContext {
  unlockedAchievementIds: Set<string>;
}

export function iconUnlockContext(achievements: Achievement[]): IconUnlockContext {
  return { unlockedAchievementIds: new Set(achievements.filter(a => a.unlocked).map(a => a.id)) };
}

function defUnlocked(def: ProfileIconDef, ctx: IconUnlockContext): boolean {
  return def.achievementId === null || ctx.unlockedAchievementIds.has(def.achievementId);
}

export function isProfileIconUnlocked(id: string, ctx: IconUnlockContext): boolean {
  const def = PROFILE_ICONS.find(d => d.id === id);
  return def ? defUnlocked(def, ctx) : false;
}

// Chosen id if still valid + unlocked, else default (guards stale/removed saved ids).
export function resolveProfileIconId(chosenId: string | null, ctx: IconUnlockContext): string {
  if (chosenId && isProfileIconUnlocked(chosenId, ctx)) return chosenId;
  return DEFAULT_PROFILE_ICON_ID;
}
