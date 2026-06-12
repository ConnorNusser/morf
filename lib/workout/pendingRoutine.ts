// Simple module-level state for passing routine text between screens
let pendingText: string | null = null;
let pendingRoutineId: string | null = null;

export function setPendingRoutine(text: string, routineId?: string) {
  pendingText = text;
  pendingRoutineId = routineId || null;
}

export function getPendingRoutine(): string | null {
  const text = pendingText;
  pendingText = null; // Clear after reading
  return text;
}

export function getPendingRoutineId(): string | null {
  const id = pendingRoutineId;
  pendingRoutineId = null; // Clear after reading
  return id;
}
