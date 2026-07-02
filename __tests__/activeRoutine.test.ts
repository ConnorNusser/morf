import { Program, Routine } from '../types';
import { getActiveRoutines, getNextInCycle, getUpNextCandidates, getUpNextRoutine, isDayCompletedThisCycle, orderByDue } from '../lib/workout/activeRoutine';

// Minimal routine fixture — the resolver only reads these fields.
function r(
  id: string,
  opts: { lastUsed?: Date; createdAt?: Date; isActive?: boolean; programId?: string; order?: number } = {}
): Routine {
  return {
    id,
    name: id,
    exercises: [],
    createdAt: opts.createdAt ?? new Date(2026, 0, 1),
    lastUsed: opts.lastUsed,
    isActive: opts.isActive,
    programId: opts.programId,
    order: opts.order,
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

describe('getUpNextCandidates', () => {
  it('returns the ACTIVE program days in manual (order) sequence', () => {
    const routines = [
      r('legs', { programId: 'p1', order: 2 }),
      r('push', { programId: 'p1', order: 0 }),
      r('pull', { programId: 'p1', order: 1 }),
      r('p2-day', { programId: 'p2', order: 0 }), // paused program — excluded
    ];
    const programs = [prog('p1', 'active'), prog('p2', 'paused')];
    expect(getUpNextCandidates(routines, programs).map(x => x.id)).toEqual(['push', 'pull', 'legs']);
  });

  it('excludes paused days within the active program', () => {
    const routines = [
      r('a', { programId: 'p1', order: 0 }),
      r('b', { programId: 'p1', order: 1, isActive: false }),
    ];
    expect(getUpNextCandidates(routines, [prog('p1', 'active')]).map(x => x.id)).toEqual(['a']);
  });
});

describe('getUpNextRoutine', () => {
  it('defaults to the first day on the ring when the pointer is unset', () => {
    const routines = [
      r('push', { programId: 'p1', order: 0 }),
      r('pull', { programId: 'p1', order: 1 }),
    ];
    expect(getUpNextRoutine(routines, [prog('p1', 'active')])?.id).toBe('push');
  });

  it('honors the pointer when it marks a valid day', () => {
    const routines = [
      r('push', { programId: 'p1', order: 0 }),
      r('pull', { programId: 'p1', order: 1 }),
    ];
    expect(getUpNextRoutine(routines, [prog('p1', 'active')], 'pull')?.id).toBe('pull');
  });

  it('falls back to the first day when the pointer is stale', () => {
    const routines = [
      r('push', { programId: 'p1', order: 0 }),
      r('pull', { programId: 'p1', order: 1 }),
    ];
    expect(getUpNextRoutine(routines, [prog('p1', 'active')], 'deleted')?.id).toBe('push');
  });

  it('falls back to all active routines (most-due) when no program is active', () => {
    const routines = [
      r('a', { lastUsed: days(1) }),
      r('b', { lastUsed: days(5) }),
    ];
    expect(getUpNextRoutine(routines, [prog('p1', 'paused')])?.id).toBe('b');
  });

  it('returns null when there are no active candidates', () => {
    expect(getUpNextRoutine([], [])).toBeNull();
    expect(getUpNextRoutine([r('x', { isActive: false })], [])).toBeNull();
  });
});

describe('isDayCompletedThisCycle', () => {
  const cycleStart = new Date(2026, 5, 5).getTime();

  it('is false when the cycle has not started (0)', () => {
    expect(isDayCompletedThisCycle(r('a', { lastUsed: new Date(2026, 5, 9) }), 0)).toBe(false);
  });

  it('is false when the day was never trained', () => {
    expect(isDayCompletedThisCycle(r('a'), cycleStart)).toBe(false);
  });

  it('is true when trained at or after the cycle started', () => {
    expect(isDayCompletedThisCycle(r('a', { lastUsed: new Date(2026, 5, 9) }), cycleStart)).toBe(true);
    expect(isDayCompletedThisCycle(r('a', { lastUsed: new Date(cycleStart) }), cycleStart)).toBe(true);
  });

  it('is false when the last training predates the current cycle', () => {
    expect(isDayCompletedThisCycle(r('a', { lastUsed: new Date(2026, 5, 1) }), cycleStart)).toBe(false);
  });

  it('adding a never-trained day does not flip already-completed days', () => {
    // The core "new rows affect old rows" regression: each day's state is its own
    // lastUsed vs one shared timestamp, so a new day is simply not-done and the
    // existing trained day stays done.
    const trained = r('trained', { lastUsed: new Date(2026, 5, 9) });
    const added = r('added');
    expect(isDayCompletedThisCycle(trained, cycleStart)).toBe(true);
    expect(isDayCompletedThisCycle(added, cycleStart)).toBe(false);
  });
});

describe('getNextInCycle', () => {
  const routines = [
    r('push', { programId: 'p1', order: 0 }),
    r('pull', { programId: 'p1', order: 1 }),
    r('legs', { programId: 'p1', order: 2 }),
  ];
  const programs = [prog('p1', 'active')];

  it('advances to the next day in order', () => {
    expect(getNextInCycle(routines, programs, 'push')?.id).toBe('pull');
  });

  it('wraps the last day back to the first', () => {
    expect(getNextInCycle(routines, programs, 'legs')?.id).toBe('push');
  });

  it('falls back to the first day for an unknown current day', () => {
    expect(getNextInCycle(routines, programs, 'gone')?.id).toBe('push');
  });
});
