// AI routine generator — builds routines from proven program methodologies.

import { CustomExercise, Equipment, GeneratedWorkout, Routine, RoutineExercise, RoutineSet, TrainingAdvancement, UserProfile } from '@/types';
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
import { calculateStrengthPercentile, MALE_STANDARDS, FEMALE_STANDARDS } from '@/lib/data/strengthStandards';
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
  ignoredMuscles?: string[];  // body parts to completely skip (e.g., "no legs")
  trainingYears?: number;  // override training years for advancement calculation
  workoutDuration?: number;  // minutes (30, 60, 90, 120)
  exercisesPerWorkout?: { min: number; max: number };
  includedExercises?: string[];
  excludedExercises?: string[];
  experienceLevel?: TrainingAdvancement;  // biases deterministic program selection
}

class AIRoutineGeneratorService {
  private readonly GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(this.GEMINI_API_KEY || '');
  }

  async generateRoutineProgram(options: GenerateRoutineOptions): Promise<GeneratedRoutineProgram> {
    const userProfile = await userService.getRealUserProfile();
    const equipmentProfile = classifyEquipment(userProfile?.equipmentFilter?.includedEquipment);

    // Standard equipment → deterministic template library (fast, consistent, no
    // API call). Limited/odd setups fall through to the AI.
    if (equipmentProfile.tier === 'standard') {
      try {
        return this.buildDeterministic(options, equipmentProfile.available);
      } catch (error) {
        console.error('Deterministic build failed, falling back to AI:', error);
      }
    }

    // Limited/odd equipment (or a deterministic failure) → AI, with the template
    // library as the final fallback when the AI errors or is unavailable.
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

  // Refine an already-generated program in place from a freeform instruction
  // (e.g. "swap leg press for hack squat"). Reuses the generation context and
  // asks for the full revised program; falls back to the unchanged program on error.
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

  /** Convert a generated program to saveable Routine objects. */
  async convertToRoutines(
    program: GeneratedRoutineProgram,
    options?: { excludedExerciseIds?: string[]; programId?: string }
  ): Promise<Routine[]> {
    const routines: Routine[] = [];
    const customExercises = await storageService.getCustomExercises();
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
            exerciseName: matched.name,
            sets: newSets,
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

  // Parse a generated reps value into a base rep count: ranges ("8-12" → 8),
  // AMRAP ("5+" → 5), time ("30-60 sec" → 30). The low end is the base — the
  // double-progression engine walks reps UP toward the top of the range.
  private parseReps(raw: number | string): number {
    if (typeof raw === 'number') return raw > 0 ? Math.round(raw) : 10;
    const match = String(raw).match(/\d+/);
    const n = match ? parseInt(match[0], 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  // Match precedence: exact (built-in, then custom), partial contains, then
  // ignoring any "(Equipment)" suffix.
  private findExerciseByName(
    name: string,
    customExercises: CustomExercise[]
  ): { id: string; name: string } | null {
    const cleanName = name.toLowerCase().trim();

    for (const exercise of ALL_WORKOUTS) {
      if (exercise.name.toLowerCase() === cleanName) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    for (const exercise of customExercises) {
      if (exercise.name.toLowerCase() === cleanName) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    for (const exercise of ALL_WORKOUTS) {
      if (exercise.name.toLowerCase().includes(cleanName) ||
          cleanName.includes(exercise.name.toLowerCase())) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    for (const exercise of customExercises) {
      if (exercise.name.toLowerCase().includes(cleanName) ||
          cleanName.includes(exercise.name.toLowerCase())) {
        return { id: exercise.id, name: exercise.name };
      }
    }

    const nameWithoutEquipment = cleanName.replace(/\s*\([^)]*\)\s*$/, '').trim();
    for (const exercise of ALL_WORKOUTS) {
      const exerciseWithoutEquipment = exercise.name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (exerciseWithoutEquipment === nameWithoutEquipment) {
        return { id: exercise.id, name: exercise.name };
      }
    }

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

    const strengthLevel = this.calculateStrengthLevel(workoutHistory, userProfile);

    const availableExercises = userEquipment.length > 0
      ? getWorkoutsByEquipment(userEquipment, 100)
      : getAvailableWorkouts(100);
    const exerciseNames = availableExercises.map(e => e.name);
    const customExerciseNames = customExercises.map(e => e.name);
    const allExerciseNames = [...exerciseNames, ...customExerciseNames];

    const userEquipmentDisplay = formatEquipmentList(userEquipment);

    const recentWorkouts = workoutHistory.slice(-20);
    const exerciseStats = new Map<string, {
      name: string;
      weight: number;
      reps: number;
      frequency: number;  // # of workouts this exercise appeared in
    }>();

    const idToName = new Map<string, string>();
    for (const workout of ALL_WORKOUTS) {
      idToName.set(workout.id, workout.name);
    }
    for (const custom of customExercises) {
      idToName.set(custom.id, custom.name);
    }

    for (const workout of recentWorkouts) {
      const countedInThisWorkout = new Set<string>(); // count each exercise once per workout

      for (const ex of workout.exercises) {
        if (countedInThisWorkout.has(ex.id)) continue;
        countedInThisWorkout.add(ex.id);

        const exerciseName = idToName.get(ex.id) || ex.id;

        const bestSet = bestSetByWeight(ex.completedSets);

        const current = exerciseStats.get(ex.id);
        if (!current) {
          exerciseStats.set(ex.id, {
            name: exerciseName,
            weight: bestSet?.weight || 0,
            reps: bestSet?.reps || 0,
            frequency: 1
          });
        } else {
          current.frequency++;
          if (bestSet && bestSet.weight > current.weight) {
            current.weight = bestSet.weight;
            current.reps = bestSet.reps;
          }
        }
      }
    }

    // Most-used first, top 15.
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

    // Training advancement for fatigue management; UI-supplied trainingYears wins over profile.
    const profileWithTrainingYears = userProfile
      ? { ...userProfile, trainingYears: options.trainingYears ?? userProfile.trainingYears }
      : null;
    const advancementResult = determineTrainingAdvancement(workoutHistory, profileWithTrainingYears);
    const programmingConfig = PROGRAMMING_RULES[advancementResult.level];

    console.log(`[RoutineGenerator] Training advancement: ${advancementResult.level} (source: ${advancementResult.source}, confidence: ${advancementResult.confidence})`);

    let filteredExerciseNames = allExerciseNames;
    if (options.excludedExercises && options.excludedExercises.length > 0) {
      const excludedSet = new Set(options.excludedExercises);
      filteredExerciseNames = allExerciseNames.filter(name => {
        const exercise = [...availableExercises, ...customExercises].find(e => e.name === name);
        return !exercise || !excludedSet.has(exercise.id);
      });
    }

    const namesForIds = (ids?: string[]) =>
      ids?.map(id => [...availableExercises, ...customExercises].find(e => e.id === id)?.name)
          .filter((name): name is string => !!name);

    const includedExerciseNames = namesForIds(options.includedExercises);

    // These are already dropped from the available list, but the model can still
    // recall an excluded lift from training, so we also render an explicit "MUST
    // EXCLUDE" rule (and drop them again at the conversion seam as a backstop).
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
