import { Achievement } from '../lib/gamification/achievements';
import {
  getProfileIcons,
  iconUnlockContext,
  isProfileIconUnlocked,
  PROFILE_ICONS,
  profileIconName,
  resolveProfileIconId,
} from '../lib/gamification/profileIcons';

// Minimal achievement stub — only id + unlocked matter for emblem unlocks.
const ach = (id: string): Achievement => ({ id, unlocked: true } as Achievement);
const ctx = (unlockedIds: string[] = []) => iconUnlockContext(unlockedIds.map(ach));

describe('profileIcons', () => {
  it('keeps the default emblem always unlocked', () => {
    const fresh = getProfileIcons(ctx());
    expect(fresh.find(i => i.id === 'barbell')?.unlocked).toBe(true);
    expect(fresh.find(i => i.id === 'flame')?.unlocked).toBe(false); // needs streak-7
  });

  it('unlocks emblems by their achievement', () => {
    const withAch = getProfileIcons(ctx(['streak-7', 'tier-a']));
    expect(withAch.find(i => i.id === 'flame')?.unlocked).toBe(true);
    expect(withAch.find(i => i.id === 'star')?.unlocked).toBe(true);
    expect(withAch.find(i => i.id === 'skull')?.unlocked).toBe(false); // needs tier-s
  });

  it('every emblem has a hint and a non-default achievement gate', () => {
    for (const def of PROFILE_ICONS) {
      expect(def.hint.length).toBeGreaterThan(0);
      if (def.id !== 'barbell') expect(typeof def.achievementId).toBe('string');
    }
  });

  it('resolves the chosen id, falling back to default when locked or invalid', () => {
    expect(resolveProfileIconId('flame', ctx(['streak-7']))).toBe('flame'); // unlocked
    expect(resolveProfileIconId('flame', ctx())).toBe('barbell'); // achievement missing -> default
    expect(resolveProfileIconId('nope', ctx())).toBe('barbell'); // invalid -> default
    expect(resolveProfileIconId(null, ctx())).toBe('barbell');
  });

  it('profileIconName falls back to the default icon', () => {
    expect(profileIconName('flame')).toBe('flame');
    expect(profileIconName('nope')).toBe('barbell');
  });

  it('isProfileIconUnlocked respects the unlock condition', () => {
    expect(isProfileIconUnlocked('rocket', ctx())).toBe(false); // needs volume-5m
    expect(isProfileIconUnlocked('rocket', ctx(['volume-5m']))).toBe(true);
    expect(isProfileIconUnlocked('barbell', ctx())).toBe(true); // always
  });
});
