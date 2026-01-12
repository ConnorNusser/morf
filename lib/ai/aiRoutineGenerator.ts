/**
 * AI-powered Routine Generator
 * Creates workout routines based on proven program methodologies
 */

import { CustomExercise, Equipment, GeneratedWorkout, Routine, RoutineExercise, UserProfile } from '@/types';
import OpenAI from 'openai';
import { analyticsService } from '@/lib/services/analytics';
import {
  buildRoutineGenerationPrompt,
  ProgramTemplate,
  TrainingGoal,
  PROGRAM_TEMPLATES,
  RoutineGenerationParams,
} from './prompts/routineGeneration.prompt';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { getAvailableWorkouts, getWorkoutsByEquipment, ALL_WORKOUTS } from '@/lib/workout/workouts';
import { calculateStrengthPercentile, MALE_STANDARDS, FEMALE_STANDARDS } from '@/lib/data/strengthStandards';
import { determineTrainingAdvancement, PROGRAMMING_RULES } from '@/lib/workout/trainingAdvancement';

export { ProgramTemplate, TrainingGoal, PROGRAM_TEMPLATES };

interface GeneratedRoutineDay {
  name: string;
  dayNumber: number;
  focus: string;
  targetMuscles: string[];
  exercises: {
    name: string;
    sets: number;
    reps: number | string;
    notes?: string;
  }[];
  estimatedTime: string;
}

export interface GeneratedRoutineProgram {
  programName: string;
  programDescription: string;
  programStyle: ProgramTemplate;
  trainingGoal: TrainingGoal;
  weeklyVolume: string;
  estimatedDuration: string;
  routines: GeneratedRoutineDay[];
  weeklySchedule: string;
  progressionNotes: string;
}

interface GenerateRoutineOptions {
  programTemplate: ProgramTemplate;
  trainingGoal: TrainingGoal;
  weeklyDays: number;
  focusMuscles?: string[];
  trainingYears?: number;  // Override training years for advancement calculation
  workoutDuration?: number;  // Duration in minutes (30, 60, 90, 120)
  exercisesPerWorkout?: { min: number; max: number };  // Exercise count constraints
  includedExercises?: string[];  // Exercises to definitely include
  excludedExercises?: string[];  // Exercises to definitely exclude
}

class AIRoutineGeneratorService {
  private readonly AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.AI_API_KEY || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate a routine program based on proven methodologies
   */
  async generateRoutineProgram(options: GenerateRoutineOptions): Promise<GeneratedRoutineProgram> {
    const userProfile = await userService.getRealUserProfile();
    const workoutHistory = await storageService.getWorkoutHistory();
    const customExercises = await storageService.getCustomExercises();

    if (!this.AI_API_KEY) {
      return this.generateFallbackProgram(userProfile, options);
    }

    try {
      const prompt = this.buildPrompt(userProfile, workoutHistory, customExercises, options);
      const response = await this.callAI(prompt, options.programTemplate);
      return response;
    } catch (error) {
      console.error('AI routine generation failed, using fallback:', error);
      return this.generateFallbackProgram(userProfile, options);
    }
  }

  /**
   * Convert a generated program to actual Routine objects that can be saved
   */
  async convertToRoutines(program: GeneratedRoutineProgram): Promise<Routine[]> {
    const routines: Routine[] = [];
    const customExercises = await storageService.getCustomExercises();

    for (const day of program.routines) {
      const exercises: RoutineExercise[] = [];

      for (const ex of day.exercises) {
        // Find matching exercise from database or custom exercises
        const matchedExercise = this.findExerciseByName(ex.name, customExercises);

        if (matchedExercise) {
          const reps = typeof ex.reps === 'number' ? ex.reps : parseInt(String(ex.reps)) || 10;
          exercises.push({
            exerciseId: matchedExercise.id,
            exerciseName: matchedExercise.name,  // Store name for display
            sets: Array(ex.sets).fill(null).map(() => ({ reps })),
            intensityModifier: 'heavy',
            notes: ex.notes,
          });
        }
      }

      const routine: Routine = {
        id: `${program.programStyle}-${day.dayNumber}-${Date.now()}`,
        name: day.name,
        exercises,
        createdAt: new Date(),
        description: day.focus,
        isActive: true,
      };

      routines.push(routine);
    }

    return routines;
  }

