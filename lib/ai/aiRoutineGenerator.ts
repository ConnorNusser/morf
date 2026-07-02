/**
 * AI-powered Routine Generator
 * Creates workout routines based on proven program methodologies
 */

import { CustomExercise, Equipment, GeneratedWorkout, IntensityModifier, Routine, RoutineExercise, RoutineSet, TrainingAdvancement, UserProfile, WeightUnit, convertWeight } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { analyticsService } from '@/lib/services/analytics';
import { parseGeminiJson } from './geminiJson';
import {
  buildRoutineGenerationPrompt,
  ProgramTemplate,
  RoutineGenerationParams,
} from './prompts/routineGeneration.prompt';
import { TrainingGoal } from './splitTemplates';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { getAvailableWorkouts, getWorkoutsByEquipment, getWorkoutById, ALL_WORKOUTS } from '@/lib/workout/workouts';
import { calculateStrengthPercentile, MALE_STANDARDS, FEMALE_STANDARDS, OneRMCalculator } from '@/lib/data/strengthStandards';
import { determineTrainingAdvancement, PROGRAMMING_RULES } from '@/lib/workout/trainingAdvancement';
import { classifyEquipment } from '@/lib/workout/equipmentProfile';
import { ALL_EQUIPMENT, formatEquipmentList } from '@/lib/workout/equipment';
import { buildDeterministicProgram } from '@/lib/workout/deterministicRoutineBuilder';

export { ProgramTemplate, TrainingGoal };

// Heaviest completed set by weight, or the zero seed when there are none.
function bestSetByWeight(sets?: { weight: number; reps: number }[]): { weight: number; reps: number } | undefined {
  return sets?.reduce((best, current) => (current.weight > best.weight ? current : best), { weight: 0, reps: 0 });
}

export interface GeneratedRoutineDay {
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
  /** Attribution when the program came from the deterministic template library. */
  source?: { program: string; url: string };
}

export interface GenerateRoutineOptions {
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
  experienceLevel?: TrainingAdvancement;  // Biases deterministic program selection
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
    const equipmentProfile = classifyEquipment(userProfile?.equipmentFilter?.includedEquipment);

    // Standard equipment → build deterministically from the attributed template library
    // (fast, consistent, no API call). Limited/odd setups fall through to the AI.
    if (equipmentProfile.tier === 'standard') {
      try {
        return this.buildDeterministic(options, equipmentProfile.available);
      } catch (error) {
        console.error('Deterministic build failed, falling back to AI:', error);
      }
    }

    // Limited/odd equipment (or a deterministic failure) → AI, with the template library
    // as the final fallback when the AI is unavailable or errors.
    if (!this.GEMINI_API_KEY) {
      return this.buildDeterministic(options, equipmentProfile.available);
    }

