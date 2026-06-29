import { GeneratedWorkout, WeightUnit, WorkoutExerciseSession, WorkoutSetCompletion } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiWorkoutGenerator } from '@/lib/ai/aiWorkoutGenerator';
import { analyticsService } from '@/lib/services/analytics';
import { exerciseNameToId } from '@/lib/data/exerciseUtils';
import { buildWorkoutNoteParsingPrompt } from '@/lib/ai/prompts/workoutNoteParsing.prompt';
import { storageService } from '@/lib/storage/storage';
import { parseWorkoutTextLocal } from '@/lib/workout/localWorkoutParser';
import { getAvailableWorkouts, getWorkoutById } from './workouts';

// Types for parsed workout data
export interface ParsedSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
  completed?: boolean; // per-set check-off (draft); undefined = treat as done
  // For timed/cardio exercises
  duration?: number;  // Duration in seconds
  distance?: number;  // Distance in meters
}

export interface ParsedExercise {
  name: string;
  matchedExerciseId?: string;
  isCustom: boolean;
  trackingType?: 'reps' | 'timed' | 'cardio';
  sets: ParsedSet[]; // Actual working sets performed
  targetSets?: ParsedSet[]; // Target sets from "Target:" lines
}

export interface ParsedWorkout {
  exercises: ParsedExercise[];
  confidence: number;
  rawText: string;
}

export interface ParsedExerciseSummary {
  name: string;
  setCount: number;
  sets: ParsedSet[]; // Actual working sets
  targetSets?: ParsedSet[]; // Target sets from "Target:" lines
  matchedExerciseId?: string; // ID of the matched exercise from database
  isCustom?: boolean; // Whether this is a custom exercise
  trackingType?: 'reps' | 'timed' | 'cardio';
}

// AI response structure
interface AIParseResponse {
  exercises: {
    name: string;
    trackingType?: 'reps' | 'timed' | 'cardio';
    sets: {
      weight: number;
      reps: number;
      unit: 'lbs' | 'kg';
      duration?: number;  // seconds
      distance?: number;  // meters
    }[];
    targetSets?: {
      weight: number;
      reps: number;
      unit: 'lbs' | 'kg';
      duration?: number;
      distance?: number;
    }[];
  }[];
  confidence: number;
}

class WorkoutNoteParser {
  private readonly GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  private readonly genAI: GoogleGenerativeAI;
  private dbExerciseIds: Set<string> = new Set();
  private customExerciseIds: Set<string> = new Set();
  private cacheInitialized: boolean = false;

  constructor() {
    this.genAI = new GoogleGenerativeAI(this.GEMINI_API_KEY || '');
    this.buildExerciseIdCache();
  }

  /**
   * Build cache of valid exercise IDs from database
   * Since we use algorithmic ID generation, we just need to know what IDs exist
   */
  private buildExerciseIdCache() {
    const allExercises = getAvailableWorkouts(100);
    this.dbExerciseIds = new Set(allExercises.map(e => e.id));
  }

  /**
   * Load custom exercise IDs into cache
   */
  async loadCustomExercisesIntoCache(): Promise<void> {
    try {
      const customExercises = await storageService.getCustomExercises();
      this.customExerciseIds = new Set(customExercises.map(e => e.id));
      this.cacheInitialized = true;
    } catch (error) {
      console.error('Error loading custom exercises into cache:', error);
    }
  }

  /**
   * Refresh the cache (call after creating new custom exercises)
   */
  async refreshCache(): Promise<void> {
    this.buildExerciseIdCache();
    await this.loadCustomExercisesIntoCache();
  }

  /**
   * Match exercise name to ID using algorithmic approach
   *
   * The AI returns exercise names in format "Exercise Name (Equipment)"
   * We convert this to ID format "exercise-name-equipment" and check if it exists
   */
  private matchExercise(name: string): { id: string; isCustom: boolean } | null {
    // Generate expected ID from name
    const expectedId = exerciseNameToId(name);

    // Check database exercises first
    if (this.dbExerciseIds.has(expectedId)) {
      return { id: expectedId, isCustom: false };
    }

    // Check custom exercises
    if (this.customExerciseIds.has(expectedId)) {
      return { id: expectedId, isCustom: true };
    }

    // No match - will need to create custom exercise
    return null;
  }

