import { Routine } from '@/types';
import { getActiveRoutines, getTodayRoutine } from '../activeRoutine';

// Minimal routine fixture: [id, createdAt day, lastUsed day | null, isActive?]
function r(id: string, created: number, lastUsed: number | null, isActive?: boolean): Routine {
  return {
    id,
    name: id,
    exercises: [],
    createdAt: new Date(2026, 0, created),
    lastUsed: lastUsed == null ? undefined : new Date(2026, 0, lastUsed),
    ...(isActive === undefined ? {} : { isActive }),
  } as Routine;
}

describe('getActiveRoutines', () => {
  it('drops paused routines (isActive === false), keeps active/undefined', () => {
    const list = [r('a', 1, null), r('paused', 2, null, false), r('b', 3, null, true)];
    expect(getActiveRoutines(list).map(x => x.id)).toEqual(['a', 'b']);
  });

  it('orders most-due first: never-used before used, then oldest lastUsed', () => {
    const used2 = r('used2', 1, 2);
    const used5 = r('used5', 1, 5);
    const fresh = r('fresh', 9, null); // never used → most due
    expect(getActiveRoutines([used5, used2, fresh]).map(x => x.id)).toEqual(['fresh', 'used2', 'used5']);
  });

  it('breaks never-used ties by OLDEST created (the tie-break the dash + Up Next now share)', () => {
    const newer = r('newer', 10, null);
    const older = r('older', 2, null);
    expect(getActiveRoutines([newer, older]).map(x => x.id)).toEqual(['older', 'newer']);
  });
});

describe('getTodayRoutine', () => {
  it('returns the most-due active routine when no explicit current', () => {
    const list = [r('newer', 10, null), r('older', 2, null)];
    expect(getTodayRoutine(list, null)?.id).toBe('older');
  });

  it('lets an explicit current routine win', () => {
    const list = [r('older', 2, null)];
    const current = r('pinned', 99, 1);
    expect(getTodayRoutine(list, current)?.id).toBe('pinned');
  });

  it('is null when nothing is active', () => {
    expect(getTodayRoutine([r('paused', 1, null, false)], null)).toBeNull();
  });
});
