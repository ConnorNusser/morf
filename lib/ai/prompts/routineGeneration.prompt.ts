/**
 * Prompt for routine generation based on proven workout programs
 * References real programs and methodologies from fitness experts
 */

import { EXERCISE_NAMING_INSTRUCTIONS } from './workoutGeneration.prompt';

/**
 * Program templates based on proven methodologies
 */
export type ProgramTemplate =
  | 'ppl'           // Push/Pull/Legs - Reddit PPL style (Metallicadpa)
  | 'upper_lower'   // Upper/Lower split - PHUL style (Brandon Campbell)
  | 'full_body'     // Full body 3x/week - Starting Strength / 5/3/1 style
  | 'bro_split'     // Classic bodybuilding split - Arnold style
  | 'powerbuilding' // Strength + hypertrophy - PHAT style (Layne Norton)
  | 'strength'      // Pure strength focus - 5/3/1 style (Jim Wendler)
  | 'custom';       // AI picks best fit

/**
 * Training goals that influence program design
 */
export type TrainingGoal =
  | 'strength'      // Maximize 1RM on compounds
  | 'hypertrophy'   // Maximize muscle size
  | 'powerbuilding' // Balance of strength and size
  | 'recomp'        // Body recomposition - fat loss + muscle retention
  | 'athletic'      // Athletic performance - power, explosiveness
  | 'general';      // General fitness/health

export interface RoutineGenerationParams {
  programTemplate: ProgramTemplate;
  trainingGoal: TrainingGoal;
  userStrengthLevel: string;  // Beginner, Intermediate, Advanced
  userBodyWeight: number;
  weightUnit: string;
  gender: string;
  userEquipmentDisplay: string;
  exerciseHistorySummary: string;
  customExercisesSummary: string;
  allExerciseNames: string[];
  weeklyDays: number;
  focusMuscles?: string[];
  // Training advancement for fatigue management
  trainingAdvancement?: {
    level: 'beginner' | 'intermediate' | 'advanced';
    allowHeavySquatAndDeadliftSameDay: boolean;
    maxSetsPerMusclePerSession: number;
    suggestedFrequency: { squat: number; bench: number; deadlift: number };
  };
  // Workout duration and exercise count constraints
  workoutDuration?: number;  // Duration in minutes (30, 60, 90, 120)
  exercisesPerWorkout?: { min: number; max: number };  // STRICT exercise count constraints
  includedExercises?: string[];  // Exercises that MUST be included (spread across routines)
}

/**
 * Program template info for UI display
 */
export const PROGRAM_TEMPLATES: Record<ProgramTemplate, {
  name: string;
  description: string;
  daysPerWeek: number[];
  bestFor: TrainingGoal[];
  reference: string;
}> = {
  ppl: {
    name: 'Push/Pull/Legs',
    description: 'High frequency split hitting each muscle 2x/week. Great for hypertrophy.',
    daysPerWeek: [6, 3],
    bestFor: ['hypertrophy', 'powerbuilding'],
    reference: 'Reddit PPL by Metallicadpa',
  },
  upper_lower: {
    name: 'Upper/Lower',
    description: 'Balanced 4-day split with power and hypertrophy days.',
    daysPerWeek: [4],
    bestFor: ['powerbuilding', 'hypertrophy'],
    reference: 'PHUL by Brandon Campbell',
  },
  full_body: {
    name: 'Full Body',
    description: 'Hit everything each session. Efficient for 3 days/week.',
    daysPerWeek: [3],
    bestFor: ['strength', 'general'],
    reference: '5/3/1 by Jim Wendler',
  },
  bro_split: {
    name: 'Body Part Split',
    description: 'Classic bodybuilding approach. One muscle group per day.',
    daysPerWeek: [5, 6],
    bestFor: ['hypertrophy'],
    reference: 'Arnold Schwarzenegger Split',
  },
  powerbuilding: {
    name: 'Powerbuilding',
    description: 'Heavy compounds + hypertrophy work. Best of both worlds.',
    daysPerWeek: [5],
    bestFor: ['powerbuilding', 'strength'],
    reference: 'PHAT by Dr. Layne Norton',
  },
  strength: {
    name: 'Strength Focus',
    description: 'Periodized strength training with submaximal loads.',
    daysPerWeek: [3, 4],
    bestFor: ['strength'],
    reference: '5/3/1 by Jim Wendler',
  },
  custom: {
    name: 'Custom Program',
    description: 'AI designs based on your goals and schedule.',
    daysPerWeek: [3, 4, 5, 6],
    bestFor: ['general', 'hypertrophy', 'strength', 'powerbuilding'],
    reference: 'Personalized',
  },
};

