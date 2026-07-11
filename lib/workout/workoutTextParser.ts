import { LoggedWorkout, WeightUnit, WorkoutExerciseSession, WorkoutSetCompletion } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiWorkoutGenerator } from '@/lib/ai/aiWorkoutGenerator';
import { analyticsService } from '@/lib/services/analytics';
import { exerciseNameToId } from '@/lib/data/exerciseUtils';
import { buildWorkoutNoteParsingPrompt } from '@/lib/ai/prompts/workoutNoteParsing.prompt';
import { storageService } from '@/lib/storage/storage';
import { parseWorkoutTextLocal } from '@/lib/workout/localWorkoutParser';
import { getAvailableExercises, getCatalogExercise, setCustomExerciseCache } from './exerciseCatalog';

export interface ParsedSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
  completed?: boolean; // per-set check-off (draft); undefined = treat as done
  duration?: number;  // seconds
  distance?: number;  // meters
  isWarmup?: boolean; // recorded set role (draft/routine); absent on plain text parses
}

export interface ParsedExercise {
  name: string;
  matchedExerciseId?: string;
  isCustom: boolean;
  trackingType?: 'reps' | 'timed' | 'cardio';
  sets: ParsedSet[];
}

export interface ParsedWorkout {
  exercises: ParsedExercise[];
  confidence: number;
  rawText: string;
}

export interface ParsedExerciseSummary {
  name: string;
  setCount: number;
  sets: ParsedSet[];
  matchedExerciseId?: string;
  isCustom?: boolean;
  trackingType?: 'reps' | 'timed' | 'cardio';
}

interface AIParseResponse {
  exercises: {
    name: string;
    trackingType?: 'reps' | 'timed' | 'cardio';
    sets: {
      weight: number;
      reps: number;
      unit: 'lbs' | 'kg';
      duration?: number;
      distance?: number;
    }[];
  }[];
  confidence: number;
}

class WorkoutTextParser {
  private readonly GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  private readonly genAI: GoogleGenerativeAI;
  private dbExerciseIds: Set<string> = new Set();
  private customExerciseIds: Set<string> = new Set();
  private cacheInitialized: boolean = false;

  constructor() {
    this.genAI = new GoogleGenerativeAI(this.GEMINI_API_KEY || '');
    this.buildExerciseIdCache();
  }

  // IDs are generated algorithmically, so we only need the set of IDs that exist.
  private buildExerciseIdCache() {
    const allExercises = getAvailableExercises(100);
    this.dbExerciseIds = new Set(allExercises.map(e => e.id));
  }

  async loadCustomExercisesIntoCache(): Promise<void> {
    try {
      const customExercises = await storageService.getCustomExercises();
      this.customExerciseIds = new Set(customExercises.map(e => e.id));
      // Keep the sync display registry (getExercise) in step, so a custom exercise
      // auto-created on finish resolves immediately without waiting for the context to reload.
      setCustomExerciseCache(customExercises);
      this.cacheInitialized = true;
    } catch (error) {
      console.error('Error loading custom exercises into cache:', error);
    }
  }

  // Call after creating new custom exercises.
  async refreshCache(): Promise<void> {
    this.buildExerciseIdCache();
    await this.loadCustomExercisesIntoCache();
  }

  // AI returns names as "Exercise Name (Equipment)"; convert to id "exercise-name-equipment" and look it up.
  private matchExercise(name: string): { id: string; isCustom: boolean } | null {
    const expectedId = exerciseNameToId(name);

    if (this.dbExerciseIds.has(expectedId)) {
      return { id: expectedId, isCustom: false };
    }

    if (this.customExerciseIds.has(expectedId)) {
      return { id: expectedId, isCustom: true };
    }

    return null;
  }

