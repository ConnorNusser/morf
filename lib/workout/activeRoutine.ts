// Single source of truth for "which routine is up next". Up next is a pointer on
// a cyclic ring of the active program's days in the user's manual (Reorder) order
// — NOT a lastUsed "most-due" computation (that felt wonky when days were trained
// out of order). Flipping on the dashboard moves the pointer; finishing a workout
// advances it, wrapping last→first. Both the dashboard and Routines screen resolve
// through here so they can't drift apart.
import { Program, Routine } from '@/types';

type RoutineLike = Pick<Routine, 'id' | 'createdAt' | 'isActive' | 'programId'> & { lastUsed?: Date; order?: number };

function lastUsedTime(r: RoutineLike): number {
  return r.lastUsed ? new Date(r.lastUsed).getTime() : 0; // never-used sorts most-due
}

// Most-due first (oldest lastUsed); ties break createdAt asc then id, so it's
// deterministic and follows program day order for never-used days.
export function orderByDue<T extends RoutineLike>(routines: T[]): T[] {
  return [...routines].sort((a, b) => {
    const diff = lastUsedTime(a) - lastUsedTime(b);
    if (diff !== 0) return diff;
    const created = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (created !== 0) return created;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function getActiveRoutines<T extends RoutineLike>(routines: T[]): T[] {
  return orderByDue(routines.filter(r => r.isActive !== false));
}

// The ring the pointer moves along: with an active program, its active days in
// manual order (ties → createdAt, id); otherwise every active routine most-due first.
export function getUpNextCandidates<T extends RoutineLike>(
  routines: T[],
  programs: Pick<Program, 'id' | 'status'>[],
): T[] {
  const activeProgram = programs.find(p => p.status === 'active') ?? null;
  if (!activeProgram) return getActiveRoutines(routines);
  const days = routines.filter(r => r.programId === activeProgram.id && r.isActive !== false);
  return [...days].sort((a, b) => {
    const order = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
    if (order !== 0) return order;
    const created = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (created !== 0) return created;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// The day `pointerId` marks, or the first ring day when the pointer is unset or
// stale (day deleted/paused/program changed). Null only when the ring is empty.
export function getUpNextRoutine<T extends RoutineLike>(
  routines: T[],
  programs: Pick<Program, 'id' | 'status'>[],
  pointerId: string | null = null,
): T | null {
  const candidates = getUpNextCandidates(routines, programs);
  if (pointerId) {
    const pointed = candidates.find(r => r.id === pointerId);
    if (pointed) return pointed;
  }
  return candidates[0] ?? null;
}

// Completed this cycle = trained at/after the cycle start. Derived from lastUsed +
// cycle-start timestamp, so there's no completed-id list to keep in sync.
export function isDayCompletedThisCycle(
  routine: { lastUsed?: Date },
  cycleStartedAt: number,
): boolean {
  if (!cycleStartedAt || !routine.lastUsed) return false;
  return new Date(routine.lastUsed).getTime() >= cycleStartedAt;
}

// The day after `currentId`, wrapping last→first; falls back to the first day
// when `currentId` isn't on the ring.
export function getNextInCycle<T extends RoutineLike>(
  routines: T[],
  programs: Pick<Program, 'id' | 'status'>[],
  currentId: string | null,
): T | null {
  const candidates = getUpNextCandidates(routines, programs);
  if (candidates.length === 0) return null;
  const i = candidates.findIndex(r => r.id === currentId);
  if (i < 0) return candidates[0];
  return candidates[(i + 1) % candidates.length];
}
