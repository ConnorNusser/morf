/**
 * Integration test for AI workout parsing
 * Tests raw AI output with real workout inputs
 */

import { exerciseNameToId } from '../lib/data/exerciseUtils';
import { ALL_WORKOUTS } from '../lib/workout/workouts';

// Skip in CI - requires API key
const describeIfApi = process.env.EXPO_PUBLIC_AI_API_KEY ? describe : describe.skip;

// ============================================================================
// TEST DATA
// ============================================================================

interface ExpectedSet {
  weight: number;
  reps: number;
  unit: 'lbs' | 'kg';
}

interface ExpectedExercise {
  name: string;
  exerciseId: string;
  sets: ExpectedSet[];
  recommendedSets?: ExpectedSet[];
  allowCustom?: boolean;
}

interface TestCase {
  name: string;
  input: string;
  expected: ExpectedExercise[];
}

const AI_PARSE_TEST_CASES: TestCase[] = [
  {
    name: 'Target keyword separates planned vs actual sets',
    input: `
Bench target 135x8, did 145x8, 155x6
Squat target 225x5, hit 235x5, 245x3
Deadlift goal 315x3, completed 325x3
    `.trim(),
    expected: [
      {
        name: 'Bench Press (Barbell)',
        exerciseId: 'bench-press-barbell',
        sets: [
          { weight: 145, reps: 8, unit: 'lbs' },
          { weight: 155, reps: 6, unit: 'lbs' },
        ],
        recommendedSets: [{ weight: 135, reps: 8, unit: 'lbs' }],
      },
      {
        name: 'Squat (Barbell)',
        exerciseId: 'squat-barbell',
        sets: [
          { weight: 235, reps: 5, unit: 'lbs' },
          { weight: 245, reps: 3, unit: 'lbs' },
        ],
        recommendedSets: [{ weight: 225, reps: 5, unit: 'lbs' }],
      },
      {
        name: 'Deadlift (Barbell)',
        exerciseId: 'deadlift-barbell',
        sets: [{ weight: 325, reps: 3, unit: 'lbs' }],
        recommendedSets: [{ weight: 315, reps: 3, unit: 'lbs' }],
      },
    ],
  },
  {
    name: 'Unconventional exercise names',
    input: `
Zercher Squats 185x5
Pendlay Rows 135x8
Jefferson Deadlift 225x3
Zottman Curls 25x12
Meadows Row 45x10
Tate Press 30x8
JM Press 95x6
    `.trim(),
    expected: [
      {
        name: 'Zercher Squat (Barbell)',
        exerciseId: 'zercher-squat-barbell',
        sets: [{ weight: 185, reps: 5, unit: 'lbs' }],
        allowCustom: true,
      },
      {
        name: 'Pendlay Row (Barbell)',
        exerciseId: 'pendlay-row-barbell',
        sets: [{ weight: 135, reps: 8, unit: 'lbs' }],
        allowCustom: true,
      },
      {
        name: 'Jefferson Deadlift (Barbell)',
        exerciseId: 'jefferson-deadlift-barbell',
        sets: [{ weight: 225, reps: 3, unit: 'lbs' }],
        allowCustom: true,
      },
      {
        name: 'Zottman Curl (Dumbbells)',
        exerciseId: 'zottman-curl-dumbbells',
        sets: [{ weight: 25, reps: 12, unit: 'lbs' }],
        allowCustom: true,
      },
      {
        name: 'Meadows Row (Barbell)',
        exerciseId: 'meadows-row-barbell',
        sets: [{ weight: 45, reps: 10, unit: 'lbs' }],
        allowCustom: true,
      },
      {
        name: 'Tate Press (Dumbbells)',
        exerciseId: 'tate-press-dumbbells',
        sets: [{ weight: 30, reps: 8, unit: 'lbs' }],
        allowCustom: true,
      },
      {
        name: 'JM Press (Barbell)',
        exerciseId: 'jm-press-barbell',
        sets: [{ weight: 95, reps: 6, unit: 'lbs' }],
        allowCustom: true,
      },
    ],
  },
  {
    name: 'Real user input with abbreviations and missing equipment',
    input: `
Bench 135x5
Deadlift 135x8
Arnold press 135x5

Machine bench press 135x6

Smith machine bench 20x5

Super horziontal bench press machine 90x8
    `.trim(),
    expected: [
      {
        name: 'Bench Press (Barbell)',
        exerciseId: 'bench-press-barbell',
        sets: [{ weight: 135, reps: 5, unit: 'lbs' }],
      },
      {
        name: 'Deadlift (Barbell)',
        exerciseId: 'deadlift-barbell',
        sets: [{ weight: 135, reps: 8, unit: 'lbs' }],
      },
      {
        name: 'Arnold Press (Dumbbells)',
        exerciseId: 'arnold-press-dumbbells',
        sets: [{ weight: 135, reps: 5, unit: 'lbs' }],
        allowCustom: true,
      },
      {
        name: 'Bench Press (Machine)',
        exerciseId: 'bench-press-machine',
        sets: [{ weight: 135, reps: 6, unit: 'lbs' }],
      },
      {
        name: 'Bench Press (Smith Machine)',
        exerciseId: 'bench-press-smith-machine',
        sets: [{ weight: 20, reps: 5, unit: 'lbs' }],
      },
      {
        name: 'Super Horizontal Bench Press (Machine)',
        exerciseId: 'super-horizontal-bench-press-machine',
        sets: [{ weight: 90, reps: 8, unit: 'lbs' }],
        allowCustom: true,
      },
    ],
  },
  {
    name: 'Chest day with proper format',
    input: `
      Bench Press (Barbell) 135x10 145x8 155x6
      Incline Bench Press (Dumbbells) 40x12 45x10
      Chest Fly (Cables) 30x15 35x12
    `,
    expected: [
      {
        name: 'Bench Press (Barbell)',
        exerciseId: 'bench-press-barbell',
        sets: [
          { weight: 135, reps: 10, unit: 'lbs' },
          { weight: 145, reps: 8, unit: 'lbs' },
          { weight: 155, reps: 6, unit: 'lbs' },
        ],
      },
      {
        name: 'Incline Bench Press (Dumbbells)',
        exerciseId: 'incline-bench-press-dumbbells',
        sets: [
          { weight: 40, reps: 12, unit: 'lbs' },
          { weight: 45, reps: 10, unit: 'lbs' },
        ],
      },
      {
        name: 'Chest Fly (Cables)',
        exerciseId: 'chest-fly-cables',
        sets: [
          { weight: 30, reps: 15, unit: 'lbs' },
          { weight: 35, reps: 12, unit: 'lbs' },
        ],
      },
    ],
  },
];

