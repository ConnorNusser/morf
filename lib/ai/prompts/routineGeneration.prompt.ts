/**
 * Routine Generation Prompt Builder
 *
 * Builds a freeform prompt for AI routine generation. Rather than forcing the model
 * into a fixed split template with prescriptive per-muscle rules, we hand it the
 * lifter's actual choices and trust it to design a sound program as an expert coach.
 *
 * The only hard constraints are the ones the user explicitly set:
 *   - exact number of training days
 *   - must-include / never-include exercises
 *   - body areas to emphasize or skip
 *   - available equipment (the exercise list is pre-filtered to it)
 * Everything else (split structure, exercise selection, set/rep schemes, ordering)
 * is the model's call.
 *
 * The same builder also powers iterative refinement: when a current program + a
 * change instruction are supplied, it asks the model to revise that program in place.
 */

import { TrainingGoal, ExperienceLevel } from '../splitTemplates';

/**
 * Program template types (kept for fallback program metadata + analytics labels)
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
 * Parameters for routine generation
 */
export interface RoutineGenerationParams {
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
  // Refinement mode: when both are present, revise the supplied program in place.
  currentProgramJson?: string;
  refineInstruction?: string;
}

/**
 * Build the routine generation prompt (freeform — also handles refinement).
 */
export function buildRoutineGenerationPrompt(params: RoutineGenerationParams): string {
  const {
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
    currentProgramJson,
    refineInstruction,
  } = params;

  const experience = trainingAdvancement?.level || 'intermediate';
  const isRefine = !!(currentProgramJson && refineInstruction);

  // ---- The lifter's choices (these drive the design) ----
  const choices: string[] = [];
  choices.push(`- Primary goal: ${trainingGoal}`);
  choices.push(`- Training days per week: ${weeklyDays} (the program has exactly ${weeklyDays} distinct workout days)`);

  if (workoutDuration) {
    const count = exercisesPerWorkout
      ? `roughly ${exercisesPerWorkout.min}-${exercisesPerWorkout.max} exercises`
      : 'an appropriate number of exercises';
    choices.push(`- Time per session: about ${workoutDuration} minutes — fit ${count} and pick rest periods that respect that budget`);
  } else if (exercisesPerWorkout) {
    choices.push(`- Roughly ${exercisesPerWorkout.min}-${exercisesPerWorkout.max} exercises per workout`);
  }

  choices.push(`- Experience: ${experience} — scale total volume, intensity, and exercise complexity to this level`);

  if (focusMuscles && focusMuscles.length > 0) {
    choices.push(`- Emphasize: ${focusMuscles.join(', ')} — give these extra volume and program them earlier in the session while fresh`);
  }

  if (ignoredMuscles && ignoredMuscles.length > 0) {
    choices.push(`- Avoid entirely: ${ignoredMuscles.join(', ')} — include NO direct work for these, and restructure the week so no day is built around them`);
  }

  if (includedExercises && includedExercises.length > 0) {
    choices.push(`- Must include these exercises somewhere in the program: ${includedExercises.join(', ')}`);
  }

  if (excludedExercises && excludedExercises.length > 0) {
    choices.push(`- Never include these exercises: ${excludedExercises.join(', ')}`);
  }

  // ---- Hard rules (the few non-negotiables) ----
  const hardRules: string[] = [
    `1. Produce EXACTLY ${weeklyDays} workout days.`,
    `2. Use ONLY exercise names from the AVAILABLE EXERCISES list, copied verbatim (including any "(Equipment)" suffix). Never invent or substitute a name. The list is already limited to the lifter's available equipment.`,
  ];
  let ruleN = 3;
  if (includedExercises && includedExercises.length > 0) {
    hardRules.push(`${ruleN++}. Every "must include" exercise must appear at least once.`);
  }
  if (excludedExercises && excludedExercises.length > 0) {
    hardRules.push(`${ruleN++}. Never use any "never include" exercise.`);
  }
  if (ignoredMuscles && ignoredMuscles.length > 0) {
    hardRules.push(`${ruleN++}. Include no direct work for the avoided areas (${ignoredMuscles.join(', ')}).`);
  }

  // ---- Shared context blocks ----
  const aboutBlock = `================================================================================
ABOUT THE LIFTER
================================================================================
Body weight: ${userBodyWeight} ${weightUnit}
Gender: ${gender}
Available equipment: ${userEquipmentDisplay}
Strength level: ${userStrengthLevel}

${exerciseHistorySummary}`;

  const exercisesBlock = `================================================================================
AVAILABLE EXERCISES (use ONLY these names, copied exactly)
================================================================================
${allExerciseNames.join(', ')}

${customExercisesSummary}`;

  const hardRulesBlock = `================================================================================
HARD RULES (do not break these)
================================================================================
${hardRules.join('\n')}`;

  const outputBlock = `================================================================================
OUTPUT FORMAT
================================================================================
Return ONLY valid JSON. No markdown, no backticks, no explanation.

{
  "programName": "A short, descriptive name for the program",
  "programStyle": "ppl | upper_lower | full_body | bro_split | powerbuilding | strength | custom (whichever best describes the program)",
  "trainingGoal": "${trainingGoal}",
  "routines": [
    {
      "name": "Day Name",
      "dayNumber": 1,
      "focus": "Short description of the day's focus",
      "targetMuscles": ["muscle1", "muscle2"],
      "exercises": [
        { "name": "Exercise (Equipment)", "sets": 3, "reps": 10, "notes": "optional coaching note" }
      ],
      "estimatedTime": "50 min"
    }
  ]
}

Reminder: exactly ${weeklyDays} days, exercise names copied exactly from the available list, and all HARD RULES respected.`;

  const choicesBlock = `================================================================================
THE LIFTER'S CHOICES (these drive the design)
================================================================================
${choices.join('\n')}`;

  // ---- Refinement mode: revise an existing program in place ----
  if (isRefine) {
    return `You are an expert strength and conditioning coach revising a program you already wrote for one lifter.
Apply the lifter's requested change below. Make the smallest set of edits that fully satisfies the request —
keep everything else about the program intact unless the change requires otherwise. The result must still be a
complete, coherent program that respects every HARD RULE.

${choicesBlock}

================================================================================
CURRENT PROGRAM (revise this)
================================================================================
${currentProgramJson}

================================================================================
REQUESTED CHANGE (apply this)
================================================================================
"${refineInstruction!.trim()}"

${aboutBlock}

${exercisesBlock}

${hardRulesBlock}

${outputBlock}

Return the FULL updated program (all ${weeklyDays} days), not just the parts you changed.`;
  }

  // ---- Generation mode: design from scratch ----
  return `You are an expert strength and conditioning coach designing a program for one lifter.
Use your own judgment to build the best program for them based on the choices below. You have full
freedom over the split structure, exercise selection, set and rep schemes, exercise order, and how
the week is organized — there is no fixed template to follow. Design what a great coach actually would.

${choicesBlock}

${aboutBlock}

${exercisesBlock}

${hardRulesBlock}

Everything else is your call. Choose the split, volume, rep ranges, and exercise mix that genuinely
best serve this lifter's goal, schedule, and experience. Favor exercises the lifter already trains
when it fits the plan.

${outputBlock}`;
}
