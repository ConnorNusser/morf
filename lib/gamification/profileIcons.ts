// Profile emblems — a custom icon the lifter picks to represent their career.
// Emblems are earned by accomplishments: some by reaching a level, others by
// earning a specific achievement (a streak, a strength tier, a volume milestone).
// Collecting them rewards diverse training, not just grinding XP. Pure: unlock
// state is derived from the current level + the set of unlocked achievement ids.
import { Achievement } from './achievements';

export type IconUnlock =
  | { kind: 'level'; level: number }
  | { kind: 'achievement'; achievementId: string };

export interface ProfileIconDef {
  id: string;
  icon: string; // Ionicons name
  label: string;
  unlock: IconUnlock;
  hint: string; // human "how to unlock"
}

// Curated emblems — a mix of level rewards and accomplishment unlocks.
export const PROFILE_ICONS: ProfileIconDef[] = [
  { id: 'barbell', icon: 'barbell', label: 'Barbell', unlock: { kind: 'level', level: 1 }, hint: 'Starter emblem' },
  { id: 'flash', icon: 'flash', label: 'Bolt', unlock: { kind: 'level', level: 5 }, hint: 'Reach Level 5' },
  { id: 'flame', icon: 'flame', label: 'Flame', unlock: { kind: 'achievement', achievementId: 'streak-7' }, hint: '7-day training streak' },
  { id: 'fitness', icon: 'fitness', label: 'Athlete', unlock: { kind: 'level', level: 10 }, hint: 'Reach Level 10' },
  { id: 'trophy', icon: 'trophy', label: 'Trophy', unlock: { kind: 'achievement', achievementId: 'workouts-100' }, hint: 'Log 100 workouts' },
  { id: 'shield', icon: 'shield', label: 'Shield', unlock: { kind: 'achievement', achievementId: 'tier-b' }, hint: 'Reach B tier' },
  { id: 'ribbon', icon: 'ribbon', label: 'Ribbon', unlock: { kind: 'achievement', achievementId: 'streak-30' }, hint: '30-day training streak' },
  { id: 'medal', icon: 'medal', label: 'Medal', unlock: { kind: 'achievement', achievementId: 'volume-1m' }, hint: 'Lift 1M total' },
  { id: 'star', icon: 'star', label: 'Star', unlock: { kind: 'achievement', achievementId: 'tier-a' }, hint: 'Reach A tier' },
  { id: 'paw', icon: 'paw', label: 'Beast', unlock: { kind: 'achievement', achievementId: 'session-20k' }, hint: 'Move 20K in one session' },
  { id: 'diamond', icon: 'diamond', label: 'Diamond', unlock: { kind: 'level', level: 20 }, hint: 'Reach Level 20' },
  { id: 'skull', icon: 'skull', label: 'Skull', unlock: { kind: 'achievement', achievementId: 'tier-s' }, hint: 'Reach S tier' },
  { id: 'planet', icon: 'planet', label: 'Planet', unlock: { kind: 'achievement', achievementId: 'volume-10m' }, hint: 'Lift 10M total' },
  { id: 'rocket', icon: 'rocket', label: 'Rocket', unlock: { kind: 'level', level: 35 }, hint: 'Reach Level 35' },
];

export const DEFAULT_PROFILE_ICON_ID = 'barbell';

// What's needed to evaluate unlocks — the level reached and which achievements
// are unlocked. Build it from career data with iconUnlockContext().
export interface IconUnlockContext {
  level: number;
  unlockedAchievementIds: Set<string>;
}

export function iconUnlockContext(level: number, achievements: Achievement[]): IconUnlockContext {
  return {
    level,
    unlockedAchievementIds: new Set(achievements.filter(a => a.unlocked).map(a => a.id)),
  };
}

function defUnlocked(def: ProfileIconDef, ctx: IconUnlockContext): boolean {
  return def.unlock.kind === 'level'
    ? ctx.level >= def.unlock.level
    : ctx.unlockedAchievementIds.has(def.unlock.achievementId);
}

export interface ProfileIcon extends ProfileIconDef {
  unlocked: boolean;
}

export function getProfileIcons(ctx: IconUnlockContext): ProfileIcon[] {
  return PROFILE_ICONS.map(d => ({ ...d, unlocked: defUnlocked(d, ctx) }));
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
