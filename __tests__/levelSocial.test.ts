import {
  LevelBoardRow,
  levelPlacement,
  levelUserDataPatch,
  mergeUserData,
  parseSyncedLevel,
  patchIsNoop,
  rankLevelBoard,
} from '@/lib/gamification/levelSocial';
import { levelForXp } from '@/lib/gamification/levelCurve';
import { RemoteUserData } from '@/types';

const row = (userId: string, level: number, totalXp: number, username = userId): LevelBoardRow => ({
  userId,
  username,
  level,
  totalXp,
});

describe('levelUserDataPatch', () => {
  it('maps a LevelProgress to snake_case jsonb fields', () => {
    const lp = levelForXp(1234);
    expect(levelUserDataPatch(lp)).toEqual({ level: lp.level, total_xp: 1234 });
  });

  it('floors and clamps', () => {
    expect(levelUserDataPatch({ level: 0, totalXp: -5.5 })).toEqual({ level: 1, total_xp: 0 });
    expect(levelUserDataPatch({ level: 3.9, totalXp: 400.7 })).toEqual({ level: 3, total_xp: 400 });
  });
});

describe('mergeUserData', () => {
  it('keeps keys the patch does not mention', () => {
    const existing: RemoteUserData = { featured_achievement_id: 'first-workout', instagram_username: 'lifter', level: 2 };
    expect(mergeUserData(existing, { level: 5, total_xp: 900 })).toEqual({
      featured_achievement_id: 'first-workout',
      instagram_username: 'lifter',
      level: 5,
      total_xp: 900,
    });
  });

  it('deletes keys set to explicit undefined', () => {
    const merged = mergeUserData<RemoteUserData>({ featured_achievement_id: 'x', level: 3 }, { featured_achievement_id: undefined });
    expect(merged).toEqual({ level: 3 });
    expect('featured_achievement_id' in merged).toBe(false);
  });

  it('handles a null blob', () => {
    expect(mergeUserData<RemoteUserData>(null, { level: 1, total_xp: 0 })).toEqual({ level: 1, total_xp: 0 });
  });

  it('does not mutate the input', () => {
    const existing: RemoteUserData = { level: 1 };
    mergeUserData(existing, { level: 2 });
    expect(existing).toEqual({ level: 1 });
  });
});

describe('patchIsNoop', () => {
  it('is true only when every patched key already matches', () => {
    expect(patchIsNoop({ level: 4, total_xp: 700, gender: 'male' }, { level: 4, total_xp: 700 })).toBe(true);
    expect(patchIsNoop({ level: 4, total_xp: 650 }, { level: 4, total_xp: 700 })).toBe(false);
    expect(patchIsNoop(null, { level: 1, total_xp: 0 })).toBe(false);
  });
});

describe('parseSyncedLevel', () => {
  it('reads numeric jsonb values', () => {
    expect(parseSyncedLevel({ level: 7, total_xp: 1500 })).toEqual({ level: 7, totalXp: 1500 });
  });

  it('accepts numeric strings', () => {
    expect(parseSyncedLevel({ level: '7', total_xp: '1500' })).toEqual({ level: 7, totalXp: 1500 });
  });

  it('is null without a usable level (no chip, off the board)', () => {
    expect(parseSyncedLevel(null)).toBeNull();
    expect(parseSyncedLevel({})).toBeNull();
    expect(parseSyncedLevel({ level: null, total_xp: 100 })).toBeNull();
    expect(parseSyncedLevel({ level: 0 })).toBeNull();
    expect(parseSyncedLevel({ level: 'abc' })).toBeNull();
  });

  it('falls back to 0 XP when total_xp is missing or garbled', () => {
    expect(parseSyncedLevel({ level: 3 })).toEqual({ level: 3, totalXp: 0 });
    expect(parseSyncedLevel({ level: 3, total_xp: 'x' })).toEqual({ level: 3, totalXp: 0 });
  });
});

describe('rankLevelBoard', () => {
  it('sorts by level, then total XP, then username', () => {
    const ranked = rankLevelBoard([row('a', 3, 400), row('b', 5, 900), row('c', 5, 1000), row('e', 3, 400), row('d', 3, 400)]);
    expect(ranked.map(r => r.userId)).toEqual(['c', 'b', 'a', 'd', 'e']);
  });

  it("replaces the viewer's synced row with their local level", () => {
    const ranked = rankLevelBoard([row('me', 2, 200), row('x', 4, 600)], row('me', 6, 1200));
    expect(ranked.map(r => [r.userId, r.level])).toEqual([['me', 6], ['x', 4]]);
  });

  it('inserts the viewer only when asked (complete boards like Friends)', () => {
    const board = [row('x', 4, 600)];
    expect(rankLevelBoard(board, row('me', 2, 200)).map(r => r.userId)).toEqual(['x']);
    expect(rankLevelBoard(board, row('me', 2, 200), { insertMe: true }).map(r => r.userId)).toEqual(['x', 'me']);
  });

  it('does not mutate the input', () => {
    const board = [row('a', 1, 0), row('b', 2, 200)];
    rankLevelBoard(board, row('a', 9, 5000));
    expect(board.map(r => r.level)).toEqual([1, 2]);
  });
});

describe('levelPlacement', () => {
  const board = rankLevelBoard([row('a', 8, 2000), row('b', 6, 1300), row('c', 4, 700)]);

  it('uses the in-list slot when the viewer is on the board', () => {
    const ranked = rankLevelBoard([...board, row('me', 1, 0)], row('me', 6, 1250));
    expect(levelPlacement(ranked, { userId: 'me', level: 6, totalXp: 1250 })).toEqual({
      rank: 3,
      xpToPass: 51,
      aheadName: 'b',
    });
  });

  it('places an off-board viewer by level then XP; ties stay behind', () => {
    expect(levelPlacement(board, { userId: 'me', level: 6, totalXp: 1300 })).toEqual({
      rank: 3,
      xpToPass: 1,
      aheadName: 'b',
    });
    expect(levelPlacement(board, { userId: 'me', level: 9, totalXp: 2500 })).toEqual({
      rank: 1,
      xpToPass: null,
      aheadName: null,
    });
  });

  it('reports an unknown rank below a full top-N board', () => {
    expect(levelPlacement(board, { userId: 'me', level: 1, totalXp: 0 }, 3)).toEqual({
      rank: null,
      xpToPass: null,
      aheadName: null,
    });
    // Not full → the last slot is a real rank.
    expect(levelPlacement(board, { userId: 'me', level: 1, totalXp: 0 }, 50).rank).toBe(4);
  });
});
