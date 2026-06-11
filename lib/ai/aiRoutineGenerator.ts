/**
 * AI-powered Routine Generator
 * Creates workout routines based on proven program methodologies
 */

import { CustomExercise, Equipment, ExerciseProgressionState, GeneratedWorkout, IntensityModifier, Routine, RoutineExercise, RoutineSet, UserProfile, WeightUnit, convertWeight } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
import { getAvailableWorkouts, getWorkoutsByEquipment, getWorkoutById, ALL_WORKOUTS } from '@/lib/workout/workouts';
import { calculateStrengthPercentile, MALE_STANDARDS, FEMALE_STANDARDS, OneRMCalculator } from '@/lib/data/strengthStandards';
import { determineTrainingAdvancement, PROGRAMMING_RULES } from '@/lib/workout/trainingAdvancement';
import { summarizeQuality, validateRoutineQuality } from '@/lib/workout/routineQuality';

export { ProgramTemplate, TrainingGoal, PROGRAM_TEMPLATES };

// Mirrors INTENSITY_MODIFIERS in progressiveOverload.ts (kept in sync intentionally)
// so a seeded starting weight matches what the workout screen later computes.
const INTENSITY_MULTIPLIERS: Record<IntensityModifier, number> = {
  heavy: 1.0,
  moderate: 0.9,
  light: 0.8,
};

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
  programStyle: ProgramTemplate;
  trainingGoal: TrainingGoal;
  routines: GeneratedRoutineDay[];
}

interface GenerateRoutineOptions {
  programTemplate: ProgramTemplate;
  trainingGoal: TrainingGoal;
  weeklyDays: number;
  focusMuscles?: string[];
  ignoredMuscles?: string[];  // Body parts to completely skip (e.g., "no legs")
  trainingYears?: number;  // Override training years for advancement calculation
  workoutDuration?: number;  // Duration in minutes (30, 60, 90, 120)
  exercisesPerWorkout?: { min: number; max: number };  // Exercise count constraints
  includedExercises?: string[];  // Exercises to definitely include
  excludedExercises?: string[];  // Exercises to definitely exclude
}

