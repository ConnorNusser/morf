/**
 * Routine Generation Prompt Builder
 *
 * Builds prompts for AI routine generation using split templates.
 * The AI has flexibility to choose exercises within template guidelines.
 *
 * Priority Order:
 * 1. Days (MUST FOLLOW)
 * 2. Include/Exclude exercises (MUST FOLLOW)
 * 3. Focus areas (PRIORITIZE)
 * 4. Training goal (GUIDE)
 */

import { selectTemplate, TrainingGoal, ExperienceLevel, SplitTemplate } from '../splitTemplates';
import { getExclusionTemplate, shouldUseExclusionTemplate, ExclusionTemplate } from '../exclusionTemplates';

// Re-export for backward compatibility
export { TrainingGoal };

/**
 * Program template types (mapped to split templates)
 */
export type ProgramTemplate =
  | 'ppl'
  | 'upper_lower'
  | 'full_body'
  | 'bro_split'
  | 'powerbuilding'
  | 'strength'
  | 'custom';

/**
 * Program template info for UI display
 */
export const PROGRAM_TEMPLATES: Record<ProgramTemplate, {
  name: string;
  description: string;
  daysPerWeek: number[];
  bestFor: TrainingGoal[];
}> = {
  ppl: {
    name: 'Push/Pull/Legs',
    description: 'High frequency split hitting each muscle 2x/week.',
    daysPerWeek: [6, 3],
    bestFor: ['hypertrophy', 'powerbuilding'],
  },
  upper_lower: {
    name: 'Upper/Lower',
    description: 'Balanced 4-day split with power and hypertrophy days.',
    daysPerWeek: [4],
    bestFor: ['powerbuilding', 'hypertrophy'],
  },
  full_body: {
    name: 'Full Body',
    description: 'Hit everything each session. Efficient for 3 days/week.',
    daysPerWeek: [3],
    bestFor: ['strength', 'general'],
  },
  bro_split: {
    name: 'Body Part Split',
    description: 'Classic bodybuilding. One muscle group per day.',
    daysPerWeek: [5, 6],
    bestFor: ['hypertrophy'],
  },
  powerbuilding: {
    name: 'Powerbuilding',
    description: 'Heavy compounds + hypertrophy work.',
    daysPerWeek: [5],
    bestFor: ['powerbuilding', 'strength'],
  },
  strength: {
    name: 'Strength Focus',
    description: 'Periodized strength training with submaximal loads.',
    daysPerWeek: [3, 4],
    bestFor: ['strength'],
  },
  custom: {
    name: 'Custom Program',
    description: 'AI designs based on your goals and schedule.',
    daysPerWeek: [3, 4, 5, 6],
    bestFor: ['general', 'hypertrophy', 'strength', 'powerbuilding'],
  },
};

/**
 * Parameters for routine generation
 */
export interface RoutineGenerationParams {
  programTemplate: ProgramTemplate;
  trainingGoal: TrainingGoal;
  userStrengthLevel: string;
  userBodyWeight: number;
  weightUnit: string;
  gender: string;
  userEquipmentDisplay: string;
  exerciseHistorySummary: string;
  customExercisesSummary: string;
  allExerciseNames: string[];
  weeklyDays: number;
  focusMuscles?: string[];
  ignoredMuscles?: string[];  // Body parts to completely skip
  trainingAdvancement?: {
    level: ExperienceLevel;
    allowHeavySquatAndDeadliftSameDay: boolean;
    maxSetsPerMusclePerSession: number;
    suggestedFrequency: { squat: number; bench: number; deadlift: number };
  };
  workoutDuration?: number;
  exercisesPerWorkout?: { min: number; max: number };
  includedExercises?: string[];
  excludedExercises?: string[];
}

