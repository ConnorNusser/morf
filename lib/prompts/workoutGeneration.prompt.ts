/**
 * Prompt for generating workout plans
 */

export interface WorkoutGenerationParams {
  userRequest: string;
  gender: string;
  weightUnit: string;
  userEquipmentDisplay: string;
  exerciseHistorySummary: string;
  customExercisesSummary: string;
  allExerciseNames: string[];
}

export const EXERCISE_NAMING_INSTRUCTIONS = `
EXERCISE NAMING - MANDATORY FORMAT:
Every exercise MUST follow this format:
- Name: "Exercise Name (Equipment)" in Title Case
- ID: "exercise-name-equipment" in lowercase with hyphens

Equipment types: Barbell, Dumbbells, Cables, Machine, Smith Machine, Kettlebell, Bodyweight

Examples:
- Bench Press (Barbell) → bench-press-barbell
- Bench Press (Dumbbells) → bench-press-dumbbells
- Bench Press (Machine) → bench-press-machine
- Bench Press (Smith Machine) → bench-press-smith-machine
- Lat Pulldown (Cables) → lat-pulldown-cables
- Goblet Squat (Kettlebell) → goblet-squat-kettlebell
- Push Up (Bodyweight) → push-up-bodyweight

WRONG: "Bench Press", "DB Bench", "Cable Fly"
RIGHT: "Bench Press (Barbell)", "Bench Press (Dumbbells)", "Chest Fly (Cables)"

CUSTOM EXERCISES:
If an exercise is NOT in the available list, still use the same format:
- "Super Horizontal Press (Machine)" → super-horizontal-press-machine
- "Pause Squat (Barbell)" → pause-squat-barbell
- "Incline Cable Fly (Cables)" → incline-cable-fly-cables`;

export function buildWorkoutGenerationPrompt(params: WorkoutGenerationParams): string {
  const {
    userRequest,
    gender,
    weightUnit,
    userEquipmentDisplay,
    exerciseHistorySummary,
    customExercisesSummary,
    allExerciseNames,
  } = params;

  return `Generate a workout based on this request: "${userRequest}"

USER CONTEXT:
- Gender: ${gender}
- Weight Unit: ${weightUnit}
- Available Equipment: ${userEquipmentDisplay}
${exerciseHistorySummary}
${customExercisesSummary}

AVAILABLE EXERCISES (prefer using these exact names when possible):
${allExerciseNames.join(', ')}

FORMATTING RULES:
1. Generate 4-7 exercises matching the user's request
2. PREFER exercises from the AVAILABLE EXERCISES list above - use their exact names
3. If you need an exercise not in the list, use a clear, standard name
4. Format as simple notes, one exercise per line
5. Each line: "Exercise Name (Equipment) WeightxReps, WeightxReps, WeightxReps"
6. Use ${weightUnit} for all weights (no unit symbol needed)
7. Base weights on the user's history if available, otherwise use reasonable defaults
8. Include 2-4 sets per exercise with slight weight progression or same weight
${EXERCISE_NAMING_INSTRUCTIONS}

CRITICAL - EQUIPMENT CONSTRAINTS:
- The user has specified their available equipment: ${userEquipmentDisplay}
- ONLY use exercises that use this equipment - do NOT suggest exercises requiring equipment they don't have
- If the user further specifies equipment in their request (e.g., "dumbbells only"), narrow it down further
- Common equipment mappings:
  * "dumbbells only" = dumbbell exercises only (DB press, DB rows, DB curls, goblet squats, lunges, etc.)
  * "barbell only" = barbell exercises only (bench, squat, deadlift, rows, OHP, etc.)
  * "barbell and dumbbells" = only barbell and dumbbell exercises, NO cables or machines
  * "bodyweight" = no equipment (pushups, pullups, dips, bodyweight squats, lunges, etc.)
  * "home gym" = typically dumbbells, maybe a barbell, no cables/machines

EXAMPLES of noteText format (with blank lines between exercises):
"Bench Press (Barbell) 135x10, 145x8, 155x6
Actual

Incline Chest Press (Dumbbells) 40x12, 45x10, 45x10
Actual

Chest Fly (Cables) 30x15, 30x12, 35x10
Actual

Tricep Pushdown (Cables) 50x12, 55x10, 55x10
Actual"

NOTE: Each exercise MUST have "Actual" on the line below it (for users to fill in their completed sets). Separate each exercise block with a blank line.

Return ONLY valid JSON (no markdown, no backticks):
{
  "title": "Short title for this workout",
  "noteText": "The workout as described above, exercises separated by newlines",
  "exercises": [{"name": "Exercise Name", "sets": 3, "reps": 10, "suggestedWeight": 135}],
  "contextQuestions": ["2-3 personalized questions to help refine the plan based on their history"]
}

CONTEXT QUESTIONS RULES:
- Generate 2-3 short, helpful questions based on the user's history and request
- Questions should help customize the workout (weight adjustments, exercise swaps, focus areas)
- If user has history, reference it (e.g., "You hit 155 last week - want to try 160 today?")
- Keep questions concise and actionable
- Examples: "Include tricep isolation?", "Go heavier on compounds?", "Add any supersets?"`;
}