const AI_PARSE_TEST_CASES_TARGET: TestCase[] = [
  {
    name: 'Target keyword separates planned vs actual sets',
    input: `
Bench 
Target: 135x8, 145x8, 155x6
Actual: 145x8, 155x6

Squat
Target: 225x5, 235x5, 245x3

    `.trim(),
    expected: [
      {
        name: 'Bench Press (Barbell)',
        exerciseId: 'bench-press-barbell',
        sets: [
          { weight: 145, reps: 8, unit: 'lbs' },
          { weight: 155, reps: 6, unit: 'lbs' },
        ],
        recommendedSets: [
          { weight: 135, reps: 8, unit: 'lbs' },
          { weight: 145, reps: 8, unit: 'lbs' },
          { weight: 155, reps: 6, unit: 'lbs' },
        ],
      },
      {
        name: 'Squat (Barbell)',
        exerciseId: 'squat-barbell',
        sets: [],
        recommendedSets: [
          { weight: 225, reps: 5, unit: 'lbs' },
          { weight: 235, reps: 5, unit: 'lbs' },
          { weight: 245, reps: 3, unit: 'lbs' },
        ],
      },
    ],
  },
];

const AI_PARSE_TEST_CASES_TARGET_ONLY: TestCase[] = [
  {
    name: 'Target sets with empty actual - workout template',
    input: `
Arnold Press (Dumbbells)
Target: 40x8, 45x6, 50x4
Actual

Lateral Raise (Dumbbells)
Target: 15x12, 20x10, 20x10
Actual

Shrugs (Barbell)
Target: 135x12, 145x10, 155x8
Actual

Incline Bench Press (Barbell)
Target: 175x4, 180x4, 185x3
Actual

Reverse Curl (Barbell)
Target: 50x12, 60x10, 60x10
Actual

Wrist Curl (Dumbbells)
Target: 20x15, 25x12, 25x12
Actual

Chest Fly (Cables)
Target: 30x15, 35x12, 40x10
Actual
    `.trim(),
    expected: [
      {
        name: 'Arnold Press (Dumbbells)',
        exerciseId: 'arnold-press-dumbbells',
        sets: [],
        recommendedSets: [
          { weight: 40, reps: 8, unit: 'lbs' },
          { weight: 45, reps: 6, unit: 'lbs' },
          { weight: 50, reps: 4, unit: 'lbs' },
        ],
        allowCustom: true,
      },
      {
        name: 'Lateral Raise (Dumbbells)',
        exerciseId: 'lateral-raise-dumbbells',
        sets: [],
        recommendedSets: [
          { weight: 15, reps: 12, unit: 'lbs' },
          { weight: 20, reps: 10, unit: 'lbs' },
          { weight: 20, reps: 10, unit: 'lbs' },
        ],
        allowCustom: true,
      },
      {
        name: 'Shrug (Barbell)',
        exerciseId: 'shrug-barbell',
        sets: [],
        recommendedSets: [
          { weight: 135, reps: 12, unit: 'lbs' },
          { weight: 145, reps: 10, unit: 'lbs' },
          { weight: 155, reps: 8, unit: 'lbs' },
        ],
        allowCustom: true,
      },
      {
        name: 'Incline Bench Press (Barbell)',
        exerciseId: 'incline-bench-press-barbell',
        sets: [],
        recommendedSets: [
          { weight: 175, reps: 4, unit: 'lbs' },
          { weight: 180, reps: 4, unit: 'lbs' },
          { weight: 185, reps: 3, unit: 'lbs' },
        ],
      },
      {
        name: 'Reverse Curl (Barbell)',
        exerciseId: 'reverse-curl-barbell',
        sets: [],
        recommendedSets: [
          { weight: 50, reps: 12, unit: 'lbs' },
          { weight: 60, reps: 10, unit: 'lbs' },
          { weight: 60, reps: 10, unit: 'lbs' },
        ],
        allowCustom: true,
      },
      {
        name: 'Wrist Curl (Dumbbells)',
        exerciseId: 'wrist-curl-dumbbells',
        sets: [],
        recommendedSets: [
          { weight: 20, reps: 15, unit: 'lbs' },
          { weight: 25, reps: 12, unit: 'lbs' },
          { weight: 25, reps: 12, unit: 'lbs' },
        ],
        allowCustom: true,
      },
      {
        name: 'Chest Fly (Cables)',
        exerciseId: 'chest-fly-cables',
        sets: [],
        recommendedSets: [
          { weight: 30, reps: 15, unit: 'lbs' },
          { weight: 35, reps: 12, unit: 'lbs' },
          { weight: 40, reps: 10, unit: 'lbs' },
        ],
      },
    ],
  },
];

