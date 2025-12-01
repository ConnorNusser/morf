/**
 * Exercise naming and ID utilities
 *
 * Canonical formats:
 * - Name: "Exercise Name (Equipment)" e.g., "Bench Press (Barbell)"
 * - ID: "exercise-name-equipment" e.g., "bench-press-barbell"
 */

import { getAvailableWorkouts } from './workouts';

/**
 * Valid equipment types for exercises
 */
export const EQUIPMENT_TYPES = ['Barbell', 'Dumbbells', 'Cables', 'Machine', 'Smith Machine', 'Kettlebell', 'Bodyweight'] as const;
export type EquipmentType = typeof EQUIPMENT_TYPES[number];

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

/**
 * Extract equipment type from exercise name
 * "Bench Press (Barbell)" -> "Barbell"
 * "Bench Press" -> null
 */
export function extractEquipmentFromName(name: string): EquipmentType | null {
  const match = name.match(/\(([^)]+)\)$/);
  if (!match) return null;

  const equipment = match[1];
  if (EQUIPMENT_TYPES.includes(equipment as EquipmentType)) {
    return equipment as EquipmentType;
  }
  return null;
}

/**
 * Check if an exercise name has equipment in parentheses
 */
export function hasEquipmentSuffix(name: string): boolean {
  return extractEquipmentFromName(name) !== null;
}

/**
 * Validate that an exercise ID matches the expected format
 * Returns true if ID ends with a valid equipment suffix
 */
export function isValidExerciseId(id: string): boolean {
  const validSuffixes = ['barbell', 'dumbbells', 'cables', 'machine', 'smith-machine', 'kettlebell', 'bodyweight'];
  return validSuffixes.some(suffix => id.endsWith(`-${suffix}`));
}

/**
 * Match an exercise name to its database ID
 * Uses algorithmic matching based on the naming convention
 *
 * @param name - Exercise name (e.g., "Bench Press (Barbell)" or "bench press barbell")
 * @param customExerciseIds - Optional set of custom exercise IDs to check
 * @returns Object with id and isCustom, or null if no match
 */
export function matchExerciseToId(
  name: string,
  customExerciseIds?: Set<string>
): { id: string; isCustom: boolean } | null {
  // Generate the expected ID from the name
  const expectedId = exerciseNameToId(name);

  // Get all database exercises
  const dbExercises = getAvailableWorkouts(100);
  const dbExerciseIds = new Set(dbExercises.map(e => e.id));

  // Direct match in database
  if (dbExerciseIds.has(expectedId)) {
    return { id: expectedId, isCustom: false };
  }

  // Direct match in custom exercises
  if (customExerciseIds?.has(expectedId)) {
    return { id: expectedId, isCustom: true };
  }

  // Try matching by normalized name against database exercise names
  const normalizedInput = name.toLowerCase().trim();
  for (const exercise of dbExercises) {
    const normalizedDbName = exercise.name.toLowerCase();
    if (normalizedDbName === normalizedInput) {
      return { id: exercise.id, isCustom: false };
    }
  }

  // No match found
  return null;
}

/**
 * Build a cache of exercise names to IDs from database
 * Returns Map<lowercase name, id>
 */
export function buildExerciseNameCache(): Map<string, string> {
  const cache = new Map<string, string>();
  const exercises = getAvailableWorkouts(100);

  for (const exercise of exercises) {
    // Store lowercase name -> id
    cache.set(exercise.name.toLowerCase(), exercise.id);

    // Also store the ID itself (for direct lookups)
    cache.set(exercise.id, exercise.id);
  }

  return cache;
}

/**
 * Validate and potentially fix an exercise ID
 * If the ID doesn't match a database exercise, generates one from the name
 *
 * @param id - The exercise ID to validate
 * @param name - The exercise name (used to generate ID if needed)
 * @param customExerciseIds - Optional set of custom exercise IDs
 * @returns A valid exercise ID
 */
export function validateOrGenerateId(
  id: string | undefined,
  name: string,
  customExerciseIds?: Set<string>
): string {
  // If we have an ID, check if it's valid
  if (id) {
    const dbExercises = getAvailableWorkouts(100);
    const dbExerciseIds = new Set(dbExercises.map(e => e.id));

    // Valid database ID
    if (dbExerciseIds.has(id)) {
      return id;
    }

    // Valid custom exercise ID
    if (customExerciseIds?.has(id)) {
      return id;
    }
  }

  // Generate ID from name
  return exerciseNameToId(name);
}
