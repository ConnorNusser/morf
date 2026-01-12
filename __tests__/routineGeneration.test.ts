/**
 * Integration tests for AI routine generation
 * Tests the ACTUAL buildRoutineGenerationPrompt function and AI response
 * Uses REAL exercises from the database
 */

import OpenAI from 'openai';
import { buildRoutineGenerationPrompt, RoutineGenerationParams } from '../lib/ai/prompts/routineGeneration.prompt';
import exercises from '../lib/data/exercises.json';

// Skip in CI - requires API key
const describeIfApi = process.env.EXPO_PUBLIC_AI_API_KEY ? describe : describe.skip;

// Get all exercise names from the actual database
const ALL_EXERCISE_NAMES = exercises.map((e: { name: string }) => e.name);

// Helper to filter exercises by criteria
function getExerciseNames(filter?: {
  equipment?: string[];
  exclude?: string[];
}): string[] {
  let names = [...ALL_EXERCISE_NAMES];

  if (filter?.equipment) {
    names = names.filter(name =>
      filter.equipment!.some(eq => name.toLowerCase().includes(eq.toLowerCase()))
    );
  }

  if (filter?.exclude) {
    names = names.filter(name =>
      !filter.exclude!.some(ex => name.toLowerCase().includes(ex.toLowerCase()))
    );
  }

  return names;
}

// System prompt used in production
const SYSTEM_PROMPT = `You are an experienced strength and conditioning coach. Create practical, evidence-based workout programs.

STRICT RULES:
1. ONLY use exercises from the "AVAILABLE EXERCISES" list - do NOT invent, substitute, or add any exercises not explicitly listed
2. Follow the "CRITICAL REQUIREMENTS" section exactly - these constraints (exercise counts, included exercises, fatigue management) override all other guidelines
3. If a required exercise is listed, it MUST appear in the program
4. If an exercise is NOT in the available list, do NOT use it under any circumstances

Return only valid JSON.`;

// Helper to clean and parse AI response JSON
function parseAIResponse(content: string): any {
  let cleaned = content.trim();
  // Remove markdown code blocks
  cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').replace(/```$/g, '');
  // Try to find JSON object if there's other text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  return JSON.parse(cleaned);
}

// ============================================================================
// EXERCISE COUNT TESTS
// ============================================================================

describeIfApi('AI Routine Generation - Exercise Count', () => {
  it('should generate exactly 4 exercises when exercisesPerWorkout is 4-4', async () => {
    const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_AI_API_KEY });

    const params: RoutineGenerationParams = {
      programTemplate: 'full_body',
      trainingGoal: 'strength',
      userStrengthLevel: 'Intermediate',
      userBodyWeight: 180,
      weightUnit: 'lbs',
      gender: 'male',
      userEquipmentDisplay: 'Barbell, Cables, Machines',
      exerciseHistorySummary: 'No recent history',
      customExercisesSummary: '',
      allExerciseNames: getExerciseNames({ equipment: ['barbell', 'machine', 'cables'] }),
      weeklyDays: 3,
      exercisesPerWorkout: { min: 4, max: 4 },
      workoutDuration: 30,
    };

    const prompt = buildRoutineGenerationPrompt(params);
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    const result = parseAIResponse(content);

    /* eslint-disable no-console */
    for (const routine of result.routines) {
      console.log(`${routine.name}: ${routine.exercises.length} exercises`);
    }
    /* eslint-enable no-console */

    for (const routine of result.routines) {
      expect(routine.exercises.length).toBe(4);
    }
  }, 60000);

  it('should generate 7-8 exercises for 90 min workout', async () => {
    const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_AI_API_KEY });

    const params: RoutineGenerationParams = {
      programTemplate: 'upper_lower',
      trainingGoal: 'hypertrophy',
      userStrengthLevel: 'Intermediate',
      userBodyWeight: 175,
      weightUnit: 'lbs',
      gender: 'male',
      userEquipmentDisplay: 'Full gym',
      exerciseHistorySummary: 'No recent history',
      customExercisesSummary: '',
      allExerciseNames: ALL_EXERCISE_NAMES, // All exercises for longer workout
      weeklyDays: 4,
      exercisesPerWorkout: { min: 7, max: 8 },
      workoutDuration: 90,
    };

    const prompt = buildRoutineGenerationPrompt(params);
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    const result = parseAIResponse(content);

    /* eslint-disable no-console */
    for (const routine of result.routines) {
      console.log(`${routine.name}: ${routine.exercises.length} exercises`);
    }
    /* eslint-enable no-console */

    for (const routine of result.routines) {
      expect(routine.exercises.length).toBeGreaterThanOrEqual(7);
      expect(routine.exercises.length).toBeLessThanOrEqual(8);
    }
  }, 60000);
});

// ============================================================================
// EXERCISE EXCLUSION TESTS
// ============================================================================