/**
 * Build the routine generation prompt
 */
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
    ignoredMuscles,
    trainingAdvancement,
    workoutDuration,
    exercisesPerWorkout,
    includedExercises,
    excludedExercises,
  } = params;

  // Check if we should use a specialized exclusion template
  const hasIgnoredMuscles = ignoredMuscles && ignoredMuscles.length > 0;
  const useExclusionTemplate = shouldUseExclusionTemplate(ignoredMuscles);

  // Select the appropriate template
  const experience = trainingAdvancement?.level || 'intermediate';
  let template: SplitTemplate | null = null;
  let exclusionTemplate: ExclusionTemplate | null = null;

  if (useExclusionTemplate && ignoredMuscles) {
    // Use specialized exclusion template (e.g., upper body only)
    exclusionTemplate = getExclusionTemplate(ignoredMuscles, weeklyDays);
  } else {
    // Use standard split template
    template = selectTemplate(weeklyDays, trainingGoal, experience);
  }

  // Build ignored muscles guideline for non-leg exclusions (legs get full template replacement)
  const ignoredMusclesGuideline = hasIgnoredMuscles && !useExclusionTemplate
    ? buildIgnoredMusclesGuideline(ignoredMuscles)
    : '';

  // Build sections with clear numbering
  const sections: string[] = [];

  // ============================================================================
  // SECTION 1: PROGRAM CONTEXT
  // ============================================================================
  const templateName = exclusionTemplate?.name || template?.name || 'Custom';
  const templateDesc = exclusionTemplate?.description || template?.description || 'AI Generated';

  sections.push(`
================================================================================
SECTION 1: PROGRAM CONTEXT
================================================================================
Template: ${templateName}
${exclusionTemplate ? `Type: ${exclusionTemplate.exclusionType.replace('_', ' ').toUpperCase()} PROGRAM` : ''}
Days per week: ${weeklyDays}
Goal: ${trainingGoal}
User level: ${userStrengthLevel} (${experience})
Description: ${templateDesc}
`);

  // ============================================================================
  // SECTION 2: TEMPLATE GUIDELINES
  // ============================================================================
  const guidelines = exclusionTemplate?.guidelines || template?.guidelines;
  if (guidelines) {
    sections.push(`
================================================================================
SECTION 2: TEMPLATE GUIDELINES
================================================================================
${guidelines}
`);
  }

  // ============================================================================
  // SECTION 3: CRITICAL REQUIREMENTS (MUST FOLLOW)
  // ============================================================================
  const criticalRules: string[] = [];

  // Days constraint
  criticalRules.push(`1. Generate EXACTLY ${weeklyDays} workout days`);

  // Exercise count constraint
  if (exercisesPerWorkout) {
    criticalRules.push(`2. Each workout must have ${exercisesPerWorkout.min}-${exercisesPerWorkout.max} exercises`);
  }

  // Duration constraint
  if (workoutDuration) {
    const durationGuidelines = getDurationGuidelines(workoutDuration);
    criticalRules.push(`3. Target workout duration: ${workoutDuration} minutes
   ${durationGuidelines}`);
  }

  // Included exercises (MUST)
  if (includedExercises && includedExercises.length > 0) {
    criticalRules.push(`4. MUST INCLUDE these exercises (find appropriate slots):
   ${includedExercises.join(', ')}`);
  }

  // Excluded exercises (MUST)
  if (excludedExercises && excludedExercises.length > 0) {
    criticalRules.push(`5. MUST EXCLUDE these exercises (never use):
   ${excludedExercises.join(', ')}`);
  }

  // Fatigue management
  if (trainingAdvancement) {
    if (!trainingAdvancement.allowHeavySquatAndDeadliftSameDay) {
      criticalRules.push(`6. FATIGUE RULE: Heavy squat and heavy deadlift may share ONE dedicated lower/power day per week (as in PHUL/PHAT). Do NOT repeat that heavy pairing on multiple days — accessory hinges (RDL, leg curl, hip thrust at higher reps) alongside squats are fine.`);
    }
    criticalRules.push(`7. Max sets per muscle per session: ${trainingAdvancement.maxSetsPerMusclePerSession}`);
  }

  sections.push(`
================================================================================
SECTION 3: CRITICAL REQUIREMENTS (MUST FOLLOW)
================================================================================
${criticalRules.join('\n\n')}
`);

  // ============================================================================
  // SECTION 4: IGNORED BODY PARTS (MUST SKIP)
  // ============================================================================
  // Only show this section for non-leg exclusions (legs get full template replacement)
  if (hasIgnoredMuscles && !useExclusionTemplate && ignoredMusclesGuideline) {
    sections.push(`
================================================================================
SECTION 4: IGNORED BODY PARTS (MUST SKIP)
================================================================================
${ignoredMusclesGuideline}
`);
  }

  // ============================================================================
  // SECTION 5: PRIORITY FOCUS AREAS (PRIORITIZE)
  // ============================================================================
  if (focusMuscles && focusMuscles.length > 0) {
    sections.push(`
================================================================================
SECTION ${hasIgnoredMuscles ? '5' : '4'}: PRIORITY FOCUS AREAS (PRIORITIZE)
================================================================================
The user wants to emphasize: ${focusMuscles.join(', ')}

When selecting exercises:
- Include more exercises targeting these muscles
- Place them earlier in the workout when fresh
- Add extra volume for these muscle groups
`);
  }

  // ============================================================================
  // SECTION 5: AVAILABLE EXERCISES
  // ============================================================================
  sections.push(`
================================================================================
SECTION 5: AVAILABLE EXERCISES (use ONLY these)
================================================================================
${allExerciseNames.join(', ')}

${customExercisesSummary}
`);

  // ============================================================================
  // SECTION 6: USER CONTEXT
  // ============================================================================
  sections.push(`
================================================================================
SECTION 6: USER CONTEXT
================================================================================
Body weight: ${userBodyWeight} ${weightUnit}
Gender: ${gender}
Available equipment: ${userEquipmentDisplay}
Strength level: ${userStrengthLevel}

${exerciseHistorySummary}
`);

  // ============================================================================
  // SECTION 7: OUTPUT FORMAT
  // ============================================================================
  sections.push(`
================================================================================
SECTION 7: OUTPUT FORMAT
================================================================================
Return ONLY valid JSON. No markdown, no backticks, no explanation.

{
  "programName": "Program Name",
  "programStyle": "${programTemplate}",
  "trainingGoal": "${trainingGoal}",
  "routines": [
    {
      "name": "Day Name",
      "dayNumber": 1,
      "focus": "Focus area",
      "targetMuscles": ["muscle1", "muscle2"],
      "exercises": [
        { "name": "Exercise (Equipment)", "sets": 3, "reps": 10 }
      ],
      "estimatedTime": "50 min"
    }
  ]
}

CRITICAL:
- Exercise names must EXACTLY match the available list
- Return exactly ${weeklyDays} days
- Follow all rules in SECTION 3
`);

  return sections.join('\n');
}