  /**
   * Parse workout notes using AI
   */
  async parseWorkoutNote(text: string, defaultUnit: WeightUnit = 'lbs'): Promise<ParsedWorkout> {
    if (!text.trim()) {
      return { exercises: [], confidence: 0, rawText: text };
    }

    // Ensure custom exercises are loaded
    if (!this.cacheInitialized) {
      await this.loadCustomExercisesIntoCache();
    }

    // If no API key, use fallback parser
    if (!this.GEMINI_API_KEY) {
      return this.fallbackParse(text, defaultUnit);
    }

    try {
      const prompt = this.buildParsePrompt(text, defaultUnit);
      const response = await this.callAI(prompt, text);

      // Match exercises using algorithmic approach
      const exercises: ParsedExercise[] = [];

      for (const ex of response.exercises) {
        // Try to match the exercise name to an existing ID
        const match = this.matchExercise(ex.name);

        exercises.push({
          name: ex.name,
          matchedExerciseId: match?.id,
          isCustom: match ? match.isCustom : true,
          trackingType: ex.trackingType,
          sets: (ex.sets || []).map(s => ({
            weight: s.weight,
            reps: s.reps,
            unit: s.unit as WeightUnit,
            duration: s.duration,
            distance: s.distance,
          })),
          targetSets: ex.targetSets?.map(s => ({
            weight: s.weight,
            reps: s.reps,
            unit: s.unit as WeightUnit,
            duration: s.duration,
            distance: s.distance,
          })),
        });
      }

      return {
        exercises,
        confidence: response.confidence,
        rawText: text,
      };
    } catch (error) {
      console.error('AI parsing failed, using fallback:', error);
      return this.fallbackParse(text, defaultUnit);
    }
  }

  /**
   * Synchronous, offline regex parse. Fast and cost-free, so it can run on
   * every keystroke to power the live preview chips — where the Gemini round
   * trip would be far too slow and would burn API calls. Lower fidelity than
   * parseWorkoutNote (no AI disambiguation); the full AI parse still runs at
   * finish, so this is only ever a best-effort preview.
   */
  parseLocal(text: string, defaultUnit: WeightUnit = 'lbs'): ParsedWorkout {
    if (!text.trim()) return { exercises: [], confidence: 0, rawText: text };
    return this.fallbackParse(text, defaultUnit);
  }

  /**
   * Build the AI prompt for parsing
   */
  private buildParsePrompt(text: string, defaultUnit: WeightUnit): string {
    return buildWorkoutNoteParsingPrompt({ text, defaultUnit });
  }