describeIfApi('AI Routine Generation - Exercise Exclusion', () => {
  it('should NOT include Deadlift when excluded from allExerciseNames', async () => {
    const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_AI_API_KEY });

    // Exclude all deadlift variations
    const exercisesWithoutDeadlift = getExerciseNames({
      equipment: ['barbell', 'machine', 'cables'],
      exclude: ['deadlift'],
    });

    const params: RoutineGenerationParams = {
      programTemplate: 'full_body',
      trainingGoal: 'strength',
      userStrengthLevel: 'Intermediate',
      userBodyWeight: 180,
      weightUnit: 'lbs',
      gender: 'male',
      userEquipmentDisplay: 'Barbell, Machines',
      exerciseHistorySummary: 'No recent history',
      customExercisesSummary: '',
      allExerciseNames: exercisesWithoutDeadlift,
      weeklyDays: 3,
      exercisesPerWorkout: { min: 5, max: 5 },
    };

    const prompt = buildRoutineGenerationPrompt(params);
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    const result = parseAIResponse(content);

    const allExercises = result.routines.flatMap((r: any) => r.exercises.map((e: any) => e.name));

    /* eslint-disable no-console */
    console.log('All exercises:', allExercises);
    /* eslint-enable no-console */

    const hasDeadlift = allExercises.some((e: string) =>
      e.toLowerCase().includes('deadlift')
    );
    expect(hasDeadlift).toBe(false);
  }, 60000);

  it('should NOT include Squat when excluded from allExerciseNames', async () => {
    const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_AI_API_KEY });

    // Exclude all squat variations
    const exercisesWithoutSquat = getExerciseNames({
      equipment: ['barbell', 'machine', 'dumbbells'],
      exclude: ['squat'],
    });

    const params: RoutineGenerationParams = {
      programTemplate: 'upper_lower',
      trainingGoal: 'hypertrophy',
      userStrengthLevel: 'Intermediate',
      userBodyWeight: 175,
      weightUnit: 'lbs',
      gender: 'male',
      userEquipmentDisplay: 'Full gym',
      exerciseHistorySummary: 'No recent history',
      customExercisesSummary: '',
      allExerciseNames: exercisesWithoutSquat,
      weeklyDays: 4,
      exercisesPerWorkout: { min: 5, max: 6 },
    };

    const prompt = buildRoutineGenerationPrompt(params);
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    const result = parseAIResponse(content);

    const allExercises = result.routines.flatMap((r: any) => r.exercises.map((e: any) => e.name));

    /* eslint-disable no-console */
    console.log('All exercises:', allExercises);
    /* eslint-enable no-console */

    const hasSquat = allExercises.some((e: string) =>
      e.toLowerCase().includes('squat')
    );
    expect(hasSquat).toBe(false);
  }, 60000);
});

// ============================================================================
// EXERCISE INCLUSION TESTS
// ============================================================================

describeIfApi('AI Routine Generation - Exercise Inclusion', () => {
  it('should include Bench Press (Barbell) when in includedExercises', async () => {
    const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_AI_API_KEY });

    const params: RoutineGenerationParams = {
      programTemplate: 'full_body',
      trainingGoal: 'strength',
      userStrengthLevel: 'Intermediate',
      userBodyWeight: 180,
      weightUnit: 'lbs',
      gender: 'male',
      userEquipmentDisplay: 'Barbell',
      exerciseHistorySummary: 'No recent history',
      customExercisesSummary: '',
      allExerciseNames: getExerciseNames({ equipment: ['barbell', 'cables'] }),
      weeklyDays: 3,
      exercisesPerWorkout: { min: 4, max: 5 },
      includedExercises: ['Bench Press (Barbell)'],
    };

    const prompt = buildRoutineGenerationPrompt(params);
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    const result = parseAIResponse(content);

    const allExercises = result.routines.flatMap((r: any) => r.exercises.map((e: any) => e.name));

    /* eslint-disable no-console */
    console.log('All exercises:', allExercises);
    /* eslint-enable no-console */

    const hasBenchBarbell = allExercises.some((e: string) =>
      e.toLowerCase().includes('bench press')
    );
    expect(hasBenchBarbell).toBe(true);
  }, 60000);

  it('should include Bulgarian Split Squat when in includedExercises', async () => {
    const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_AI_API_KEY });

    const params: RoutineGenerationParams = {
      programTemplate: 'full_body',
      trainingGoal: 'hypertrophy',
      userStrengthLevel: 'Intermediate',
      userBodyWeight: 165,
      weightUnit: 'lbs',
      gender: 'female',
      userEquipmentDisplay: 'Dumbbells, Machines',
      exerciseHistorySummary: 'No recent history',
      customExercisesSummary: '',
      allExerciseNames: getExerciseNames({ equipment: ['dumbbells', 'machine', 'cables'] }),
      weeklyDays: 3,
      exercisesPerWorkout: { min: 5, max: 5 },
      includedExercises: ['Bulgarian Split Squat (Dumbbells)'],
    };

    const prompt = buildRoutineGenerationPrompt(params);
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    const result = parseAIResponse(content);

    const allExercises = result.routines.flatMap((r: any) => r.exercises.map((e: any) => e.name));

    /* eslint-disable no-console */
    console.log('All exercises:', allExercises);
    /* eslint-enable no-console */

    const hasBulgarianSplitSquat = allExercises.some((e: string) =>
      e.toLowerCase().includes('bulgarian') || e.toLowerCase().includes('split squat')
    );
    expect(hasBulgarianSplitSquat).toBe(true);
  }, 60000);
});