  /**
   * Find exercise by name in built-in database and custom exercises
   */
  private findExerciseByName(
    name: string,
    customExercises: CustomExercise[]
  ): { id: string; name: string } | null {
    const cleanName = name.toLowerCase().trim();

    // 1. Direct match in built-in exercises
    for (const exercise of ALL_WORKOUTS) {
      if (exercise.name.toLowerCase() === cleanName) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    // 2. Direct match in custom exercises
    for (const exercise of customExercises) {
      if (exercise.name.toLowerCase() === cleanName) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    // 3. Partial match in built-in exercises (contains)
    for (const exercise of ALL_WORKOUTS) {
      if (exercise.name.toLowerCase().includes(cleanName) ||
          cleanName.includes(exercise.name.toLowerCase())) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    // 4. Partial match in custom exercises (contains)
    for (const exercise of customExercises) {
      if (exercise.name.toLowerCase().includes(cleanName) ||
          cleanName.includes(exercise.name.toLowerCase())) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    // 5. Try matching without equipment suffix (built-in)
    const nameWithoutEquipment = cleanName.replace(/\s*\([^)]*\)\s*$/, '').trim();
    for (const exercise of ALL_WORKOUTS) {
      const exerciseWithoutEquipment = exercise.name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (exerciseWithoutEquipment === nameWithoutEquipment) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    // 6. Try matching without equipment suffix (custom)
    for (const exercise of customExercises) {
      const exerciseWithoutEquipment = exercise.name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (exerciseWithoutEquipment === nameWithoutEquipment) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    return null;
  }

  private buildPrompt(
    userProfile: UserProfile | null,
    workoutHistory: GeneratedWorkout[],
    customExercises: CustomExercise[],
    options: GenerateRoutineOptions
  ): string {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const gender = userProfile?.gender || 'male';
    const bodyWeight = userProfile?.weight?.value || 150;
    const userEquipment = userProfile?.equipmentFilter?.includedEquipment ||
      ['barbell', 'dumbbell', 'machine', 'smith-machine', 'cable', 'kettlebell', 'bodyweight'] as Equipment[];

    // Calculate user's strength level
    const strengthLevel = this.calculateStrengthLevel(workoutHistory, userProfile);

    // Get available exercises
    const availableExercises = userEquipment.length > 0
      ? getWorkoutsByEquipment(userEquipment, 100)
      : getAvailableWorkouts(100);
    const exerciseNames = availableExercises.map(e => e.name);
    const customExerciseNames = customExercises.map(e => e.name);
    const allExerciseNames = [...exerciseNames, ...customExerciseNames];

    // Format equipment
    const equipmentDisplayMap: Record<Equipment, string> = {
      barbell: 'Barbell',
      dumbbell: 'Dumbbells',
      machine: 'Machines',
      'smith-machine': 'Smith Machine',
      cable: 'Cables',
      kettlebell: 'Kettlebell',
      bodyweight: 'Bodyweight',
    };
    const userEquipmentDisplay = userEquipment.map(e => equipmentDisplayMap[e]).join(', ');

    // Build exercise history summary
    const recentWorkouts = workoutHistory.slice(-10);
    const exerciseMap = new Map<string, { weight: number; reps: number }>();

    for (const workout of recentWorkouts) {
      for (const ex of workout.exercises) {
        const bestSet = ex.completedSets?.reduce((best, current) =>
          (current.weight > best.weight) ? current : best,
          { weight: 0, reps: 0 }
        );
        if (bestSet && bestSet.weight > 0) {
          const current = exerciseMap.get(ex.id);
          if (!current || bestSet.weight > current.weight) {
            exerciseMap.set(ex.id, { weight: bestSet.weight, reps: bestSet.reps });
          }
        }
      }
    }

    const exerciseHistorySummary = exerciseMap.size > 0
      ? `Recent PRs:\n${Array.from(exerciseMap.entries())
          .slice(0, 10)
          .map(([id, data]) => `- ${id}: ${data.weight}${weightUnit} x ${data.reps}`)
          .join('\n')}`
      : 'No recent workout history - use reasonable starting weights.';

    const customExercisesSummary = customExerciseNames.length > 0
      ? `Custom exercises: ${customExerciseNames.join(', ')}`
      : '';

    // Determine training advancement for fatigue management
    // Use options.trainingYears if provided (from UI), otherwise use profile
    const profileWithTrainingYears = userProfile
      ? { ...userProfile, trainingYears: options.trainingYears ?? userProfile.trainingYears }
      : null;
    const advancementResult = determineTrainingAdvancement(workoutHistory, profileWithTrainingYears);
    const programmingConfig = PROGRAMMING_RULES[advancementResult.level];

    console.log(`[RoutineGenerator] Training advancement: ${advancementResult.level} (source: ${advancementResult.source}, confidence: ${advancementResult.confidence})`);

    // Filter out excluded exercises and map included exercise IDs to names
    let filteredExerciseNames = allExerciseNames;
    if (options.excludedExercises && options.excludedExercises.length > 0) {
      const excludedSet = new Set(options.excludedExercises);
      filteredExerciseNames = allExerciseNames.filter(name => {
        // Match by checking if any excluded ID corresponds to this name
        const exercise = [...availableExercises, ...customExercises].find(e => e.name === name);
        return !exercise || !excludedSet.has(exercise.id);
      });
    }

    // Get names of included exercises
    const includedExerciseNames = options.includedExercises
      ? options.includedExercises
          .map(id => {
            const exercise = [...availableExercises, ...customExercises].find(e => e.id === id);
            return exercise?.name;
          })
          .filter((name): name is string => !!name)
      : undefined;

    const params: RoutineGenerationParams = {
      programTemplate: options.programTemplate,
      trainingGoal: options.trainingGoal,
      userStrengthLevel: strengthLevel,
      userBodyWeight: bodyWeight,
      weightUnit,
      gender,
      userEquipmentDisplay,
      exerciseHistorySummary,
      customExercisesSummary,
      allExerciseNames: filteredExerciseNames,
      weeklyDays: options.weeklyDays,
      focusMuscles: options.focusMuscles,
      trainingAdvancement: {
        level: advancementResult.level,
        allowHeavySquatAndDeadliftSameDay: programmingConfig.allowHeavySquatAndDeadliftSameDay,
        maxSetsPerMusclePerSession: programmingConfig.maxSetsPerMusclePerSession,
        suggestedFrequency: programmingConfig.suggestedFrequency,
      },
      workoutDuration: options.workoutDuration,
      exercisesPerWorkout: options.exercisesPerWorkout,
      includedExercises: includedExerciseNames,
    };

    return buildRoutineGenerationPrompt(params);
  }

  private calculateStrengthLevel(
    workoutHistory: GeneratedWorkout[],
    userProfile: UserProfile | null
  ): string {
    if (!userProfile?.weight?.value || workoutHistory.length === 0) {
      return 'Beginner';
    }

    const gender = userProfile.gender || 'male';
    const bodyWeight = userProfile.weight.value;
    const standards = gender === 'male' ? MALE_STANDARDS : FEMALE_STANDARDS;
    const percentiles: number[] = [];

    // Check recent workouts for main lifts
    for (const workout of workoutHistory.slice(-20)) {
      for (const ex of workout.exercises) {
        if (standards[ex.id]) {
          const bestSet = ex.completedSets?.reduce((best, current) =>
            (current.weight > best.weight) ? current : best,
            { weight: 0, reps: 0 }
          );
          if (bestSet && bestSet.weight > 0) {
            const percentile = calculateStrengthPercentile(
              bestSet.weight,
              bodyWeight,
              gender,
              ex.id
            );
            percentiles.push(percentile);
          }
        }
      }
    }

    if (percentiles.length === 0) {
      return 'Beginner';
    }

    const avgPercentile = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;

    // Convert percentile to training level
    if (avgPercentile < 20) return 'Beginner';
    if (avgPercentile < 40) return 'Novice';
    if (avgPercentile < 60) return 'Intermediate';
    if (avgPercentile < 80) return 'Advanced';
    return 'Elite';
  }

  private async callAI(prompt: string, programTemplate: ProgramTemplate): Promise<GeneratedRoutineProgram> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `You are an experienced strength and conditioning coach. Create practical, evidence-based workout programs.

STRICT RULES:
1. ONLY use exercises from the "AVAILABLE EXERCISES" list - do NOT invent, substitute, or add any exercises not explicitly listed
2. Follow the "CRITICAL REQUIREMENTS" section exactly - these constraints (exercise counts, included exercises, fatigue management) override all other guidelines
3. If a required exercise is listed, it MUST appear in the program
4. If an exercise is NOT in the available list, do NOT use it under any circumstances

Return only valid JSON.`,
        },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from AI');
    }

    // Clean response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    }

    const parsed = JSON.parse(cleanedContent);

    // Track analytics
    analyticsService.trackAIUsage({
      requestType: 'routine_generate',
      inputText: programTemplate,
      outputData: { programName: parsed.programName, routineCount: parsed.routines?.length },
      tokensUsed: response.usage?.total_tokens,
      model: 'gpt-5-mini',
    });

    return parsed;
  }

  private generateFallbackProgram(
    userProfile: UserProfile | null,
    options: GenerateRoutineOptions
  ): GeneratedRoutineProgram {
    const templateInfo = PROGRAM_TEMPLATES[options.programTemplate] || PROGRAM_TEMPLATES.custom;

    // Generate based on days per week
    const routines: GeneratedRoutineDay[] = [];

    if (options.weeklyDays === 3) {
      // Full body or PPL condensed
      if (options.programTemplate === 'full_body' || options.trainingGoal === 'strength') {
        routines.push(
          this.createFallbackDay(1, 'Full Body A', 'Squat focus', ['legs', 'chest', 'back'], [
            { name: 'Squat (Barbell)', sets: 3, reps: 5 },
            { name: 'Bench Press (Barbell)', sets: 3, reps: 5 },
            { name: 'Row (Barbell)', sets: 3, reps: 5 },
            { name: 'Overhead Press (Barbell)', sets: 3, reps: 8 },
            { name: 'Bicep Curl (Barbell)', sets: 2, reps: 10 },
          ]),
          this.createFallbackDay(2, 'Full Body B', 'Deadlift focus', ['back', 'legs', 'shoulders'], [
            { name: 'Deadlift (Barbell)', sets: 3, reps: 5 },
            { name: 'Overhead Press (Barbell)', sets: 3, reps: 5 },
            { name: 'Lat Pulldown (Cables)', sets: 3, reps: 8 },
            { name: 'Leg Press (Machine)', sets: 3, reps: 10 },
            { name: 'Face Pull (Cables)', sets: 3, reps: 15 },
          ]),
          this.createFallbackDay(3, 'Full Body C', 'Bench focus', ['chest', 'back', 'legs'], [
            { name: 'Bench Press (Barbell)', sets: 3, reps: 5 },
            { name: 'Squat (Barbell)', sets: 3, reps: 5 },
            { name: 'Row (Cables)', sets: 3, reps: 8 },
            { name: 'Romanian Deadlift (Barbell)', sets: 3, reps: 8 },
            { name: 'Tricep Pushdown (Cables)', sets: 2, reps: 12 },
          ])
        );
      } else {
        // PPL condensed
        routines.push(
          this.createFallbackDay(1, 'Push', 'Chest, shoulders, triceps', ['chest', 'shoulders', 'triceps'], [
            { name: 'Bench Press (Barbell)', sets: 4, reps: 8 },
            { name: 'Overhead Press (Barbell)', sets: 3, reps: 10 },
            { name: 'Incline Bench Press (Dumbbells)', sets: 3, reps: 10 },
            { name: 'Lateral Raise (Dumbbells)', sets: 3, reps: 15 },
            { name: 'Tricep Pushdown (Cables)', sets: 3, reps: 12 },
          ]),
          this.createFallbackDay(2, 'Pull', 'Back and biceps', ['back', 'biceps'], [
            { name: 'Row (Barbell)', sets: 4, reps: 8 },
            { name: 'Lat Pulldown (Cables)', sets: 3, reps: 10 },
            { name: 'Row (Cables)', sets: 3, reps: 10 },
            { name: 'Face Pull (Cables)', sets: 3, reps: 15 },
            { name: 'Bicep Curl (Barbell)', sets: 3, reps: 10 },
          ]),
          this.createFallbackDay(3, 'Legs', 'Quads, hamstrings, glutes', ['legs', 'glutes'], [
            { name: 'Squat (Barbell)', sets: 4, reps: 6 },
            { name: 'Romanian Deadlift (Barbell)', sets: 3, reps: 10 },
            { name: 'Leg Press (Machine)', sets: 3, reps: 12 },
            { name: 'Leg Curl (Machine)', sets: 3, reps: 12 },
            { name: 'Calf Raise (Machine)', sets: 4, reps: 15 },
          ])
        );
      }
    } else if (options.weeklyDays === 4) {
      // Upper/Lower split (PHUL style)
      routines.push(
        this.createFallbackDay(1, 'Upper Power', 'Heavy upper body compounds', ['chest', 'back', 'shoulders'], [
          { name: 'Bench Press (Barbell)', sets: 4, reps: 5 },
          { name: 'Row (Barbell)', sets: 4, reps: 5 },
          { name: 'Overhead Press (Barbell)', sets: 3, reps: 6 },
          { name: 'Lat Pulldown (Cables)', sets: 3, reps: 8 },
          { name: 'Bicep Curl (Barbell)', sets: 2, reps: 8 },
        ]),
        this.createFallbackDay(2, 'Lower Power', 'Heavy lower body compounds', ['legs', 'glutes'], [
          { name: 'Squat (Barbell)', sets: 4, reps: 5 },
          { name: 'Deadlift (Barbell)', sets: 3, reps: 5 },
          { name: 'Leg Press (Machine)', sets: 3, reps: 8 },
          { name: 'Leg Curl (Machine)', sets: 3, reps: 8 },
          { name: 'Calf Raise (Machine)', sets: 4, reps: 10 },
        ]),
        this.createFallbackDay(3, 'Upper Hypertrophy', 'Volume upper body work', ['chest', 'back', 'arms'], [
          { name: 'Incline Bench Press (Dumbbells)', sets: 4, reps: 10 },
          { name: 'Row (Cables)', sets: 4, reps: 10 },
          { name: 'Shoulder Press (Dumbbells)', sets: 3, reps: 12 },
          { name: 'Lateral Raise (Dumbbells)', sets: 3, reps: 15 },
          { name: 'Bicep Curl (Dumbbells)', sets: 3, reps: 12 },
          { name: 'Tricep Pushdown (Cables)', sets: 3, reps: 12 },
        ]),
        this.createFallbackDay(4, 'Lower Hypertrophy', 'Volume lower body work', ['legs', 'glutes'], [
          { name: 'Romanian Deadlift (Barbell)', sets: 4, reps: 10 },
          { name: 'Leg Extension (Machine)', sets: 3, reps: 12 },
          { name: 'Leg Curl (Machine)', sets: 3, reps: 12 },
          { name: 'Hip Thrust (Barbell)', sets: 3, reps: 12 },
          { name: 'Calf Raise (Machine)', sets: 4, reps: 15 },
        ])
      );
    } else if (options.weeklyDays === 5) {
      // PHAT style or bro split
      routines.push(
        this.createFallbackDay(1, 'Upper Power', 'Heavy upper compounds', ['chest', 'back', 'shoulders'], [
          { name: 'Bench Press (Barbell)', sets: 4, reps: 5 },
          { name: 'Row (Barbell)', sets: 4, reps: 5 },
          { name: 'Overhead Press (Barbell)', sets: 3, reps: 6 },
          { name: 'Lat Pulldown (Cables)', sets: 3, reps: 8 },
        ]),
        this.createFallbackDay(2, 'Lower Power', 'Heavy lower compounds', ['legs', 'glutes'], [
          { name: 'Squat (Barbell)', sets: 4, reps: 5 },
          { name: 'Deadlift (Barbell)', sets: 3, reps: 5 },
          { name: 'Leg Press (Machine)', sets: 3, reps: 8 },
          { name: 'Leg Curl (Machine)', sets: 3, reps: 8 },
        ]),
        this.createFallbackDay(3, 'Back & Shoulders', 'Pull hypertrophy', ['back', 'shoulders'], [
          { name: 'Row (Cables)', sets: 4, reps: 10 },
          { name: 'Lat Pulldown (Cables)', sets: 4, reps: 10 },
          { name: 'Shoulder Press (Dumbbells)', sets: 3, reps: 12 },
          { name: 'Lateral Raise (Dumbbells)', sets: 4, reps: 15 },
          { name: 'Face Pull (Cables)', sets: 3, reps: 15 },
        ]),
        this.createFallbackDay(4, 'Chest & Arms', 'Push hypertrophy', ['chest', 'triceps', 'biceps'], [
          { name: 'Incline Bench Press (Dumbbells)', sets: 4, reps: 10 },
          { name: 'Chest Fly (Cables)', sets: 3, reps: 12 },
          { name: 'Tricep Pushdown (Cables)', sets: 3, reps: 12 },
          { name: 'Bicep Curl (Dumbbells)', sets: 3, reps: 12 },
          { name: 'Overhead Tricep Extension (Cables)', sets: 3, reps: 12 },
        ]),
        this.createFallbackDay(5, 'Legs Hypertrophy', 'Volume leg work', ['legs', 'glutes'], [
          { name: 'Hack Squat (Machine)', sets: 4, reps: 10 },
          { name: 'Romanian Deadlift (Barbell)', sets: 3, reps: 10 },
          { name: 'Leg Extension (Machine)', sets: 3, reps: 12 },
          { name: 'Leg Curl (Machine)', sets: 3, reps: 12 },
          { name: 'Hip Thrust (Barbell)', sets: 3, reps: 12 },
        ])
      );
    } else {
      // 6-day PPL
      routines.push(
        this.createFallbackDay(1, 'Push A', 'Chest focus', ['chest', 'shoulders', 'triceps'], [
          { name: 'Bench Press (Barbell)', sets: 4, reps: 6 },
          { name: 'Overhead Press (Barbell)', sets: 3, reps: 8 },
          { name: 'Incline Bench Press (Dumbbells)', sets: 3, reps: 10 },
          { name: 'Lateral Raise (Dumbbells)', sets: 3, reps: 15 },
          { name: 'Tricep Pushdown (Cables)', sets: 3, reps: 12 },
        ]),
        this.createFallbackDay(2, 'Pull A', 'Back focus', ['back', 'biceps'], [
          { name: 'Row (Barbell)', sets: 4, reps: 6 },
          { name: 'Lat Pulldown (Cables)', sets: 3, reps: 8 },
          { name: 'Row (Cables)', sets: 3, reps: 10 },
          { name: 'Face Pull (Cables)', sets: 3, reps: 15 },
          { name: 'Bicep Curl (Barbell)', sets: 3, reps: 10 },
        ]),
        this.createFallbackDay(3, 'Legs A', 'Squat focus', ['legs', 'glutes'], [
          { name: 'Squat (Barbell)', sets: 4, reps: 6 },
          { name: 'Romanian Deadlift (Barbell)', sets: 3, reps: 8 },
          { name: 'Leg Press (Machine)', sets: 3, reps: 10 },
          { name: 'Leg Curl (Machine)', sets: 3, reps: 10 },
          { name: 'Calf Raise (Machine)', sets: 4, reps: 15 },
        ]),
        this.createFallbackDay(4, 'Push B', 'Shoulder focus', ['shoulders', 'chest', 'triceps'], [
          { name: 'Overhead Press (Barbell)', sets: 4, reps: 6 },
          { name: 'Incline Bench Press (Barbell)', sets: 3, reps: 8 },
          { name: 'Chest Fly (Cables)', sets: 3, reps: 12 },
          { name: 'Lateral Raise (Cables)', sets: 3, reps: 15 },
          { name: 'Overhead Tricep Extension (Cables)', sets: 3, reps: 12 },
        ]),
        this.createFallbackDay(5, 'Pull B', 'Width focus', ['back', 'biceps'], [
          { name: 'Lat Pulldown (Cables)', sets: 4, reps: 8 },
          { name: 'Row (Cables)', sets: 3, reps: 10 },
          { name: 'Row (Barbell)', sets: 3, reps: 10 },
          { name: 'Rear Delt Fly (Cables)', sets: 3, reps: 15 },
          { name: 'Hammer Curl (Dumbbells)', sets: 3, reps: 12 },
        ]),
        this.createFallbackDay(6, 'Legs B', 'Deadlift focus', ['legs', 'glutes'], [
          { name: 'Deadlift (Barbell)', sets: 4, reps: 5 },
          { name: 'Front Squat (Barbell)', sets: 3, reps: 8 },
          { name: 'Leg Extension (Machine)', sets: 3, reps: 12 },
          { name: 'Hip Thrust (Barbell)', sets: 3, reps: 10 },
          { name: 'Calf Raise (Machine)', sets: 4, reps: 15 },
        ])
      );
    }

    const scheduleMap: Record<number, string> = {
      3: 'Mon / Wed / Fri',
      4: 'Mon / Tue / Thu / Fri',
      5: 'Mon / Tue / Wed / Fri / Sat',
      6: 'Mon / Tue / Wed / Thu / Fri / Sat',
    };

    // Apply exercise count constraints if specified
    const adjustedRoutines = options.exercisesPerWorkout
      ? routines.map(routine => ({
          ...routine,
          exercises: routine.exercises.slice(0, options.exercisesPerWorkout!.max),
        }))
      : routines;

    // Calculate estimated time based on exercise count
    const durationMap: Record<number, string> = {
      30: '~30 min',
      60: '~60 min',
      90: '~90 min',
      120: '~2 hours',
    };
    const estimatedDuration = options.workoutDuration
      ? durationMap[options.workoutDuration] || '45-60 min'
      : '45-60 min';

    return {
      programName: `${templateInfo.name} - ${options.weeklyDays} Day Program`,
      programDescription: templateInfo.description,
      programStyle: options.programTemplate,
      trainingGoal: options.trainingGoal,
      weeklyVolume: `${options.weeklyDays * 15}-${options.weeklyDays * 25} sets per muscle group`,
      estimatedDuration: `${estimatedDuration} per session`,
      routines: adjustedRoutines,
      weeklySchedule: scheduleMap[options.weeklyDays] || 'Flexible schedule',
      progressionNotes: 'Add 5lbs to upper body lifts and 10lbs to lower body lifts when you complete all sets at target reps.',
    };
  }

  private createFallbackDay(
    dayNumber: number,
    name: string,
    focus: string,
    targetMuscles: string[],
    exercises: { name: string; sets: number; reps: number }[]
  ): GeneratedRoutineDay {
    return {
      name,
      dayNumber,
      focus,
      targetMuscles,
      exercises: exercises.map(e => ({ ...e })),
      estimatedTime: '50 min',
    };
  }
}

export const aiRoutineGenerator = new AIRoutineGeneratorService();
