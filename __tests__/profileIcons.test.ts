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
const ach = (id: string, unlocked: boolean): Achievement =>
  ({ id, unlocked } as Achievement);

const ctx = (level: number, unlockedIds: string[] = []) =>
  iconUnlockContext(level, unlockedIds.map(id => ach(id, true)));

describe('profileIcons', () => {
  it('unlocks level-gated emblems by level', () => {
    const atL1 = getProfileIcons(ctx(1));
    expect(atL1.find(i => i.id === 'barbell')?.unlocked).toBe(true);
    expect(atL1.find(i => i.id === 'flash')?.unlocked).toBe(false); // L5
    const atL5 = getProfileIcons(ctx(5));
    expect(atL5.find(i => i.id === 'flash')?.unlocked).toBe(true);
  });

  it('unlocks achievement-gated emblems by their achievement', () => {
    const noAch = getProfileIcons(ctx(50)); // high level, no achievements
    expect(noAch.find(i => i.id === 'flame')?.unlocked).toBe(false); // needs streak-7
    expect(noAch.find(i => i.id === 'star')?.unlocked).toBe(false); // needs tier-a

    const withAch = getProfileIcons(ctx(1, ['streak-7', 'tier-a']));
    expect(withAch.find(i => i.id === 'flame')?.unlocked).toBe(true);
    expect(withAch.find(i => i.id === 'star')?.unlocked).toBe(true);
    expect(withAch.find(i => i.id === 'skull')?.unlocked).toBe(false); // needs tier-s
  });

  it('every emblem has a hint and a valid unlock', () => {
    for (const def of PROFILE_ICONS) {
      expect(def.hint.length).toBeGreaterThan(0);
      expect(['level', 'achievement']).toContain(def.unlock.kind);
    }
  });

  it('resolves the chosen id, falling back to default when locked or invalid', () => {
    expect(resolveProfileIconId('flame', ctx(1, ['streak-7']))).toBe('flame'); // unlocked
    expect(resolveProfileIconId('flame', ctx(50))).toBe('barbell'); // achievement missing -> default
    expect(resolveProfileIconId('nope', ctx(50))).toBe('barbell'); // invalid -> default
    expect(resolveProfileIconId(null, ctx(50))).toBe('barbell');
  });

  it('profileIconName falls back to the default icon', () => {
    expect(profileIconName('flame')).toBe('flame');
    expect(profileIconName('nope')).toBe('barbell');
  });

  it('isProfileIconUnlocked respects the unlock condition', () => {
    expect(isProfileIconUnlocked('rocket', ctx(34))).toBe(false); // L35
    expect(isProfileIconUnlocked('rocket', ctx(35))).toBe(true);
    expect(isProfileIconUnlocked('skull', ctx(99))).toBe(false); // needs tier-s achievement
    expect(isProfileIconUnlocked('skull', ctx(1, ['tier-s']))).toBe(true);
  });
});