// ============================================================================
// FATIGUE MANAGEMENT - SQUAT/DEADLIFT SEPARATION
// ============================================================================

describeIfApi('AI Routine Generation - Fatigue Management', () => {
  it('should put Squat and Deadlift on SEPARATE days when both are required', async () => {
    const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_AI_API_KEY });

    // Use full_body with 3 days - each day is unique, so squat and deadlift
    // MUST be on different days when allowHeavySquatAndDeadliftSameDay is false
    const params: RoutineGenerationParams = {
      programTemplate: 'full_body',
      trainingGoal: 'strength',
      userStrengthLevel: 'Intermediate',
      userBodyWeight: 180,
      weightUnit: 'lbs',
      gender: 'male',
      userEquipmentDisplay: 'Full gym',
      exerciseHistorySummary: 'No recent history',
      customExercisesSummary: '',
      allExerciseNames: getExerciseNames({ equipment: ['barbell', 'machine', 'cables'] }),
      weeklyDays: 3,
      exercisesPerWorkout: { min: 5, max: 6 },
      // REQUIRE both squat and deadlift - they must be on separate days
      includedExercises: ['Squat (Barbell)', 'Deadlift (Barbell)'],
      trainingAdvancement: {
        level: 'intermediate',
        allowHeavySquatAndDeadliftSameDay: false,
        maxSetsPerMusclePerSession: 10,
        suggestedFrequency: { squat: 2, bench: 3, deadlift: 1.5 },
      },
    };

    const prompt = buildRoutineGenerationPrompt(params);
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    const result = parseAIResponse(content);

    const allExercises = result.routines.flatMap((r: any) => r.exercises.map((e: any) => e.name));

    /* eslint-disable no-console */
    console.log('All exercises:', allExercises);
    console.log('Checking squat/deadlift separation...');
    /* eslint-enable no-console */

    // First verify both exercises are in the program
    // Be EXACT - "Squat (Barbell)" not "Front Squat (Barbell)"
    const hasSquat = allExercises.some((e: string) =>
      e.toLowerCase() === 'squat (barbell)'
    );
    const hasDeadlift = allExercises.some((e: string) =>
      e.toLowerCase() === 'deadlift (barbell)'
    );

    expect(hasSquat).toBe(true);
    expect(hasDeadlift).toBe(true);

    // Check each routine - they should NOT be on the same day
    for (const routine of result.routines) {
      const exerciseNames = routine.exercises.map((e: any) => e.name.toLowerCase());

      // Be EXACT about what we're checking - only Squat (Barbell), not Front Squat
      const hasSquatInDay = exerciseNames.some((e: string) =>
        e === 'squat (barbell)'
      );
      const hasDeadliftInDay = exerciseNames.some((e: string) =>
        e === 'deadlift (barbell)'
      );

      /* eslint-disable no-console */
      console.log(`${routine.name}: Squat=${hasSquatInDay}, Deadlift=${hasDeadliftInDay}`);
      /* eslint-enable no-console */

      // Should NOT have both on same day
      expect(hasSquatInDay && hasDeadliftInDay).toBe(false);
    }
  }, 60000);
});

// ============================================================================
// COMBINED CONSTRAINTS
// ============================================================================

describeIfApi('AI Routine Generation - Combined', () => {
  it('should respect count + inclusion + exclusion together', async () => {
    const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_AI_API_KEY });

    // Exclude deadlift, require squat, exactly 4 exercises
    const exercisesNoDeadlift = getExerciseNames({
      equipment: ['barbell', 'machine', 'cables'],
      exclude: ['deadlift'],
    });

    const params: RoutineGenerationParams = {
      programTemplate: 'full_body',
      trainingGoal: 'strength',
      userStrengthLevel: 'Intermediate',
      userBodyWeight: 180,
      weightUnit: 'lbs',
      gender: 'male',
      userEquipmentDisplay: 'Full gym',
      exerciseHistorySummary: 'No recent history',
      customExercisesSummary: '',
      allExerciseNames: exercisesNoDeadlift,
      weeklyDays: 3,
      exercisesPerWorkout: { min: 4, max: 4 },
      includedExercises: ['Squat (Barbell)'],
    };

    const prompt = buildRoutineGenerationPrompt(params);
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '';
    const result = parseAIResponse(content);

    const allExercises = result.routines.flatMap((r: any) => r.exercises.map((e: any) => e.name));

    /* eslint-disable no-console */
    console.log('All exercises:', allExercises);
    /* eslint-enable no-console */

    // Should have exactly 4 exercises per routine
    for (const routine of result.routines) {
      expect(routine.exercises.length).toBe(4);
    }

    // Should have squat somewhere
    const hasSquat = allExercises.some((e: string) => e.toLowerCase().includes('squat'));
    expect(hasSquat).toBe(true);

    // Should NOT have any deadlift
    const hasDeadlift = allExercises.some((e: string) => e.toLowerCase().includes('deadlift'));
    expect(hasDeadlift).toBe(false);
  }, 60000);
});
