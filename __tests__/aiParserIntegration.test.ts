/**
 * Integration test for AI workout parsing
 * Tests raw AI output with real workout inputs
 */

import { exerciseNameToId } from '../lib/exerciseUtils';
import { ALL_WORKOUTS } from '../lib/workouts';

// Skip in CI - requires API key
const describeIfApi = process.env.EXPO_PUBLIC_AI_API_KEY ? describe : describe.skip;

// ============================================================================
// TEST DATA
// ============================================================================

const AI_PARSE_TEST_CASES = [
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
        sets: [{ weight: 185, reps: 5 }],
        allowCustom: true,
      },
      {
        name: 'Pendlay Row (Barbell)',
        exerciseId: 'pendlay-row-barbell',
        sets: [{ weight: 135, reps: 8 }],
        allowCustom: true,
      },
      {
        name: 'Jefferson Deadlift (Barbell)',
        exerciseId: 'jefferson-deadlift-barbell',
        sets: [{ weight: 225, reps: 3 }],
        allowCustom: true,
      },
      {
        name: 'Zottman Curl (Dumbbells)',
        exerciseId: 'zottman-curl-dumbbells',
        sets: [{ weight: 25, reps: 12 }],
        allowCustom: true,
      },
      {
        name: 'Meadows Row (Barbell)',
        exerciseId: 'meadows-row-barbell',
        sets: [{ weight: 45, reps: 10 }],
        allowCustom: true,
      },
      {
        name: 'Tate Press (Dumbbells)',
        exerciseId: 'tate-press-dumbbells',
        sets: [{ weight: 30, reps: 8 }],
        allowCustom: true,
      },
      {
        name: 'JM Press (Barbell)',
        exerciseId: 'jm-press-barbell',
        sets: [{ weight: 95, reps: 6 }],
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
        sets: [{ weight: 135, reps: 5 }],
      },
      {
        name: 'Deadlift (Barbell)',
        exerciseId: 'deadlift-barbell',
        sets: [{ weight: 135, reps: 8 }],
      },
      {
        name: 'Arnold Press (Dumbbells)',
        exerciseId: 'arnold-press-dumbbells',
        sets: [{ weight: 135, reps: 5 }],
        allowCustom: true,
      },
      {
        name: 'Bench Press (Machine)',
        exerciseId: 'bench-press-machine',
        sets: [{ weight: 135, reps: 6 }],
      },
      {
        name: 'Bench Press (Smith Machine)',
        exerciseId: 'bench-press-smith-machine',
        sets: [{ weight: 20, reps: 5 }],
      },
      {
        name: 'Super Horizontal Bench Press (Machine)',
        exerciseId: 'super-horizontal-bench-press-machine',
        sets: [{ weight: 90, reps: 8 }],
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
          { weight: 135, reps: 10 },
          { weight: 145, reps: 8 },
          { weight: 155, reps: 6 },
        ],
      },
      {
        name: 'Incline Bench Press (Dumbbells)',
        exerciseId: 'incline-bench-press-dumbbells',
        sets: [
          { weight: 40, reps: 12 },
          { weight: 45, reps: 10 },
        ],
      },
      {
        name: 'Chest Fly (Cables)',
        exerciseId: 'chest-fly-cables',
        sets: [
          { weight: 30, reps: 15 },
          { weight: 35, reps: 12 },
        ],
      },
    ],
  },
];

// ============================================================================
// TESTS
// ============================================================================

describeIfApi('AI Parser Integration', () => {
  const dbExerciseIds = new Set(ALL_WORKOUTS.map(e => e.id));

  test.each(AI_PARSE_TEST_CASES)(
    '$name',
    async ({ input, expected }) => {
      const OpenAI = (await import('openai')).default;
      const { buildWorkoutNoteParsingPrompt } = await import('../lib/prompts/workoutNoteParsing.prompt');

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

      // Verify exercise count matches
      expect(parsed.exercises.length).toBe(expected.length);

      // Verify each exercise
      for (let i = 0; i < expected.length; i++) {
        const aiExercise = parsed.exercises[i];
        const expectedExercise = expected[i];

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
        expect(aiExercise.sets.length).toBe(expectedExercise.sets.length);

        // Check each set's weight and reps
        for (let j = 0; j < expectedExercise.sets.length; j++) {
          expect(aiExercise.sets[j].weight).toBe(expectedExercise.sets[j].weight);
          expect(aiExercise.sets[j].reps).toBe(expectedExercise.sets[j].reps);
        }
      }
    },
    30000 // 30s timeout for API call
  );
});
