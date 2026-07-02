// Single source of truth for "which routine is up next".
//
// Up next is a position on a cyclic ring of the active program's days, taken in
// the user's manual (Reorder) order — NOT a lastUsed "most-due" computation,
// which felt wonky when days were trained out of order or skipped. A stored
// pointer marks the current day; flipping on the home dashboard moves it, and
// finishing a workout advances it to the next day, wrapping the last day back
// to the first. The home dashboard and the Routines screen both resolve up next
// through here, so they can never drift apart.
import { Program, Routine } from '@/types';

// The minimal shape both Routine and CalculatedRoutine satisfy.
type RoutineLike = Pick<Routine, 'id' | 'createdAt' | 'isActive' | 'programId'> & { lastUsed?: Date; order?: number };

function lastUsedTime(r: RoutineLike): number {
  return r.lastUsed ? new Date(r.lastUsed).getTime() : 0; // never-used sorts most-due
}

// Order most-due first (oldest lastUsed). Ties break to the older routine
// (createdAt asc), then by id — so the order is fully deterministic and follows
// the natural program day order (Day 1 before Day 2) for never-used days.
export function orderByDue<T extends RoutineLike>(routines: T[]): T[] {
  return [...routines].sort((a, b) => {
    const diff = lastUsedTime(a) - lastUsedTime(b);
    if (diff !== 0) return diff;
    const created = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (created !== 0) return created;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Active routines (isActive !== false) ordered most-due first.
export function getActiveRoutines<T extends RoutineLike>(routines: T[]): T[] {
  return orderByDue(routines.filter(r => r.isActive !== false));
}

// The ring the up-next pointer moves along: when a program is active, its
// active days in manual program order (the Reorder order, ties broken by
// createdAt then id for stability). With no active program, every active
// routine, most-due first as a sensible default. Shared by the dashboard
// (the flip carousel) and the Routines screen (cycle progress).
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

// The up-next day: the day `pointerId` marks, or the first day on the ring when
// the pointer is unset or stale (its day was deleted, paused, or the active
// program changed). Returns null only when the ring is empty.
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

// A day reads as completed for the current cycle when it was trained at or after
// the cycle began. Derives from lastUsed (the single training signal) plus the
// stored cycle-start timestamp — no separate completed-id list to keep in sync,
// so adding/removing days can never retroactively change another day's state.
export function isDayCompletedThisCycle(
  routine: { lastUsed?: Date },
  cycleStartedAt: number,
): boolean {
  if (!cycleStartedAt || !routine.lastUsed) return false;
  return new Date(routine.lastUsed).getTime() >= cycleStartedAt;
}

// The day after `currentId` on the ring, wrapping the last day back to the
// first — used to advance the pointer once a day is trained. Falls back to the
// first day when `currentId` isn't on the ring.
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
