// Profile emblems — a custom icon the lifter picks to represent their career.
// Most are cosmetic unlocks earned by leveling up, so personalization doubles as
// a progression reward. Pure: unlock state is derived from the current level.

export interface ProfileIconDef {
  id: string;
  icon: string; // Ionicons name
  label: string;
  unlockLevel: number;
}

// Curated emblems, ascending by unlock level.
export const PROFILE_ICONS: ProfileIconDef[] = [
  { id: 'barbell', icon: 'barbell', label: 'Barbell', unlockLevel: 1 },
  { id: 'flame', icon: 'flame', label: 'Flame', unlockLevel: 2 },
  { id: 'flash', icon: 'flash', label: 'Bolt', unlockLevel: 3 },
  { id: 'fitness', icon: 'fitness', label: 'Athlete', unlockLevel: 5 },
  { id: 'trophy', icon: 'trophy', label: 'Trophy', unlockLevel: 7 },
  { id: 'shield', icon: 'shield', label: 'Shield', unlockLevel: 9 },
  { id: 'ribbon', icon: 'ribbon', label: 'Ribbon', unlockLevel: 11 },
  { id: 'star', icon: 'star', label: 'Star', unlockLevel: 13 },
  { id: 'medal', icon: 'medal', label: 'Medal', unlockLevel: 16 },
  { id: 'paw', icon: 'paw', label: 'Beast', unlockLevel: 19 },
  { id: 'skull', icon: 'skull', label: 'Skull', unlockLevel: 22 },
  { id: 'diamond', icon: 'diamond', label: 'Diamond', unlockLevel: 25 },
  { id: 'planet', icon: 'planet', label: 'Planet', unlockLevel: 30 },
  { id: 'rocket', icon: 'rocket', label: 'Rocket', unlockLevel: 40 },
];

export const DEFAULT_PROFILE_ICON_ID = 'barbell';

export interface ProfileIcon extends ProfileIconDef {
  unlocked: boolean;
}

export function getProfileIcons(level: number): ProfileIcon[] {
  return PROFILE_ICONS.map(d => ({ ...d, unlocked: level >= d.unlockLevel }));
}

// Ionicons name for a chosen id, falling back to the default emblem.
export function profileIconName(id: string): string {
  return PROFILE_ICONS.find(d => d.id === id)?.icon ?? PROFILE_ICONS[0].icon;
}

export function isProfileIconUnlocked(id: string, level: number): boolean {
  const def = PROFILE_ICONS.find(d => d.id === id);
  return def ? level >= def.unlockLevel : false;
}

// Resolve the id to actually display: the chosen one if still valid + unlocked,
// otherwise the default (guards against a saved id the user no longer qualifies
// for, or a removed icon).
export function resolveProfileIconId(chosenId: string | null, level: number): string {
  if (chosenId && isProfileIconUnlocked(chosenId, level)) return chosenId;
  return DEFAULT_PROFILE_ICON_ID;
}
