/**
 * Prompt for parsing workout notes into structured data
 */

import { WeightUnit } from '@/types';

export interface WorkoutNoteParsingParams {
  text: string;
  defaultUnit: WeightUnit;
}

export function buildWorkoutNoteParsingPrompt(params: WorkoutNoteParsingParams): string {
  const { text, defaultUnit } = params;

  return `Parse the following workout notes into structured data. Extract each exercise with its sets, weights, and reps.

IMPORTANT RULES:
1. Each exercise should have an array of individual sets (not grouped)
2. If reps are listed as "8, 8, 6" that means 3 separate sets with those rep counts
3. If format is "3x8" that means 3 sets of 8 reps each
4. If format is "135x8" that means weight 135 for 8 reps (1 set)
5. If no weight specified for bodyweight exercises, use weight: 0
6. Default unit is "${defaultUnit}" unless specified otherwise
7. Common formats to recognize:
   - "Bench 135x8, 155x6" = 2 sets
   - "Squats 225 for 5 reps, 3 sets" = 3 sets of 225x5
   - "Pullups bodyweight x 10, 8, 6" = 3 sets
   - "DB curls 25s 3x12" = 3 sets of 25x12

CARDIO & TIMED EXERCISES:
8. For cardio exercises (rowing, treadmill, bike, elliptical, stair climber):
   - Parse duration in seconds and distance in meters
   - "Rowing 20min 5000m" or "Row 5k in 22:30" = duration + distance
   - "Rowing 20:00" = duration only (1200 seconds)
   - "Rowing 5000m" = distance only (5000 meters)
   - "Treadmill 30min" = 1800 seconds duration
   - Convert: km to meters (5k = 5000m), miles to meters (1 mile = 1609m)
   - Set trackingType: "cardio" for these exercises
   - IMPORTANT: Cardio machine names do NOT use parentheses format. Use these exact names:
     * "Rowing Machine" (NOT "Rowing (Machine)")
     * "Treadmill" (NOT "Treadmill (Machine)")
     * "Stationary Bike" (NOT "Stationary Bike (Machine)")
     * "Elliptical" (NOT "Elliptical (Machine)")
     * "Stair Climber" (NOT "Stair Climber (Machine)")

9. For timed/isometric exercises (plank, wall sit, dead hang):
   - Parse duration in seconds
   - "Plank 60s" or "Plank 1:00" = 60 seconds
   - "Plank 60s, 45s, 30s" = 3 sets of different durations
   - "Wall sit 2min" = 120 seconds
   - Set trackingType: "timed" for these exercises

10. Cardio/timed set format (use duration/distance instead of weight/reps):
    { "duration": 1200, "distance": 5000 }  // 20 min, 5km row
    { "duration": 60 }  // 60 second plank hold

EXERCISE NAMING - MANDATORY FORMAT:
Every exercise MUST end with equipment type in parentheses: "Exercise Name (Equipment)"
EXCEPTION: Cardio exercises use plain names without parentheses (see rule 8 above for exact names)

Equipment types: Barbell, Dumbbells, Cables, Machine, Smith Machine, Kettlebell, Bodyweight

RULES:
- Use singular form for exercise names (e.g., "Squat" not "Squats", "Curl" not "Curls", "Row" not "Rows")
- Use Title Case for exercise names

WRONG: "Bench Press", "DB Bench", "Cable Fly", "Zercher Squats"
RIGHT: "Bench Press (Barbell)", "Bench Press (Dumbbells)", "Chest Fly (Cables)", "Zercher Squat (Barbell)"

EQUIPMENT DETECTION FROM INPUT:
- "barbell", "bb", "bar" → (Barbell)
- "dumbbell", "db", "dumbbells" → (Dumbbells)
- "cable", "cables" → (Cables)
- "machine" → (Machine)
- "smith", "smith machine" → (Smith Machine)
- "kettlebell", "kb" → (Kettlebell)
- "bodyweight", "bw" → (Bodyweight)

DEFAULT EQUIPMENT WHEN NOT SPECIFIED:
- Main barbell lifts (bench press, squat, deadlift, overhead press, row) → (Barbell)
- Named dumbbell exercises (Arnold press, Zottman curl, hammer curl, lateral raise) → (Dumbbells)
- Curls, raises, flys without equipment specified → (Dumbbells)
- Pulldowns, pushdowns → (Cables)
- Named barbell variations (Zercher squat, Pendlay row, Jefferson deadlift, JM press) → (Barbell)

CUSTOM/UNKNOWN EXERCISES:
- If the user types an unknown exercise variation, preserve their intent in the name
- Fix obvious typos (e.g., "horziontal" → "Horizontal")
- Keep any modifiers the user specified (e.g., "super horizontal bench press" → "Super Horizontal Bench Press")
- Always format as "Exercise Name (Equipment)" even for custom exercises
- Example: "super horizontal bench press machine 90x8" → name: "Super Horizontal Bench Press (Machine)"

DISTINGUISHING TARGET vs ACTUAL SETS:
- "Target" sets are PLANNED sets, NOT actual working sets performed
- Keywords that indicate TARGET sets: "target", "recommended", "plan", "goal", "aim for", "try", "should do"
- Keywords that indicate ACTUAL sets (real working sets performed): "did", "completed", "actual", "hit", "got", "lifted", specific weight x rep notation without qualifiers
- If the input shows both target AND actual for an exercise, put target in "recommendedSets" and actual in "sets"
- If no distinction is made, assume all sets are ACTUAL working sets (put in "sets")
- NEVER put target sets in the main "sets" array - only actual working sets go there

EXAMPLES:
- "Bench target 135x8, did 145x8, 155x6" → name: "Bench Press (Barbell)", recommendedSets: [135x8], sets: [145x8, 155x6]
- "Machine bench 100x10" → name: "Bench Press (Machine)", sets: [100x10]
- "DB bench 40x12" → name: "Chest Press (Dumbbells)", sets: [40x12]
- "Tricep pulldowns 50x15" → name: "Tricep Pushdown (Cables)", sets: [50x15]
- "Single arm db row 35x10" → name: "Single Arm Row (Dumbbells)", sets: [35x10]

WORKOUT NOTES:
${text}

Return ONLY valid JSON in this exact format (no markdown, no backticks):
{
  "exercises": [
    {
      "name": "Exercise Name (Equipment)",
      "id": "exercise-name-equipment",
      "trackingType": "reps",
      "sets": [
        { "weight": 145, "reps": 8, "unit": "lbs" },
        { "weight": 155, "reps": 6, "unit": "lbs" }
      ],
      "recommendedSets": [
        { "weight": 135, "reps": 8, "unit": "lbs" }
      ]
    },
    {
      "name": "Rowing Machine",
      "id": "rowing-machine",
      "trackingType": "cardio",
      "sets": [
        { "duration": 1200, "distance": 5000 }
      ]
    },
    {
      "name": "Plank (Bodyweight)",
      "id": "plank-bodyweight",
      "trackingType": "timed",
      "sets": [
        { "duration": 60 },
        { "duration": 45 }
      ]
    }
  ],
  "confidence": 0.95
}

TRACKING TYPE RULES:
- trackingType: "reps" (default) - for weight/rep exercises, sets have { weight, reps, unit }
- trackingType: "cardio" - for cardio machines, sets have { duration, distance? } (duration in seconds, distance in meters)
- trackingType: "timed" - for isometric holds, sets have { duration } (duration in seconds)

NOTE: "recommendedSets" is optional - only include it if the input explicitly mentions recommended/target/planned sets.
The "sets" array should ONLY contain actual working sets that were performed.

The confidence score should be between 0 and 1, where 1 means very confident in the parsing.`;
}
