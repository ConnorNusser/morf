import {
  getProfileIcons,
  isProfileIconUnlocked,
  PROFILE_ICONS,
  profileIconName,
  resolveProfileIconId,
} from '../lib/gamification/profileIcons';

describe('profileIcons', () => {
  it('unlocks emblems by level', () => {
    const atL1 = getProfileIcons(1);
    expect(atL1.find(i => i.id === 'barbell')?.unlocked).toBe(true);
    expect(atL1.find(i => i.id === 'flame')?.unlocked).toBe(false);
    const atL10 = getProfileIcons(10);
    expect(atL10.find(i => i.id === 'flame')?.unlocked).toBe(true);
    expect(atL10.find(i => i.id === 'star')?.unlocked).toBe(false); // L13
    expect(atL10.filter(i => i.unlocked).length).toBeGreaterThan(atL1.filter(i => i.unlocked).length);
  });

  it('icons are listed in ascending unlock order', () => {
    for (let i = 1; i < PROFILE_ICONS.length; i++) {
      expect(PROFILE_ICONS[i].unlockLevel).toBeGreaterThanOrEqual(PROFILE_ICONS[i - 1].unlockLevel);
    }
  });

  it('resolves the chosen id, falling back to default when locked or invalid', () => {
    expect(resolveProfileIconId('flame', 5)).toBe('flame'); // unlocked at L2
    expect(resolveProfileIconId('flame', 1)).toBe('barbell'); // locked -> default
    expect(resolveProfileIconId('nope', 50)).toBe('barbell'); // invalid -> default
    expect(resolveProfileIconId(null, 50)).toBe('barbell');
  });

  it('profileIconName falls back to the default icon', () => {
    expect(profileIconName('flame')).toBe('flame');
    expect(profileIconName('nope')).toBe('barbell');
  });

  it('isProfileIconUnlocked respects the threshold', () => {
    expect(isProfileIconUnlocked('rocket', 39)).toBe(false);
    expect(isProfileIconUnlocked('rocket', 40)).toBe(true);
  });
});