export function buildRoutineGenerationPrompt(params: RoutineGenerationParams): string {
  const {
    programTemplate,
    trainingGoal,
    userStrengthLevel,
    userBodyWeight,
    weightUnit,
    gender,
    userEquipmentDisplay,
    exerciseHistorySummary,
    customExercisesSummary,
    allExerciseNames,
    weeklyDays,
    focusMuscles,
    trainingAdvancement,
    workoutDuration,
    exercisesPerWorkout,
    includedExercises,
  } = params;

  const templateInfo = PROGRAM_TEMPLATES[programTemplate] || PROGRAM_TEMPLATES.custom;
  const hasFocusAreas = focusMuscles && focusMuscles.length > 0;
  const focusText = hasFocusAreas
    ? `PRIORITY FOCUS AREAS: ${focusMuscles.join(', ').toUpperCase()}`
    : '';

  // Build fatigue management guidelines based on training advancement
  const fatigueGuidelines = trainingAdvancement
    ? getFatigueManagementGuidelines(trainingAdvancement)
    : '';

  // Build STRICT exercise count constraints - these override program defaults
  const exerciseCountConstraints = exercisesPerWorkout
    ? getExerciseCountConstraints(exercisesPerWorkout, workoutDuration)
    : '';

  // Build included exercises requirements
  const includedExercisesRequirements = includedExercises && includedExercises.length > 0
    ? getIncludedExercisesRequirements(includedExercises)
    : '';

  const focusInstructions = hasFocusAreas
    ? `\nFOCUS AREA REQUIREMENTS:
- Increase volume for ${focusMuscles.join(', ')} muscle groups
- Add extra sets or exercises for focus areas
- Include specialized movements targeting focus areas
- If focus is "arms", add dedicated bicep and tricep work
- If focus is "legs", ensure quad and hamstring balance
- If focus is "chest", include incline/flat/decline variations
- If focus is "back", include both vertical and horizontal pulls
- If focus is "shoulders", include front/side/rear delt work
- If focus is "core", add direct ab and oblique exercises`
    : '';

  // Build the critical constraints section - placed at the END for maximum priority
  const criticalConstraints = buildCriticalConstraints({
    fatigueGuidelines,
    exerciseCountConstraints,
    includedExercisesRequirements,
  });

  return `Generate a practical workout routine program based on proven methodologies.

PROGRAM STYLE: ${templateInfo.name}
Reference: ${templateInfo.reference}
${templateInfo.description}

TRAINING GOAL: ${trainingGoal}
${focusText}

USER PROFILE:
- Experience Level: ${userStrengthLevel}
- Body Weight: ${userBodyWeight} ${weightUnit}
- Gender: ${gender}
- Available Equipment: ${userEquipmentDisplay}
- Training Days Per Week: ${weeklyDays}
${exerciseHistorySummary}
${customExercisesSummary}
${focusInstructions}

AVAILABLE EXERCISES (STRICT - use ONLY these exercises, do NOT invent or substitute):
${allExerciseNames.join(', ')}

EXERCISE SELECTION RULES:
- You MUST only use exercises from the list above
- Do NOT create variations or substitutes not in the list
- Do NOT add exercises that are not explicitly listed
- If an exercise type is missing from the list, skip it entirely

${getProgramGuidelines(programTemplate, trainingGoal, weeklyDays)}

${EXERCISE_NAMING_INSTRUCTIONS}

ROUTINE DESIGN PRINCIPLES:
1. Follow proven programming principles (progressive overload, adequate volume, recovery)
2. Prioritize compound movements before isolation work
3. Balance pushing and pulling movements
4. Include appropriate rep ranges for the training goal:
   - Strength: 3-6 reps on compounds, focus on progressive overload
   - Hypertrophy: 8-12 reps primary, 12-20 for isolation, volume focused
   - Powerbuilding: Mix of both - heavy compounds (3-5) plus hypertrophy work (8-12)
   - Recomposition: Higher reps (10-15), supersets, shorter rest, metabolic circuits
   - Athletic: Explosive movements, 3-6 reps for power, plyometrics, functional patterns
   - General: Moderate reps (8-12), balanced volume, full body emphasis
5. Appropriate exercise order (compounds first, isolation last)
6. Realistic volume (15-25 sets per muscle group per week for hypertrophy, less for strength)
${criticalConstraints}
Return ONLY valid JSON (no markdown, no backticks):
{
  "programName": "Descriptive program name",
  "programDescription": "1-2 sentence description of the program",
  "programStyle": "${programTemplate}",
  "trainingGoal": "${trainingGoal}",
  "weeklyVolume": "Total sets per week estimate",
  "estimatedDuration": "${workoutDuration ? `~${workoutDuration} min` : '45-60 min'} per session",
  "routines": [
    {
      "name": "Day name (e.g., 'Push Day', 'Upper Power', 'Day A')",
      "dayNumber": 1,
      "focus": "Primary focus of this day",
      "targetMuscles": ["chest", "shoulders", "triceps"],
      "exercises": [
        {
          "name": "Exercise Name (Equipment)",
          "sets": 3,
          "reps": 10,
          "notes": "Optional form cue or progression note"
        }
      ],
      "estimatedTime": "${workoutDuration ? `~${workoutDuration} min` : '50 min'}"
    }
  ],
  "weeklySchedule": "Recommended schedule (e.g., 'Mon/Tue/Thu/Fri' or 'A/B/A then B/A/B')",
  "progressionNotes": "How to progress (e.g., 'Add 5lbs to compounds when you hit all reps')"
}`;
}

