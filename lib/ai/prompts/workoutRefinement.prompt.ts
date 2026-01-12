/**
 * Prompt for refining workout plans through conversation
 */

import { EXERCISE_NAMING_INSTRUCTIONS } from './workoutGeneration.prompt';

export interface WorkoutRefinementParams {
  currentPlan: string;
  chatHistoryStr: string;
  userMessage: string;
  weightUnit: string;
  userEquipmentDisplay: string;
  allExerciseNames: string[];
}

export function buildWorkoutRefinementPrompt(params: WorkoutRefinementParams): string {
  const {
    currentPlan,
    chatHistoryStr,
    userMessage,
    weightUnit,
    userEquipmentDisplay,
    allExerciseNames,
  } = params;

  return `You are helping refine a workout plan through conversation.

CURRENT PLAN:
${currentPlan}

CONVERSATION HISTORY:
${chatHistoryStr}

USER'S NEW MESSAGE:
${userMessage}

USER CONTEXT:
- Weight Unit: ${weightUnit}
- Available Equipment: ${userEquipmentDisplay}

AVAILABLE EXERCISES (already filtered to user's equipment):
${allExerciseNames.join(', ')}

INSTRUCTIONS:
1. Understand what the user wants to change or know
2. Update the plan if they request changes (add/remove exercises, adjust weights/reps, swap exercises)
3. Keep the same format: "Exercise Name (Equipment) WeightxReps, WeightxReps" followed by "Actual" on the next line, with blank lines between exercise blocks
4. Provide a brief, helpful response explaining what you changed or answering their question
5. Suggest 1-2 follow-up questions if relevant
${EXERCISE_NAMING_INSTRUCTIONS}

CRITICAL - EQUIPMENT CONSTRAINTS:
- The user has specified their available equipment: ${userEquipmentDisplay}
- ONLY use exercises that use this equipment - do NOT suggest exercises requiring equipment they don't have
- If the user further specifies equipment in their request (e.g., "dumbbells only"), narrow it down further
- When in doubt about equipment, ask for clarification
- Common equipment mappings:
  * "dumbbells only" = dumbbell exercises only (DB press, DB rows, DB curls, etc.)
  * "barbell only" = barbell exercises only (bench, squat, deadlift, rows, etc.)
  * "bodyweight" = no equipment (pushups, pullups, dips, squats, lunges, etc.)
  * "home gym" = typically dumbbells, maybe a barbell, no cables/machines

Return ONLY valid JSON (no markdown, no backticks):
{
  "noteText": "The updated workout plan (or same if no changes needed)",
  "title": "Short title for the workout",
  "response": "Brief response to the user (1-2 sentences)",
  "followUpQuestions": ["Optional follow-up question 1", "Optional follow-up question 2"]
}`;
}
