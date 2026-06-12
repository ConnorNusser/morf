// Profile emblems — a custom icon the lifter picks to represent their career.
// Every emblem is earned by an accomplishment (a streak, a strength tier, a
// volume/workout milestone), so collecting them rewards diverse training. Pure:
// unlock state is derived from the set of unlocked achievement ids.
import { Achievement } from './achievements';

export interface ProfileIconDef {
  id: string;
  icon: string; // Ionicons name
  label: string;
  achievementId: string | null; // null = always unlocked (the default emblem)
  hint: string; // human "how to unlock"
}

// Curated emblems, each gated on a specific achievement.
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

export const DEFAULT_PROFILE_ICON_ID = 'barbell';

// What's needed to evaluate unlocks — which achievements are unlocked.
export interface IconUnlockContext {
  unlockedAchievementIds: Set<string>;
}

export function iconUnlockContext(achievements: Achievement[]): IconUnlockContext {
  return { unlockedAchievementIds: new Set(achievements.filter(a => a.unlocked).map(a => a.id)) };
}

function defUnlocked(def: ProfileIconDef, ctx: IconUnlockContext): boolean {
  return def.achievementId === null || ctx.unlockedAchievementIds.has(def.achievementId);
}

export interface ProfileIcon extends ProfileIconDef {
  unlocked: boolean;
}

export function getProfileIcons(ctx: IconUnlockContext): ProfileIcon[] {
  return PROFILE_ICONS.map(d => ({ ...d, unlocked: defUnlocked(d, ctx) }));
}

// Emblems that just became available because their gating achievement was newly
// unlocked — for nudging the lifter to go equip their freshly-earned career icon.
export function newlyUnlockedEmblems(newAchievementIds: Set<string>): ProfileIconDef[] {
  return PROFILE_ICONS.filter(d => d.achievementId !== null && newAchievementIds.has(d.achievementId));
}

// Ionicons name for a chosen id, falling back to the default emblem.
export function profileIconName(id: string): string {
  return PROFILE_ICONS.find(d => d.id === id)?.icon ?? PROFILE_ICONS[0].icon;
}

export function isProfileIconUnlocked(id: string, ctx: IconUnlockContext): boolean {
  const def = PROFILE_ICONS.find(d => d.id === id);
  return def ? defUnlocked(def, ctx) : false;
}

// Resolve the id to actually display: the chosen one if still valid + unlocked,
// otherwise the default (guards against a saved id the user no longer qualifies
// for, or a removed icon).
export function resolveProfileIconId(chosenId: string | null, ctx: IconUnlockContext): string {
  if (chosenId && isProfileIconUnlocked(chosenId, ctx)) return chosenId;
  return DEFAULT_PROFILE_ICON_ID;
}