function getProgramGuidelines(
  template: ProgramTemplate,
  goal: TrainingGoal,
  days: number
): string {
  const strengthReps = 'Main lifts: 3-5 reps. Accessories: 6-10 reps.';
  const hypertrophyReps = 'Compounds: 6-10 reps. Isolation: 10-15 reps. Some sets to failure.';
  const powerbuildingReps = 'Power days: 3-5 reps. Hypertrophy days: 8-12 reps.';

  switch (template) {
    case 'ppl':
      return `
PUSH/PULL/LEGS GUIDELINES (Reddit PPL style):
- Push: Chest, shoulders, triceps
- Pull: Back, biceps, rear delts
- Legs: Quads, hamstrings, glutes, calves
- Each muscle hit 2x per week (6-day) or 1x (3-day)
- Start with main compound (bench/OHP on push, rows/pullups on pull, squat/deadlift on legs)
- Linear progression on compounds: add weight when you hit target reps
${goal === 'strength' ? strengthReps : hypertrophyReps}`;

    case 'upper_lower':
      return `
UPPER/LOWER GUIDELINES (PHUL style):
- Upper Power: Heavy bench, rows, OHP (strength focus)
- Lower Power: Heavy squats, deadlifts (strength focus)
- Upper Hypertrophy: Higher volume chest, back, shoulders, arms
- Lower Hypertrophy: Higher volume legs, glutes
- Power days: Lower reps (3-5), heavier weight
- Hypertrophy days: Higher reps (8-12), moderate weight
${days === 4 ? '- 4-day split: Upper Power, Lower Power, Upper Hypertrophy, Lower Hypertrophy' : ''}
${powerbuildingReps}`;

    case 'full_body':
      return `
FULL BODY GUIDELINES (5/3/1 / Starting Strength style):
- Each session hits all major muscle groups
- Focus on big compound movements
- Squat or deadlift variation every session
- Horizontal push + pull every session
- Plenty of recovery between sessions
- Great for beginners or those with limited time
${goal === 'strength' ? strengthReps : 'Compounds: 5-8 reps. Accessories: 8-12 reps.'}`;

    case 'bro_split':
      return `
BODY PART SPLIT GUIDELINES (Arnold style):
- One primary muscle group per day
- High volume per session
- Example: Chest/Back/Shoulders/Arms/Legs
- Multiple angles and exercises for complete development
- Classic bodybuilding approach
${hypertrophyReps}`;

    case 'powerbuilding':
      return `
POWERBUILDING GUIDELINES (PHAT by Dr. Layne Norton):
- 2 power days (upper/lower) for strength
- 3 hypertrophy days for muscle growth
- Power days: Heavy compounds, 3-5 reps, long rest
- Hypertrophy days: Moderate weight, 8-15 reps, shorter rest
- Speed work on hypertrophy days (explosive reps)
- Best for intermediate+ lifters
${powerbuildingReps}`;

    case 'strength':
      return `
STRENGTH GUIDELINES (5/3/1 by Jim Wendler):
- Focus on the "Big 4": Squat, Bench, Deadlift, OHP
- Submaximal training (work with 85-95% of TM)
- Wave loading: Week 1 (5s), Week 2 (3s), Week 3 (5/3/1), Week 4 (deload)
- PR sets (AMRAP) on final set
- Assistance work: Push, pull, single-leg/core
- "Start light, progress slow" philosophy
${strengthReps}`;

    default:
      return `
CUSTOM PROGRAM GUIDELINES:
- Analyze user's training days and goals
- Select appropriate split for their schedule
- ${days <= 3 ? 'Full body or PPL condensed works well' : ''}
- ${days === 4 ? 'Upper/Lower split is ideal' : ''}
- ${days >= 5 ? 'PPL or body part split appropriate' : ''}
- Balance volume across the week
- Ensure progressive overload potential
${goal === 'strength' ? strengthReps : goal === 'hypertrophy' ? hypertrophyReps : powerbuildingReps}`;
  }
}