    try {
      const workoutHistory = await storageService.getWorkoutHistory();
      const customExercises = await storageService.getCustomExercises();
      const prompt = this.buildPrompt(userProfile, workoutHistory, customExercises, options);
      return await this.callAI(prompt, options.programTemplate);
    } catch (error) {
      console.error('AI routine generation failed, using template library:', error);
      return this.buildDeterministic(options, equipmentProfile.available);
    }
  }

  /** Build a program from the deterministic template library for the given equipment. */
  private buildDeterministic(options: GenerateRoutineOptions, equipment: Equipment[]): GeneratedRoutineProgram {
    return buildDeterministicProgram({
      goal: options.trainingGoal,
      days: options.weeklyDays,
      equipment,
      experience: options.experienceLevel,
      exerciseCount: options.exercisesPerWorkout,
      focusMuscles: options.focusMuscles,
      ignoredMuscles: options.ignoredMuscles,
      includedExerciseIds: options.includedExercises,
      excludedExerciseIds: options.excludedExercises,
    });
  }

  /**
   * Refine an already-generated program in place based on a freeform instruction
   * (e.g. "swap leg press for hack squat", "more chest volume", "shorten day 1").
   * Reuses the same lifter context/constraints as generation and asks the AI to
   * return the full revised program. Falls back to the unchanged program if the AI
   * is unavailable or errors.
   */
  async refineRoutineProgram(
    currentProgram: GeneratedRoutineProgram,
    instruction: string,
    options: GenerateRoutineOptions
  ): Promise<GeneratedRoutineProgram> {
    if (!this.GEMINI_API_KEY || !instruction.trim()) {
      return currentProgram;
    }

    try {
      const userProfile = await userService.getRealUserProfile();
      const workoutHistory = await storageService.getWorkoutHistory();
      const customExercises = await storageService.getCustomExercises();

      const prompt = this.buildPrompt(userProfile, workoutHistory, customExercises, options, {
        currentProgram,
        instruction: instruction.trim(),
      });
      return await this.callAI(prompt, options.programTemplate);
    } catch (error) {
      console.error('AI routine refinement failed, keeping current program:', error);
      return currentProgram;
    }
  }

  /**
   * Convert a generated program to actual Routine objects that can be saved
   */
  async convertToRoutines(
    program: GeneratedRoutineProgram,
    options?: { excludedExerciseIds?: string[]; programId?: string }
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

      // No per-routine progression state: prescriptions anchor to the global
      // ExerciseRecord (populated from real completed sets), so a generated day
      // starts blank on brand-new exercises and picks up real numbers otherwise.
      const routine: Routine = {
        id: `${program.programStyle}-${day.dayNumber}-${Date.now()}`,
        name: day.name,
        exercises,
        createdAt: new Date(),
        description: day.focus,
        isActive: true,
        programId: options?.programId,
      };

      routines.push(routine);
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
    options: GenerateRoutineOptions,
    refine?: { currentProgram: GeneratedRoutineProgram; instruction: string }
  ): string {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const gender = userProfile?.gender || 'male';
    const bodyWeight = userProfile?.weight?.value || 150;
    const userEquipment = userProfile?.equipmentFilter?.includedEquipment || ALL_EQUIPMENT;

    // Calculate user's strength level
    const strengthLevel = this.calculateStrengthLevel(workoutHistory, userProfile);

    // Get available exercises
    const availableExercises = userEquipment.length > 0
      ? getWorkoutsByEquipment(userEquipment, 100)
      : getAvailableWorkouts(100);
    const exerciseNames = availableExercises.map(e => e.name);
    const customExerciseNames = customExercises.map(e => e.name);
    const allExerciseNames = [...exerciseNames, ...customExerciseNames];

    const userEquipmentDisplay = formatEquipmentList(userEquipment);

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

        const bestSet = bestSetByWeight(ex.completedSets);

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

    const namesForIds = (ids?: string[]) =>
      ids?.map(id => [...availableExercises, ...customExercises].find(e => e.id === id)?.name)
          .filter((name): name is string => !!name);

    // Get names of included exercises
    const includedExerciseNames = namesForIds(options.includedExercises);

    // Get names of excluded exercises. We already drop these from the available list, but
    // the model can still recall an excluded lift from training, so we also render an explicit
    // "MUST EXCLUDE" rule (and drop them again at the conversion seam as a backstop).
    const excludedExerciseNames = namesForIds(options.excludedExercises);

    const params: RoutineGenerationParams = {
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
      currentProgramJson: refine ? JSON.stringify(refine.currentProgram, null, 2) : undefined,
      refineInstruction: refine?.instruction,
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
          const bestSet = bestSetByWeight(ex.completedSets);
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

    const systemPrompt = `You are an experienced strength and conditioning coach. Design practical, evidence-based
workout programs using your own expertise — you have freedom over the split, exercise selection, and set/rep schemes.

STRICT RULES:
1. ONLY use exercises from the "AVAILABLE EXERCISES" list - do NOT invent, substitute, or add any exercises not explicitly listed
2. Respect every item in the "HARD RULES" section exactly - those are the lifter's non-negotiable constraints
3. If a "must include" exercise is listed, it MUST appear in the program
4. If an exercise is NOT in the available list, do NOT use it under any circumstances

Return only valid JSON.`;

    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const content = response.text();

    const elapsed = Date.now() - startTime;
    console.log(`[RoutineGenerator] Gemini response received in ${elapsed}ms, content length: ${content?.length || 0}`);

    const parsed = parseGeminiJson(content);

    // Track analytics
    analyticsService.trackAIUsage({
      requestType: 'routine_generate',
      inputText: programTemplate,
      outputData: { programName: parsed.programName, routineCount: parsed.routines?.length },
      model: 'gemini-2.5-flash',
    });

    return parsed;
  }

}

export const aiRoutineGenerator = new AIRoutineGeneratorService();