  async parseWorkoutText(text: string, defaultUnit: WeightUnit = 'lbs'): Promise<ParsedWorkout> {
    if (!text.trim()) {
      return { exercises: [], confidence: 0, rawText: text };
    }

    if (!this.cacheInitialized) {
      await this.loadCustomExercisesIntoCache();
    }

    if (!this.GEMINI_API_KEY) {
      return this.fallbackParse(text, defaultUnit);
    }

    try {
      const prompt = this.buildParsePrompt(text, defaultUnit);
      const response = await this.callAI(prompt, text);

      const exercises: ParsedExercise[] = [];

      const mapSet = (s: { weight: number; reps: number; unit: string; duration?: number; distance?: number }) => ({
        weight: s.weight,
        reps: s.reps,
        unit: s.unit as WeightUnit,
        duration: s.duration,
        distance: s.distance,
      });

      for (const ex of response.exercises) {
        const match = this.matchExercise(ex.name);

        exercises.push({
          name: ex.name,
          matchedExerciseId: match?.id,
          isCustom: match ? match.isCustom : true,
          trackingType: ex.trackingType,
          sets: (ex.sets || []).map(mapSet),
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

  // Synchronous offline regex parse — cheap enough to run per-keystroke for live preview chips
  // (a Gemini round trip would be too slow / costly). Lower fidelity; the full AI parse runs at finish.
  parseLocal(text: string, defaultUnit: WeightUnit = 'lbs'): ParsedWorkout {
    if (!text.trim()) return { exercises: [], confidence: 0, rawText: text };
    return this.fallbackParse(text, defaultUnit);
  }

  private buildParsePrompt(text: string, defaultUnit: WeightUnit): string {
    return buildWorkoutNoteParsingPrompt({ text, defaultUnit });
  }

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

    // Strip markdown fences if present.
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    }

    const parsed = JSON.parse(cleanedContent);

    analyticsService.trackAIUsage({
      requestType: 'note_parse',
      inputText,
      outputData: parsed,
      model: 'gemini-3.1-flash-lite',
    });

    return parsed;
  }

  // Offline parser: local tokenizer (built-in catalog only) plus custom-exercise id matching for unmatched names.
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

  toSummary(parsed: ParsedWorkout): ParsedExerciseSummary[] {
    const consolidatedMap = new Map<string, ParsedExerciseSummary>();

    for (const ex of parsed.exercises) {
      const displayName = ex.matchedExerciseId
        ? getCatalogExercise(ex.matchedExerciseId)?.name || ex.name
        : ex.name;

      const normalizedName = displayName.toLowerCase().trim();

      if (consolidatedMap.has(normalizedName)) {
        const existing = consolidatedMap.get(normalizedName)!;
        existing.sets = [...existing.sets, ...ex.sets];
        existing.setCount = existing.sets.length;
      } else {
        consolidatedMap.set(normalizedName, {
          name: displayName,
          setCount: ex.sets.length,
          sets: [...ex.sets],
          matchedExerciseId: ex.matchedExerciseId,
          isCustom: ex.isCustom,
          trackingType: ex.trackingType,
        });
      }
    }

    return Array.from(consolidatedMap.values());
  }

  // Auto-creates custom exercises for unmatched exercise names.
  async toLoggedWorkoutWithCustomExercises(parsed: ParsedWorkout, duration: number, routineId?: string): Promise<LoggedWorkout> {
    let newCustomExercisesCreated = false;

    const exercisesNeedingCreation: { ex: ParsedExercise; index: number }[] = [];
    const exerciseIdMap = new Map<number, string>(); // index -> exerciseId

    await Promise.all(
      parsed.exercises.map(async (ex, index) => {
        if (ex.matchedExerciseId) {
          exerciseIdMap.set(index, ex.matchedExerciseId);
        } else {
          const existingCustom = await storageService.getCustomExerciseByName(ex.name);
          if (existingCustom) {
            exerciseIdMap.set(index, existingCustom.id);
          } else {
            exercisesNeedingCreation.push({ ex, index });
          }
        }
      })
    );

    if (exercisesNeedingCreation.length > 0) {
      newCustomExercisesCreated = true;
      const createdExercises = await Promise.all(
        exercisesNeedingCreation.map(async ({ ex, index }) => {
          const customExercise = await aiWorkoutGenerator.generateCustomExerciseMetadata(ex.name);
          await storageService.saveCustomExercise(customExercise);
          return { index, id: customExercise.id };
        })
      );
      for (const { index, id } of createdExercises) {
        exerciseIdMap.set(index, id);
      }
    }

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
        isWarmup: set.isWarmup,
      }));

      const finalId = exerciseIdMap.get(index) || exerciseNameToId(ex.name);

      return {
        id: finalId,
        sets: ex.sets.length,
        reps: ex.sets.length > 0 ? String(ex.sets[0].reps) : '0',
        completedSets,
        // Completion derives from the sets themselves — an exercise counts as done
        // only when at least one working set was actually checked off.
        isCompleted: completedSets.some(s => s.completed && s.weight > 0),
      };
    });

    if (newCustomExercisesCreated) {
      await this.refreshCache();
    }

    const totalVolume = parsed.exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => setTotal + (set.weight * set.reps), 0);
    }, 0);

    // Use a leading "# ..." line as the title (e.g. "# Push Day").
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

export const workoutTextParser = new WorkoutTextParser();
