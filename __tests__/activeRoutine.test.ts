import { Program, Routine } from '../types';
import { getActiveRoutines, getUpNextRoutine, orderByDue } from '../lib/workout/activeRoutine';

// Minimal routine fixture — the resolver only reads these fields.
function r(
  id: string,
  opts: { lastUsed?: Date; createdAt?: Date; isActive?: boolean; programId?: string } = {}
): Routine {
  return {
    id,
    name: id,
    exercises: [],
    createdAt: opts.createdAt ?? new Date(2026, 0, 1),
    lastUsed: opts.lastUsed,
    isActive: opts.isActive,
    programId: opts.programId,
  } as unknown as Routine;
}

function prog(id: string, status: Program['status']): Program {
  return { id, name: id, status, createdAt: new Date(2026, 0, 1), days: 0 } as unknown as Program;
}

const days = (offset: number) => new Date(2026, 5, 10 - offset);

describe('orderByDue', () => {
  it('puts never-used routines first (most due)', () => {
    const used = r('used', { lastUsed: days(1) });
    const fresh = r('fresh');
    expect(orderByDue([used, fresh]).map(x => x.id)).toEqual(['fresh', 'used']);
  });

  it('orders by oldest lastUsed first', () => {
    const recent = r('recent', { lastUsed: days(1) });
    const stale = r('stale', { lastUsed: days(5) });
    expect(orderByDue([recent, stale]).map(x => x.id)).toEqual(['stale', 'recent']);
  });

  it('breaks ties deterministically by createdAt then id (program day order)', () => {
    // Two never-used days created together — Day 1 (older) should come first.
    const day1 = r('day1', { createdAt: new Date(2026, 0, 1, 0, 0, 0) });
    const day2 = r('day2', { createdAt: new Date(2026, 0, 1, 0, 0, 1) });
    expect(orderByDue([day2, day1]).map(x => x.id)).toEqual(['day1', 'day2']);
  });
});

describe('getActiveRoutines', () => {
  it('excludes paused routines (isActive === false)', () => {
    const active = r('active');
    const paused = r('paused', { isActive: false });
    expect(getActiveRoutines([active, paused]).map(x => x.id)).toEqual(['active']);
  });
});

describe('getUpNextRoutine', () => {
  it('returns the most-due day of the ACTIVE program only', () => {
    const routines = [
      r('p1-push', { programId: 'p1', createdAt: days(10) }),
      r('p1-legs', { programId: 'p1', createdAt: days(9), lastUsed: days(2) }),
      r('p2-day', { programId: 'p2', createdAt: days(8) }), // paused program — ignored
    ];
    const programs = [prog('p1', 'active'), prog('p2', 'paused')];
    expect(getUpNextRoutine(routines, programs)?.id).toBe('p1-push');
  });

  it('falls back to all active routines when no program is active', () => {
    const routines = [
      r('a', { lastUsed: days(1) }),
      r('b', { lastUsed: days(5) }),
    ];
    expect(getUpNextRoutine(routines, [prog('p1', 'paused')])?.id).toBe('b');
  });

  it('dashboard and routines screen agree on a fresh program (no day used)', () => {
    // Regression: the two screens previously tie-broke in opposite directions,
    // so a brand-new program showed different "up next" days on each.
    const routines = [
      r('push', { programId: 'p1', createdAt: new Date(2026, 0, 1, 0, 0, 0) }),
      r('pull', { programId: 'p1', createdAt: new Date(2026, 0, 1, 0, 0, 1) }),
      r('legs', { programId: 'p1', createdAt: new Date(2026, 0, 1, 0, 0, 2) }),
    ];
    const programs = [prog('p1', 'active')];
    // Both screens call this same function, so they cannot disagree.
    expect(getUpNextRoutine(routines, programs)?.id).toBe('push');
  });

  it('returns null when there are no active candidates', () => {
    expect(getUpNextRoutine([], [])).toBeNull();
    expect(getUpNextRoutine([r('x', { isActive: false })], [])).toBeNull();
  });
});
