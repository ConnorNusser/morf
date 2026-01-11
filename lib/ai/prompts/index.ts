/**
 * Shared prompt utilities and constants
 */

// Re-export all prompts
export * from './workoutGeneration.prompt';
export * from './workoutRefinement.prompt';
export * from './customExercise.prompt';
export * from './workoutNoteParsing.prompt';
export * from './routineGeneration.prompt';

/**
 * Standard exercise naming format documentation
 * This is the canonical format for all exercise names and IDs in the system
 */
export const EXERCISE_FORMAT = {
  /**
   * Exercise Name Format: "Exercise Name (Equipment)"
   * Examples:
   * - "Bench Press (Barbell)"
   * - "Chest Fly (Cables)"
   * - "Leg Press (Machine)"
   */
  nameFormat: 'Exercise Name (Equipment)',

  /**
   * Exercise ID Format: "exercise-name-equipment"
   * Examples:
   * - "bench-press-barbell"
   * - "chest-fly-cables"
   * - "leg-press-machine"
   */
  idFormat: 'exercise-name-equipment',

  /**
   * Valid equipment types
   */
  equipmentTypes: ['Barbell', 'Dumbbells', 'Cables', 'Machine', 'Smith Machine', 'Kettlebell', 'Bodyweight'] as const,

  /**
   * Equipment type to ID suffix mapping
   */
  equipmentToIdSuffix: {
    'Barbell': 'barbell',
    'Dumbbells': 'dumbbells',
    'Cables': 'cables',
    'Machine': 'machine',
    'Smith Machine': 'smith-machine',
    'Kettlebell': 'kettlebell',
    'Bodyweight': 'bodyweight',
  } as const,
};

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
 * Shared instruction block for custom exercise creation
 * Use this when AI might encounter exercises not in the available list
 */
export const CUSTOM_EXERCISE_INSTRUCTIONS = `
CUSTOM EXERCISE CREATION:
If an exercise is NOT in the available list, create it as a custom exercise:
1. Format the name: "Exercise Name (Equipment)" in Title Case
2. The ID will be generated as: "exercise-name-equipment" (lowercase, hyphenated)

Examples:
- Input: "super horizontal bench press"
  → Name: "Super Horizontal Bench Press (Machine)"
  → ID: "super-horizontal-bench-press-machine"

- Input: "pause squat"
  → Name: "Pause Squat (Barbell)"
  → ID: "pause-squat-barbell"

- Input: "incline cable fly"
  → Name: "Incline Cable Fly (Cables)"
  → ID: "incline-cable-fly-cables"

ALWAYS include equipment type - infer from context:
- Main lifts (bench, squat, deadlift, OHP) → (Barbell)
- Curls, raises, presses without qualifier → (Dumbbells)
- Pulldowns, pushdowns, rows mentioning cable → (Cables)
- Anything with "machine" in name → (Machine)`;
