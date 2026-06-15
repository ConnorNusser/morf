// Single source of truth for "which routine is up next".
//
// Both the home dashboard (TodayCard) and the Routines screen render an
// "up next" suggestion. They used to compute it independently — over different
// candidate sets and with opposite tie-breaks — so they routinely disagreed
// (most visibly right after generating a program, when no day has been used
// yet). Everything here is shared so the two screens can never drift apart.
import { Program, Routine } from '@/types';

// The minimal shape both Routine and CalculatedRoutine satisfy.
type RoutineLike = Pick<Routine, 'id' | 'createdAt' | 'isActive' | 'programId'> & { lastUsed?: Date };

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

// The up-next routine, shared by the dashboard and the Routines screen.
//
// Scope: if a program is active, only its active days are candidates (the user
// is following that rotation). Otherwise every active routine is a candidate.
// Returns null only when there are no active candidates.
export function getUpNextRoutine<T extends RoutineLike>(
  routines: T[],
  programs: Pick<Program, 'id' | 'status'>[],
): T | null {
  const activeProgram = programs.find(p => p.status === 'active') ?? null;
  const candidates = activeProgram
    ? routines.filter(r => r.programId === activeProgram.id && r.isActive !== false)
    : routines.filter(r => r.isActive !== false);

  return orderByDue(candidates)[0] ?? null;
}