/**
 * Get duration-specific guidelines
 */
function getDurationGuidelines(minutes: number): string {
  if (minutes <= 30) {
    return `- Keep to 4-5 exercises
   - Supersets encouraged
   - Rest periods: 60-90 seconds
   - Focus on compounds, minimal isolation`;
  }
  if (minutes <= 60) {
    return `- 5-7 exercises per workout
   - Rest periods: 90-120 seconds
   - Good balance of compounds and isolation`;
  }
  if (minutes <= 90) {
    return `- 6-8 exercises per workout
   - Rest periods: 2-3 minutes on heavy compounds
   - Room for more accessory work`;
  }
  return `- 8-10 exercises per workout
   - Rest periods: 3-5 minutes on main lifts
   - Full accessory and isolation work`;
}

/**
 * Build guidelines for ignored muscle groups
 * Provides specific programming modifications based on what's being skipped
 */
function buildIgnoredMusclesGuideline(ignoredMuscles?: string[]): string {
  if (!ignoredMuscles || ignoredMuscles.length === 0) {
    return '';
  }

  const ignored = ignoredMuscles.map(m => m.toLowerCase());
  const guidelines: string[] = [];

  guidelines.push(`The user wants to COMPLETELY SKIP these body parts: ${ignoredMuscles.join(', ')}`);
  guidelines.push('');
  guidelines.push('CRITICAL RULES:');
  guidelines.push('- Do NOT include ANY exercises that primarily target these muscles');
  guidelines.push('- Do NOT include "leg day" or similar dedicated days for skipped body parts');
  guidelines.push('- Redistribute workout days to focus on remaining muscle groups');
  guidelines.push('');

  // Specific guidelines based on what's being skipped
  if (ignored.includes('legs')) {
    guidelines.push('LEGS SKIPPED - MODIFIED PROGRAMMING:');
    guidelines.push('- NO squats, deadlifts, leg press, lunges, leg curls, leg extensions, or calf work');
    guidelines.push('- Convert "Leg Day" to additional upper body work (e.g., extra back/chest day)');
    guidelines.push('- For PPL: Convert to Push/Pull only, repeat cycle');
    guidelines.push('- For Upper/Lower: Convert to all upper body days');
    guidelines.push('- For Full Body: Focus on upper body compounds and accessories');
    guidelines.push('');
  }

  if (ignored.includes('chest')) {
    guidelines.push('CHEST SKIPPED - MODIFIED PROGRAMMING:');
    guidelines.push('- NO bench press, chest fly, push-ups, dips (chest-focused), or incline press');
    guidelines.push('- On "Push Day": Focus on shoulders and triceps only');
    guidelines.push('- Replace horizontal pressing with more overhead pressing');
    guidelines.push('');
  }

  if (ignored.includes('back')) {
    guidelines.push('BACK SKIPPED - MODIFIED PROGRAMMING:');
    guidelines.push('- NO rows, pulldowns, pull-ups, deadlifts, or back-focused movements');
    guidelines.push('- On "Pull Day": Focus on biceps and rear delts only');
    guidelines.push('- Add extra shoulder and arm work to maintain balance');
    guidelines.push('');
  }

  if (ignored.includes('shoulders')) {
    guidelines.push('SHOULDERS SKIPPED - MODIFIED PROGRAMMING:');
    guidelines.push('- NO overhead press, lateral raises, front raises, or rear delt work');
    guidelines.push('- On "Push Day": Focus on chest and triceps');
    guidelines.push('- Note: Some shoulder involvement in pressing is unavoidable');
    guidelines.push('');
  }

  if (ignored.includes('arms')) {
    guidelines.push('ARMS SKIPPED - MODIFIED PROGRAMMING:');
    guidelines.push('- NO bicep curls, tricep extensions, hammer curls, or direct arm work');
    guidelines.push('- Focus on compound movements only');
    guidelines.push('- Arms will get indirect work from pressing and pulling');
    guidelines.push('');
  }

  if (ignored.includes('core')) {
    guidelines.push('CORE SKIPPED - MODIFIED PROGRAMMING:');
    guidelines.push('- NO crunches, planks, ab wheel, or direct core work');
    guidelines.push('- Core gets indirect work from compound lifts');
    guidelines.push('');
  }

  guidelines.push('PROGRAM STRUCTURE:');
  guidelines.push('- Adjust day names to reflect actual content (e.g., "Upper Body A" not "Push")');
  guidelines.push('- Add extra volume for non-skipped muscle groups');
  guidelines.push('- Maintain proper rest between muscle groups');

  return guidelines.join('\n');
}
