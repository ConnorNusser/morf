// Simple module-level state for passing routine text between screens
let pendingText: string | null = null;

export function setPendingRoutine(text: string) {
  pendingText = text;
}

export function getPendingRoutine(): string | null {
  const text = pendingText;
  pendingText = null; // Clear after reading
  return text;
}