/**
 * Build critical constraints section - placed at the END of the prompt for maximum priority
 * These constraints OVERRIDE any conflicting guidelines from program templates
 */
function buildCriticalConstraints(params: {
  fatigueGuidelines: string;
  exerciseCountConstraints: string;
  includedExercisesRequirements: string;
}): string {
  const { fatigueGuidelines, exerciseCountConstraints, includedExercisesRequirements } = params;

  const hasConstraints = fatigueGuidelines || exerciseCountConstraints || includedExercisesRequirements;

  if (!hasConstraints) {
    return '';
  }

  return `

=== CRITICAL REQUIREMENTS (OVERRIDE ALL ABOVE GUIDELINES) ===
The following constraints MUST be followed. They take priority over any conflicting program template suggestions.
${fatigueGuidelines}
${exerciseCountConstraints}
${includedExercisesRequirements}
=== END CRITICAL REQUIREMENTS ===

`;
}

/**
 * Get fatigue management guidelines - simplified to just squat/deadlift separation
 */
function getFatigueManagementGuidelines(advancement: {
  level: 'beginner' | 'intermediate' | 'advanced';
  allowHeavySquatAndDeadliftSameDay: boolean;
  maxSetsPerMusclePerSession: number;
  suggestedFrequency: { squat: number; bench: number; deadlift: number };
}): string {
  const { allowHeavySquatAndDeadliftSameDay } = advancement;

  // Only include fatigue guideline if squat/deadlift should be separated
  if (allowHeavySquatAndDeadliftSameDay) {
    return '';
  }

  return `
FATIGUE MANAGEMENT:
- DO NOT program Squat (Barbell) and Deadlift (Barbell) on the SAME DAY - they MUST be on separate days
- This is a STRICT REQUIREMENT - split them across different workout days`;
}

/**
 * Get STRICT exercise count constraints based on workout duration
 */
function getExerciseCountConstraints(
  exercisesPerWorkout: { min: number; max: number },
  workoutDuration?: number
): string {
  const durationText = workoutDuration ? `${workoutDuration} minutes` : 'the specified duration';
  const countText = exercisesPerWorkout.min === exercisesPerWorkout.max
    ? `EXACTLY ${exercisesPerWorkout.min}`
    : `${exercisesPerWorkout.min}-${exercisesPerWorkout.max}`;

  return `
EXERCISE COUNT (MANDATORY - THIS IS NON-NEGOTIABLE):
- Target workout duration: ${durationText}
- Each routine MUST have ${countText} exercises. THIS IS REQUIRED.
- Do NOT generate routines with fewer exercises than specified.
- Do NOT generate routines with more exercises than specified.
- If you need more volume, add sets to exercises - do NOT add extra exercises.
- Count your exercises before responding to ensure compliance.`;
}

/**
 * Get requirements for exercises that MUST be included in the program
 */
function getIncludedExercisesRequirements(includedExercises: string[]): string {
  return `
REQUIRED EXERCISES (MUST INCLUDE):
${includedExercises.map(e => `- ${e}`).join('\n')}
These exercises MUST appear in the program. Distribute them across routines by muscle group.`;
}