// ============================================================================
// TESTS
// ============================================================================

// Combine all test cases into one array
const ALL_TEST_CASES: TestCase[] = [
  ...AI_PARSE_TEST_CASES,
  ...AI_PARSE_TEST_CASES_TARGET,
  ...AI_PARSE_TEST_CASES_TARGET_ONLY,
];

describeIfApi('AI Parser Integration', () => {
  const dbExerciseIds = new Set(ALL_WORKOUTS.map(e => e.id));

  test.each(ALL_TEST_CASES)(
    '$name',
    async ({ input, expected }) => {
      const OpenAI = (await import('openai')).default;
      const { buildWorkoutNoteParsingPrompt } = await import('../lib/ai/prompts/workoutNoteParsing.prompt');

      const openai = new OpenAI({
        apiKey: process.env.EXPO_PUBLIC_AI_API_KEY,
      });

      const prompt = buildWorkoutNoteParsingPrompt({
        text: input,
        defaultUnit: 'lbs',
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a workout log parser. Parse natural language workout notes into structured JSON. Return ONLY valid JSON, no markdown or formatting.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      expect(content).toBeTruthy();

      // Clean and parse
      let cleanedContent = content!.trim();
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
      }

      const parsed = JSON.parse(cleanedContent);

      /* eslint-disable no-console -- Test debugging output */
      // Helper to compare and log differences
      const logDiff = (label: string, ai: unknown, exp: unknown) => {
        const aiStr = JSON.stringify(ai);
        const expStr = JSON.stringify(exp);
        if (aiStr !== expStr) {
          console.log(`\n❌ MISMATCH in ${label}:`);
          console.log(`   AI:       ${aiStr}`);
          console.log(`   Expected: ${expStr}`);
        }
      };

      // Verify exercise count matches
      if (parsed.exercises.length !== expected.length) {
        console.log(`\n❌ Exercise count mismatch: AI=${parsed.exercises.length}, Expected=${expected.length}`);
        console.log('AI exercises:', parsed.exercises.map((e: { name: string }) => e.name));
        console.log('Expected:', expected.map(e => e.name));
      }
      /* eslint-enable no-console */
      expect(parsed.exercises.length).toBe(expected.length);

      // Verify each exercise
      for (let i = 0; i < expected.length; i++) {
        const aiExercise = parsed.exercises[i];
        const expectedExercise = expected[i];

        // Log mismatches only (normalize undefined to [] for sets comparison)
        logDiff(`Exercise ${i + 1} name`, aiExercise.name, expectedExercise.name);
        logDiff(`Exercise ${i + 1} sets`, aiExercise.sets || [], expectedExercise.sets);
        if (expectedExercise.recommendedSets) {
          logDiff(`Exercise ${i + 1} recommendedSets`, aiExercise.recommendedSets, expectedExercise.recommendedSets);
        }

        // Check name format (should end with equipment in parentheses)
        expect(aiExercise.name).toMatch(/\([^)]+\)$/);

        // Check exercise name matches expected
        expect(aiExercise.name).toBe(expectedExercise.name);

        // Check ID generation works correctly
        const generatedId = exerciseNameToId(aiExercise.name);
        if (expectedExercise.exerciseId) {
          expect(generatedId).toBe(expectedExercise.exerciseId);
        }

        // Check ID exists in database (unless marked as allowCustom)
        if (!expectedExercise.allowCustom) {
          expect(dbExerciseIds.has(generatedId)).toBe(true);
        }

        // Check sets count matches
        expect(aiExercise.sets?.length ?? 0).toBe(expectedExercise.sets.length);

        // Check each set's weight and reps
        for (let j = 0; j < expectedExercise.sets.length; j++) {
          expect(aiExercise.sets[j].weight).toBe(expectedExercise.sets[j].weight);
          expect(aiExercise.sets[j].reps).toBe(expectedExercise.sets[j].reps);
        }

        // Check recommendedSets if expected
        if (expectedExercise.recommendedSets) {
          expect(aiExercise.recommendedSets).toBeDefined();
          expect(aiExercise.recommendedSets.length).toBe(expectedExercise.recommendedSets.length);

          for (let j = 0; j < expectedExercise.recommendedSets.length; j++) {
            expect(aiExercise.recommendedSets[j].weight).toBe(expectedExercise.recommendedSets[j].weight);
            expect(aiExercise.recommendedSets[j].reps).toBe(expectedExercise.recommendedSets[j].reps);
          }
        }
      }
    },
    30000 // 30s timeout for API call
  );
});