class AIRoutineGeneratorService {
  private readonly GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(this.GEMINI_API_KEY || '');
  }

  /**
   * Generate a routine program based on proven methodologies
   */
  async generateRoutineProgram(options: GenerateRoutineOptions): Promise<GeneratedRoutineProgram> {
    const userProfile = await userService.getRealUserProfile();
    const workoutHistory = await storageService.getWorkoutHistory();
    const customExercises = await storageService.getCustomExercises();

    if (!this.GEMINI_API_KEY) {
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
  async convertToRoutines(
    program: GeneratedRoutineProgram,
    options?: { excludedExerciseIds?: string[] }
  ): Promise<Routine[]> {
    const routines: Routine[] = [];
    const customExercises = await storageService.getCustomExercises();
    const workoutHistory = await storageService.getWorkoutHistory();
    const userProfile = await userService.getRealUserProfile();
    const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';
    const excludedIds = new Set(options?.excludedExerciseIds || []);

    for (const day of program.routines) {
      // Merge duplicate exercises into one entry. The AI sometimes emits the same lift
      // twice (e.g. a top set + an AMRAP back-off), which would otherwise create two
      // RoutineExercise entries sharing one exerciseId and collide in progressionState.
      const byId = new Map<string, RoutineExercise>();
      const order: string[] = [];

      for (const ex of day.exercises) {
        const matched = this.findExerciseByName(ex.name, customExercises);
        if (!matched) continue;                  // unmatched name: skip rather than guess
        if (excludedIds.has(matched.id)) continue; // enforce hard excludes at the seam

        const reps = this.parseReps(ex.reps);
        const setCount = Math.max(1, Math.round(Number(ex.sets) || 1));
        const newSets: RoutineSet[] = Array.from({ length: setCount }, () => ({ reps }));

        const existing = byId.get(matched.id);
        if (existing) {
          existing.sets.push(...newSets);
          if (!existing.notes && ex.notes) existing.notes = ex.notes;
        } else {
          byId.set(matched.id, {
            exerciseId: matched.id,
            exerciseName: matched.name,  // Store name for display
            sets: newSets,
            intensityModifier: this.deriveIntensity(matched.id, reps),
            notes: ex.notes,
          });
          order.push(matched.id);
        }
      }

      const exercises = order.map(id => byId.get(id)!);

      // Initialize progression state, seeding the starting weight from history when we have it
      const progressionState: Record<string, ExerciseProgressionState> = {};
      for (const ex of exercises) {
        const baseReps = ex.sets[0]?.reps || 10;
        progressionState[ex.exerciseId] = {
          baseReps,
          currentRepBonus: 0,
          currentWeight: this.seedWeightFromHistory(
            ex.exerciseId, baseReps, ex.intensityModifier, workoutHistory, weightUnit
          ),
          consecutiveFailures: 0,
        };
      }

      const routine: Routine = {
        id: `${program.programStyle}-${day.dayNumber}-${Date.now()}`,
        name: day.name,
        exercises,
        createdAt: new Date(),
        description: day.focus,
        isActive: true,
        progressionState,
      };

      routines.push(routine);
    }

    // Quality gate: score the converted program against traditional split norms
    // so low-quality generations are observable (ordering, muscle gaps, push/pull
    // imbalance, absurd volume). Non-blocking — we surface, not suppress.
    const quality = validateRoutineQuality(routines);
    if (!quality.passed) {
      console.warn(
        `[routine-gen] ${summarizeQuality(quality)} ` +
          quality.issues.map(i => `${i.severity}:${i.code}`).join(', '),
      );
    }

    return routines;
  }

  /**
   * Parse a generated reps value into a single base rep count.
   * Handles ranges ("8-12" -> 8), AMRAP markers ("5+" -> 5), and time-based
   * prescriptions ("30-60 sec" -> 30). The low end of a range is the correct base:
   * the double-progression engine walks reps UP from base toward the top of the range.
   */
  private parseReps(raw: number | string): number {
    if (typeof raw === 'number') return raw > 0 ? Math.round(raw) : 10;
    const match = String(raw).match(/\d+/);
    const n = match ? parseInt(match[0], 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  /**
   * Derive intensity from exercise type + rep target instead of a blanket 'heavy'.
   * intensityModifier scales the working weight in progressiveOverload, so tagging
   * isolation work 'heavy' over-loads it. Compounds at low reps stay heavy.
   */
  private deriveIntensity(exerciseId: string, baseReps: number): IntensityModifier {
    const exercise = getWorkoutById(exerciseId);
    const isCompound = exercise?.category === 'compound';
    if (!isCompound) return 'light';     // isolation / accessory work
    if (baseReps <= 6) return 'heavy';   // heavy compound work
    return 'moderate';                    // higher-rep compound work
  }

  /**
   * Seed a starting weight from the user's best estimated 1RM for this exercise.
   * Mirrors progressiveOverload's formula (1RM x rep% x intensity) so the seeded
   * weight matches what the workout screen would compute. Returns 0 when there's no
   * usable history — progressiveOverload then falls back to a live 1RM calculation.
   */
  private seedWeightFromHistory(
    exerciseId: string,
    targetReps: number,
    intensity: IntensityModifier | undefined,
    workoutHistory: GeneratedWorkout[],
    unit: WeightUnit
  ): number {
    let best1RM = 0;
    for (const workout of workoutHistory) {
      const ex = workout.exercises.find(e => e.id === exerciseId);
      if (!ex?.completedSets) continue;
      for (const s of ex.completedSets) {
        if (!s.completed || s.weight <= 0 || s.reps <= 0) continue;
        const w = s.unit && s.unit !== unit ? convertWeight(s.weight, s.unit, unit) : s.weight;
        best1RM = Math.max(best1RM, OneRMCalculator.estimate(w, s.reps));
      }
    }
    if (best1RM <= 0) return 0;

    const intensityMultiplier = INTENSITY_MULTIPLIERS[intensity || 'heavy'];
    const repPercentage = OneRMCalculator.getPercentageFor(targetReps) / 100;
    const raw = best1RM * repPercentage * intensityMultiplier;

    const increment = unit === 'kg' ? 2.5 : 5;
    return Math.round(raw / increment) * increment;
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

    // Build exercise history summary with names, PRs, and frequency
    const recentWorkouts = workoutHistory.slice(-20);
    const exerciseStats = new Map<string, {
      name: string;
      weight: number;
      reps: number;
      frequency: number;  // How many workouts this exercise appeared in
    }>();

    // Create ID to name lookup from ALL_WORKOUTS
    const idToName = new Map<string, string>();
    for (const workout of ALL_WORKOUTS) {
      idToName.set(workout.id, workout.name);
    }
    // Also add custom exercises
    for (const custom of customExercises) {
      idToName.set(custom.id, custom.name);
    }

    for (const workout of recentWorkouts) {
      // Track which exercises we've already counted in this workout
      const countedInThisWorkout = new Set<string>();

      for (const ex of workout.exercises) {
        // Skip if we've already counted this exercise in this workout
        if (countedInThisWorkout.has(ex.id)) continue;
        countedInThisWorkout.add(ex.id);

        const exerciseName = idToName.get(ex.id) || ex.id;

        const bestSet = ex.completedSets?.reduce((best, current) =>
          (current.weight > best.weight) ? current : best,
          { weight: 0, reps: 0 }
        );

        const current = exerciseStats.get(ex.id);
        if (!current) {
          // First time seeing this exercise
          exerciseStats.set(ex.id, {
            name: exerciseName,
            weight: bestSet?.weight || 0,
            reps: bestSet?.reps || 0,
            frequency: 1
          });
        } else {
          // Increment frequency
          current.frequency++;
          // Update PR if higher
          if (bestSet && bestSet.weight > current.weight) {
            current.weight = bestSet.weight;
            current.reps = bestSet.reps;
          }
        }
      }
    }

    // Sort by frequency (most used first) and take top 15
    const sortedExercises = Array.from(exerciseStats.entries())
      .sort((a, b) => b[1].frequency - a[1].frequency)
      .slice(0, 15);

    const exerciseHistorySummary = sortedExercises.length > 0
      ? `USER'S TRAINING HISTORY (last ${recentWorkouts.length} workouts):\n${sortedExercises
          .map(([_, data]) => `- ${data.name}: ${data.weight}${weightUnit} x ${data.reps} PR, trained ${data.frequency}x`)
          .join('\n')}\n\nNote: Prioritize exercises the user frequently trains when building their program.`
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

    // Get names of excluded exercises. We already drop these from the available list, but
    // the model can still recall an excluded lift from training, so we also render an explicit
    // "MUST EXCLUDE" rule (and drop them again at the conversion seam as a backstop).
    const excludedExerciseNames = options.excludedExercises
      ? options.excludedExercises
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
      ignoredMuscles: options.ignoredMuscles,
      trainingAdvancement: {
        level: advancementResult.level,
        allowHeavySquatAndDeadliftSameDay: programmingConfig.allowHeavySquatAndDeadliftSameDay,
        maxSetsPerMusclePerSession: programmingConfig.maxSetsPerMusclePerSession,
        suggestedFrequency: programmingConfig.suggestedFrequency,
      },
      workoutDuration: options.workoutDuration,
      exercisesPerWorkout: options.exercisesPerWorkout,
      includedExercises: includedExerciseNames,
      excludedExercises: excludedExerciseNames,
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
    console.log('[RoutineGenerator] Calling Gemini with prompt length:', prompt.length);
    const startTime = Date.now();

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const systemPrompt = `You are an experienced strength and conditioning coach. Create practical, evidence-based workout programs.

STRICT RULES:
1. ONLY use exercises from the "AVAILABLE EXERCISES" list - do NOT invent, substitute, or add any exercises not explicitly listed
2. Follow the "CRITICAL REQUIREMENTS" section exactly - these constraints (exercise counts, included exercises, fatigue management) override all other guidelines
3. If a required exercise is listed, it MUST appear in the program
4. If an exercise is NOT in the available list, do NOT use it under any circumstances

Return only valid JSON.`;

    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const content = response.text();

    const elapsed = Date.now() - startTime;
    console.log(`[RoutineGenerator] Gemini response received in ${elapsed}ms, content length: ${content?.length || 0}`);

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
      model: 'gemini-2.5-flash',
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

    // Apply exercise count constraints if specified
    const adjustedRoutines = options.exercisesPerWorkout
      ? routines.map(routine => ({
          ...routine,
          exercises: routine.exercises.slice(0, options.exercisesPerWorkout!.max),
        }))
      : routines;

    return {
      programName: `${templateInfo.name} - ${options.weeklyDays} Day Program`,
      programStyle: options.programTemplate,
      trainingGoal: options.trainingGoal,
      routines: adjustedRoutines,
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
