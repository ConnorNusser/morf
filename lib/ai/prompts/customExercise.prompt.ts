/**
 * Prompt for generating custom exercise metadata
 */

export interface CustomExerciseParams {
  exerciseName: string;
}

export function buildCustomExercisePrompt(params: CustomExerciseParams): string {
  const { exerciseName } = params;

  return `You are a fitness expert. Given the exercise name "${exerciseName}", return JSON with exercise metadata.

EXERCISE NAMING - MANDATORY FORMAT:
The displayName MUST end with equipment in parentheses: "Exercise Name (Equipment)"

Equipment types: (Barbell), (Dumbbells), (Machine), (Smith Machine), (Cables), (Kettlebell), (Bodyweight)

Examples:
- "Bench Press (Barbell)"
- "Incline Press (Dumbbells)"
- "Chest Fly (Cables)"
- "Leg Press (Machine)"

WRONG: "Bench Press", "DB Bench", "Cable Fly"
RIGHT: "Bench Press (Barbell)", "Bench Press (Dumbbells)", "Chest Fly (Cables)"

VALID VALUES:
- displayName: Exercise name in Title Case ending with (Equipment)
- category: "compound" | "isolation" | "cardio" | "flexibility"
- primaryMuscles: Array of 1-2 from ["chest", "back", "shoulders", "arms", "legs", "glutes", "core"]
- secondaryMuscles: Array of 0-3 from ["chest", "back", "shoulders", "arms", "legs", "glutes", "core"]
- equipment: Array from ["barbell", "dumbbell", "machine", "smith-machine", "cable", "kettlebell", "bodyweight"]
- description: Short 1-sentence description of the exercise
- trackingType: "reps" | "timed" | "cardio"
  * "reps" (default) = weight-based or bodyweight rep exercises (bench press, curls, squats, pull-ups)
  * "timed" = isometric holds where you track duration (plank, wall sit, dead hang)
  * "cardio" = duration/distance based cardio (rowing, running, cycling, treadmill)

RETURN ONLY VALID JSON:
{
  "displayName": "Exercise Name (Equipment)",
  "category": "compound",
  "trackingType": "reps",
  "primaryMuscles": ["chest"],
  "secondaryMuscles": ["shoulders", "arms"],
  "equipment": ["machine"],
  "description": "A pressing movement targeting the chest."
}`;
}