  /**
   * Call the AI API (Gemini 2.5 Flash)
   */
  private async callAI(prompt: string, inputText: string): Promise<AIParseResponse> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const fullPrompt = `You are a workout log parser. Parse natural language workout notes into structured JSON. Return ONLY valid JSON.\n\n${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error('No content received from AI');
    }

    // Clean the response (remove any markdown if present)
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    }

    const parsed = JSON.parse(cleanedContent);

    // Track AI usage analytics
    analyticsService.trackAIUsage({
      requestType: 'note_parse',
      inputText,
      outputData: parsed,
      model: 'gemini-3.1-flash-lite',
    });

    return parsed;
  }

  /**
   * Fallback / offline parser. Delegates to the forgiving local tokenizer, then
   * augments any unmatched exercise with custom-exercise id matching (the
   * tokenizer only knows the built-in catalog).
   */
  private fallbackParse(text: string, defaultUnit: WeightUnit): ParsedWorkout {
    const local = parseWorkoutTextLocal(text, defaultUnit);
    for (const ex of local.exercises) {
      if (!ex.matchedExerciseId) {
        const match = this.matchExercise(ex.name);
        if (match) {
          ex.matchedExerciseId = match.id;
          ex.isCustom = match.isCustom;
        }
      }
    }
    return local;
  }

  /**
   * Convert parsed workout to summary format for toast
   */
  toSummary(parsed: ParsedWorkout): ParsedExerciseSummary[] {
    const consolidatedMap = new Map<string, ParsedExerciseSummary>();

    for (const ex of parsed.exercises) {
      const displayName = ex.matchedExerciseId
        ? getWorkoutById(ex.matchedExerciseId)?.name || ex.name
        : ex.name;

      const normalizedName = displayName.toLowerCase().trim();

      if (consolidatedMap.has(normalizedName)) {
        const existing = consolidatedMap.get(normalizedName)!;
        existing.sets = [...existing.sets, ...ex.sets];
        existing.setCount = existing.sets.length;

        if (ex.targetSets) {
          existing.targetSets = [
            ...(existing.targetSets || []),
            ...ex.targetSets,
          ];
        }
      } else {
        consolidatedMap.set(normalizedName, {
          name: displayName,
          setCount: ex.sets.length,
          sets: [...ex.sets],
          targetSets: ex.targetSets ? [...ex.targetSets] : undefined,
          matchedExerciseId: ex.matchedExerciseId,
          isCustom: ex.isCustom,
          trackingType: ex.trackingType,
        });
      }
    }

    return Array.from(consolidatedMap.values());
  }

  /**
   * Convert parsed workout to GeneratedWorkout format for saving
   * Auto-creates custom exercises for unmatched exercise names
   */
  async toGeneratedWorkoutWithCustomExercises(parsed: ParsedWorkout, duration: number, routineId?: string): Promise<GeneratedWorkout> {
    let newCustomExercisesCreated = false;

    // First pass: identify exercises that need custom creation (in parallel)
    const exercisesNeedingCreation: { ex: ParsedExercise; index: number }[] = [];
    const exerciseIdMap = new Map<number, string>(); // index -> exerciseId

    // Check which exercises need custom creation
    await Promise.all(
      parsed.exercises.map(async (ex, index) => {
        if (ex.matchedExerciseId) {
          exerciseIdMap.set(index, ex.matchedExerciseId);
        } else {
          // Check if custom exercise already exists
          const existingCustom = await storageService.getCustomExerciseByName(ex.name);
          if (existingCustom) {
            exerciseIdMap.set(index, existingCustom.id);
          } else {
            exercisesNeedingCreation.push({ ex, index });
          }
        }
      })
    );

    // Create all needed custom exercises in parallel
    if (exercisesNeedingCreation.length > 0) {
      newCustomExercisesCreated = true;
      const createdExercises = await Promise.all(
        exercisesNeedingCreation.map(async ({ ex, index }) => {
          const customExercise = await aiWorkoutGenerator.generateCustomExerciseMetadata(ex.name);
          await storageService.saveCustomExercise(customExercise);
          return { index, id: customExercise.id };
        })
      );
      // Map the created IDs
      for (const { index, id } of createdExercises) {
        exerciseIdMap.set(index, id);
      }
    }

    // Build exercises array in original order
    const exercises: WorkoutExerciseSession[] = parsed.exercises.map((ex, index) => {
      const completedSets: WorkoutSetCompletion[] = ex.sets.map((set, setIndex) => ({
        setNumber: setIndex + 1,
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        // Honor the per-set check-off when present (draft); text parses are all done.
        completed: set.completed ?? true,
        duration: set.duration,
        distance: set.distance,
      }));

      // Convert targetSets to WorkoutSetCompletion format
      const targetSets: WorkoutSetCompletion[] | undefined = ex.targetSets?.map((set, setIndex) => ({
        setNumber: setIndex + 1,
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        completed: false,
      }));

      // Use mapped ID or generate from name as final fallback
      const finalId = exerciseIdMap.get(index) || exerciseNameToId(ex.name);

      return {
        id: finalId,
        sets: ex.sets.length,
        reps: ex.sets.length > 0 ? String(ex.sets[0].reps) : '0',
        completedSets,
        targetSets,
        isCompleted: true,
      };
    });

    // Refresh cache if new custom exercises were created
    if (newCustomExercisesCreated) {
      await this.refreshCache();
    }

    // Calculate total volume
    const totalVolume = parsed.exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => setTotal + (set.weight * set.reps), 0);
    }, 0);

    // Extract title from raw text if it starts with # (e.g., "# Push Day")
    let title = `Workout - ${new Date().toLocaleDateString()}`;
    const firstLine = parsed.rawText?.trim().split('\n')[0];
    if (firstLine?.startsWith('#')) {
      title = firstLine.replace(/^#\s*/, '').trim() || title;
    }

    return {
      id: `notes_workout_${Date.now()}`,
      title,
      description: `Logged via notes. Total volume: ${totalVolume.toLocaleString()} lbs`,
      exercises,
      estimatedDuration: duration,
      difficulty: 'Completed',
      createdAt: new Date(),
      routineId,
    };
  }

}

export const workoutNoteParser = new WorkoutNoteParser();
