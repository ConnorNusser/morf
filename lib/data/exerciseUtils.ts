/**
 * Exercise naming and ID utilities
 *
 * Canonical formats:
 * - Name: "Exercise Name (Equipment)" e.g., "Bench Press (Barbell)"
 * - ID: "exercise-name-equipment" e.g., "bench-press-barbell"
 */

/**
 * Convert exercise name to ID format
 * "Bench Press (Barbell)" -> "bench-press-barbell"
 */
export function exerciseNameToId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
