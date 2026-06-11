// Resolving "which routine is today's" for the home dashboard.
//
// The app rarely sets an explicit `currentRoutine` (createRoutine never does,
// and no UI calls setCurrentRoutine), so relying on it alone makes the home
// screen claim there's no routine when the user has several. The real signal is
// the routine list: active routines (isActive !== false) ordered by how "due"
// they are — least-recently-used first, so a Push/Pull/Legs split rotates.
import { Routine } from '@/types';

function lastUsedTime(r: Routine): number {
  return r.lastUsed ? new Date(r.lastUsed).getTime() : 0; // never-used sorts most-due
}

// Active routines ordered most-due first (oldest lastUsed). Ties break to the
// older routine so the order is stable.
export function getActiveRoutines(routines: Routine[]): Routine[] {
  return [...routines]
    .filter(r => r.isActive !== false)
    .sort((a, b) => {
      const diff = lastUsedTime(a) - lastUsedTime(b);
      if (diff !== 0) return diff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

// Today's routine: an explicitly-set current routine wins; otherwise the
// most-due active routine. Null only when there are no active routines.
export function getTodayRoutine(routines: Routine[], currentRoutine: Routine | null): Routine | null {
  if (currentRoutine) return currentRoutine;
  return getActiveRoutines(routines)[0] ?? null;
}
