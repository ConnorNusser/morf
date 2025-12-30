import { GeneratedWorkout, WeightUnit, WorkoutExerciseSession, WorkoutSetCompletion } from '@/types';
import OpenAI from 'openai';
import { aiWorkoutGenerator } from '@/lib/ai/aiWorkoutGenerator';
import { analyticsService } from '@/lib/services/analytics';
import { exerciseNameToId } from '@/lib/data/exerciseUtils';
import { buildWorkoutNoteParsingPrompt } from '@/lib/ai/prompts/workoutNoteParsing.prompt';
import { storageService } from '@/lib/storage/storage';
import { getAvailableWorkouts, getWorkoutById } from './workouts';

// Types for parsed workout data
export interface ParsedSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
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
  recommendedSets?: ParsedSet[]; // Template/target sets (what they should aim for)
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
  recommendedSets?: ParsedSet[]; // Template/target sets
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
    recommendedSets?: {
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
  private readonly AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;
  private readonly openai: OpenAI;
  private dbExerciseIds: Set<string> = new Set();
  private customExerciseIds: Set<string> = new Set();
  private cacheInitialized: boolean = false;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.AI_API_KEY,
    });
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
   * Get all available exercise names for AI context
   */
  getAllExerciseNames(): string[] {
    const dbExercises = getAvailableWorkouts(100).map(e => e.name);
    return dbExercises;
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
    if (!this.AI_API_KEY) {
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
          recommendedSets: ex.recommendedSets?.map(s => ({
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
   * Build the AI prompt for parsing
   */
  private buildParsePrompt(text: string, defaultUnit: WeightUnit): string {
    return buildWorkoutNoteParsingPrompt({ text, defaultUnit });
  }

  /**
   * Call the AI API
   */
  private async callAI(prompt: string, inputText: string): Promise<AIParseResponse> {
    const response = await this.openai.chat.completions.create({
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
      tokensUsed: response.usage?.total_tokens,
      model: 'gpt-4o',
    });

    return parsed;
  }

  /**
   * Fallback parser when AI is not available
   */
  private fallbackParse(text: string, defaultUnit: WeightUnit): ParsedWorkout {
    const lines = text.split('\n').filter(line => line.trim());
    const exercises: ParsedExercise[] = [];

    for (const line of lines) {
      const parsed = this.parseLineRegex(line, defaultUnit);
      if (parsed) {
        exercises.push(parsed);
      }
    }

    return {
      exercises,
      confidence: exercises.length > 0 ? 0.6 : 0,
      rawText: text,
    };
  }

  /**
   * Parse a single line using regex (fallback)
   */
  private parseLineRegex(line: string, defaultUnit: WeightUnit): ParsedExercise | null {
    // Try to extract exercise name (everything before numbers)
    const nameMatch = line.match(/^([a-zA-Z\s()]+)/);
    if (!nameMatch) return null;

    const name = nameMatch[1].trim();
    if (!name) return null;

    // Extract all numbers from the line
    const numbers = line.match(/\d+/g)?.map(Number) || [];
    if (numbers.length === 0) {
      // Bodyweight exercise with no numbers
      const match = this.matchExercise(name);
      return {
        name,
        matchedExerciseId: match?.id,
        isCustom: match ? match.isCustom : true,
        sets: [{ weight: 0, reps: 10, unit: defaultUnit }],
      };
    }

    const sets: ParsedSet[] = [];

    // Pattern: 135x8 or 135 x 8
    const weightRepsPattern = line.match(/(\d+)\s*[x×]\s*(\d+)/gi);
    if (weightRepsPattern) {
      for (const pattern of weightRepsPattern) {
        const [, weight, reps] = pattern.match(/(\d+)\s*[x×]\s*(\d+)/i) || [];
        if (weight && reps) {
          sets.push({
            weight: parseInt(weight),
            reps: parseInt(reps),
            unit: defaultUnit,
          });
        }
      }
    }

    // Fallback: just use the numbers we found
    if (sets.length === 0 && numbers.length >= 2) {
      sets.push({
        weight: numbers[0],
        reps: numbers[1],
        unit: defaultUnit,
      });
    } else if (sets.length === 0 && numbers.length === 1) {
      sets.push({
        weight: 0,
        reps: numbers[0],
        unit: defaultUnit,
      });
    }

    if (sets.length === 0) return null;

    const match = this.matchExercise(name);
    return {
      name,
      matchedExerciseId: match?.id,
      isCustom: match ? match.isCustom : true,
      sets,
    };
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

        if (ex.recommendedSets) {
          existing.recommendedSets = [
            ...(existing.recommendedSets || []),
            ...ex.recommendedSets,
          ];
        }
      } else {
        consolidatedMap.set(normalizedName, {
          name: displayName,
          setCount: ex.sets.length,
          sets: [...ex.sets],
          recommendedSets: ex.recommendedSets ? [...ex.recommendedSets] : undefined,
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
  async toGeneratedWorkoutWithCustomExercises(parsed: ParsedWorkout, duration: number): Promise<GeneratedWorkout> {
    const exercises: WorkoutExerciseSession[] = [];
    let newCustomExercisesCreated = false;

    for (const ex of parsed.exercises) {
      let exerciseId = ex.matchedExerciseId;

      // If no match, create custom exercise
      if (!exerciseId) {
        // Generate the expected ID from the name
        const _expectedId = exerciseNameToId(ex.name);

        // Check if custom exercise already exists by ID
        const existingCustom = await storageService.getCustomExerciseByName(ex.name);

        if (existingCustom) {
          exerciseId = existingCustom.id;
        } else {
          // Generate custom exercise with AI metadata
          const customExercise = await aiWorkoutGenerator.generateCustomExerciseMetadata(ex.name);
          await storageService.saveCustomExercise(customExercise);
          exerciseId = customExercise.id;
          newCustomExercisesCreated = true;
        }
      }

      const completedSets: WorkoutSetCompletion[] = ex.sets.map((set, index) => ({
        setNumber: index + 1,
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        completed: true,
        duration: set.duration,
        distance: set.distance,
      }));

      // Use matched ID or generate from name as final fallback
      const finalId = exerciseId || exerciseNameToId(ex.name);

      exercises.push({
        id: finalId,
        sets: ex.sets.length,
        reps: ex.sets.length > 0 ? String(ex.sets[0].reps) : '0',
        completedSets,
        isCompleted: true,
      });
    }

    // Refresh cache if new custom exercises were created
    if (newCustomExercisesCreated) {
      await this.refreshCache();
    }

    // Calculate total volume
    const totalVolume = parsed.exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => setTotal + (set.weight * set.reps), 0);
    }, 0);

    return {
      id: `notes_workout_${Date.now()}`,
      title: `Workout - ${new Date().toLocaleDateString()}`,
      description: `Logged via notes. Total volume: ${totalVolume.toLocaleString()} lbs`,
      exercises,
      estimatedDuration: duration,
      difficulty: 'Completed',
      createdAt: new Date(),
    };
  }

  /**
   * Sync version for backwards compatibility
   */
  toGeneratedWorkout(parsed: ParsedWorkout, duration: number): GeneratedWorkout {
    const exercises: WorkoutExerciseSession[] = parsed.exercises.map(ex => {
      const completedSets: WorkoutSetCompletion[] = ex.sets.map((set, index) => ({
        setNumber: index + 1,
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        completed: true,
        duration: set.duration,
        distance: set.distance,
      }));

      // Use matched ID or generate from name
      const finalId = ex.matchedExerciseId || exerciseNameToId(ex.name);

      return {
        id: finalId,
        sets: ex.sets.length,
        reps: ex.sets.length > 0 ? String(ex.sets[0].reps) : '0',
        completedSets,
        isCompleted: true,
      };
    });

    const totalVolume = parsed.exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => setTotal + (set.weight * set.reps), 0);
    }, 0);

    return {
      id: `notes_workout_${Date.now()}`,
      title: `Workout - ${new Date().toLocaleDateString()}`,
      description: `Logged via notes. Total volume: ${totalVolume.toLocaleString()} lbs`,
      exercises,
      estimatedDuration: duration,
      difficulty: 'Completed',
      createdAt: new Date(),
    };
  }
}

export const workoutNoteParser = new WorkoutNoteParser();