// ============================================================================
// SUMMARY TESTS - Verify toSummary doesn't count target reps
// ============================================================================

describe('WorkoutNoteParser.toSummary', () => {
  it('should only count actual sets, not recommendedSets, in setCount', async () => {
    const { workoutNoteParser } = await import('../lib/workout/workoutNoteParser');

    // Create a mock parsed workout with both sets and recommendedSets
    const mockParsedWorkout = {
      exercises: [
        {
          name: 'Bench Press (Barbell)',
          matchedExerciseId: 'bench-press-barbell',
          isCustom: false,
          sets: [
            { weight: 145, reps: 8, unit: 'lbs' as const },
            { weight: 155, reps: 6, unit: 'lbs' as const },
          ],
          recommendedSets: [
            { weight: 135, reps: 8, unit: 'lbs' as const },
          ],
        },
        {
          name: 'Squat (Barbell)',
          matchedExerciseId: 'squat-barbell',
          isCustom: false,
          sets: [
            { weight: 235, reps: 5, unit: 'lbs' as const },
          ],
          recommendedSets: [
            { weight: 225, reps: 5, unit: 'lbs' as const },
            { weight: 225, reps: 5, unit: 'lbs' as const },
          ],
        },
      ],
      confidence: 0.95,
      rawText: 'test',
    };

    const summary = workoutNoteParser.toSummary(mockParsedWorkout);

    // Verify setCount only counts actual sets, NOT recommendedSets
    const benchSummary = summary.find(s => s.name.includes('Bench'));
    expect(benchSummary).toBeDefined();
    expect(benchSummary!.setCount).toBe(2); // Only actual sets
    expect(benchSummary!.sets.length).toBe(2);
    expect(benchSummary!.recommendedSets?.length).toBe(1);

    const squatSummary = summary.find(s => s.name.includes('Squat'));
    expect(squatSummary).toBeDefined();
    expect(squatSummary!.setCount).toBe(1); // Only 1 actual set, not 2 recommended
    expect(squatSummary!.sets.length).toBe(1);
    expect(squatSummary!.recommendedSets?.length).toBe(2);
  });

  it('should preserve recommendedSets in summary output', async () => {
    const { workoutNoteParser } = await import('../lib/workout/workoutNoteParser');

    const mockParsedWorkout = {
      exercises: [
        {
          name: 'Deadlift (Barbell)',
          matchedExerciseId: 'deadlift-barbell',
          isCustom: false,
          sets: [
            { weight: 325, reps: 3, unit: 'lbs' as const },
          ],
          recommendedSets: [
            { weight: 315, reps: 3, unit: 'lbs' as const },
          ],
        },
      ],
      confidence: 0.95,
      rawText: 'test',
    };

    const summary = workoutNoteParser.toSummary(mockParsedWorkout);

    expect(summary.length).toBe(1);
    expect(summary[0].recommendedSets).toBeDefined();
    expect(summary[0].recommendedSets![0].weight).toBe(315);
    expect(summary[0].recommendedSets![0].reps).toBe(3);
  });

  it('should consolidate same exercise with both sets and recommendedSets', async () => {
    const { workoutNoteParser } = await import('../lib/workout/workoutNoteParser');

    // Simulate logging the same exercise twice in one note
    const mockParsedWorkout = {
      exercises: [
        {
          name: 'Bench Press (Barbell)',
          matchedExerciseId: 'bench-press-barbell',
          isCustom: false,
          sets: [
            { weight: 145, reps: 8, unit: 'lbs' as const },
          ],
          recommendedSets: [
            { weight: 135, reps: 8, unit: 'lbs' as const },
          ],
        },
        {
          name: 'Bench Press (Barbell)',
          matchedExerciseId: 'bench-press-barbell',
          isCustom: false,
          sets: [
            { weight: 155, reps: 6, unit: 'lbs' as const },
          ],
          recommendedSets: [
            { weight: 140, reps: 8, unit: 'lbs' as const },
          ],
        },
      ],
      confidence: 0.95,
      rawText: 'test',
    };

    const summary = workoutNoteParser.toSummary(mockParsedWorkout);

    // Should consolidate into one exercise
    expect(summary.length).toBe(1);
    expect(summary[0].setCount).toBe(2); // 2 actual sets consolidated
    expect(summary[0].sets.length).toBe(2);
    expect(summary[0].recommendedSets?.length).toBe(2); // 2 recommended sets consolidated
  });
});
