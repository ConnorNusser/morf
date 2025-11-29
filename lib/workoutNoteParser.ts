import { CustomExercise, WeightUnit, WorkoutExerciseSession, WorkoutSetCompletion, GeneratedWorkout } from '@/types';
import OpenAI from 'openai';
import { getWorkoutById, getAvailableWorkouts } from './workouts';
import { storageService } from './storage';

// Types for parsed workout data
export interface ParsedSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
}

export interface ParsedExercise {
  name: string;
  matchedExerciseId?: string;
  isCustom: boolean;
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
}

// AI response structure
interface AIParseResponse {
  exercises: {
    name: string;
    sets: {
      weight: number;
      reps: number;
      unit: 'lbs' | 'kg';
    }[];
    recommendedSets?: {
      weight: number;
      reps: number;
      unit: 'lbs' | 'kg';
    }[];
  }[];
  confidence: number;
}

class WorkoutNoteParser {
  private readonly AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;
  private readonly openai: OpenAI;
  private exerciseNameCache: Map<string, string> = new Map();
  private customExerciseCache: Map<string, string> = new Map();
  private cacheInitialized: boolean = false;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.AI_API_KEY,
    });
    this.buildExerciseNameCache();
  }

  // Build a cache of exercise names for fuzzy matching
  private buildExerciseNameCache() {
    const allExercises = getAvailableWorkouts(100); // Get all exercises
    allExercises.forEach(exercise => {
      // Store lowercase name -> id mapping
      this.exerciseNameCache.set(exercise.name.toLowerCase(), exercise.id);

      // Also store common abbreviations/aliases
      const aliases = this.getExerciseAliases(exercise.id, exercise.name);
      aliases.forEach(alias => {
        this.exerciseNameCache.set(alias.toLowerCase(), exercise.id);
      });
    });
  }

  // Load custom exercises into cache - call this before parsing
  async loadCustomExercisesIntoCache(): Promise<void> {
    try {
      const customExercises = await storageService.getCustomExercises();
      this.customExerciseCache.clear();

      customExercises.forEach(exercise => {
        // Store in custom exercise cache
        this.customExerciseCache.set(exercise.name.toLowerCase(), exercise.id);

        // Also add variations without common prefixes/suffixes
        const normalizedName = exercise.name.toLowerCase()
          .replace(/^custom\s+/i, '')
          .replace(/\s+exercise$/i, '')
          .trim();
        if (normalizedName !== exercise.name.toLowerCase()) {
          this.customExerciseCache.set(normalizedName, exercise.id);
        }
      });

      this.cacheInitialized = true;
    } catch (error) {
      console.error('Error loading custom exercises into cache:', error);
    }
  }

  // Refresh the cache (call after creating new custom exercises)
  async refreshCache(): Promise<void> {
    this.buildExerciseNameCache();
    await this.loadCustomExercisesIntoCache();
  }

  // Get all available exercise names for AI context
  getAllExerciseNames(): string[] {
    const dbExercises = getAvailableWorkouts(100).map(e => e.name);
    const customExercises = Array.from(this.customExerciseCache.keys());
    return [...dbExercises, ...customExercises];
  }

  // Get custom exercise names for AI context
  getCustomExerciseNames(): string[] {
    return Array.from(this.customExerciseCache.entries()).map(([name, id]) => name);
  }

  // Get common aliases for exercises
  private getExerciseAliases(id: string, name: string): string[] {
    const aliasMap: Record<string, string[]> = {
      'bench-press': ['bench', 'flat bench', 'barbell bench'],
      'squat': ['squats', 'back squat', 'barbell squat'],
      'deadlift': ['deadlifts', 'conventional deadlift', 'deads'],
      'overhead-press': ['ohp', 'military press', 'shoulder press', 'press'],
      'dumbbell-bench-press': ['db bench', 'dumbbell bench'],
      'dumbbell-curl': ['db curl', 'curls', 'bicep curl'],
      'barbell-curl': ['bb curl', 'barbell curls'],
      'lat-pulldown': ['lat pulldowns', 'pulldown', 'pulldowns'],
      'barbell-row': ['bent over row', 'rows', 'bb row'],
      'leg-press': ['leg press machine'],
      'pull-up': ['pullups', 'pull ups', 'chin up', 'chinup'],
      'push-up': ['pushups', 'push ups'],
      'incline-bench-press': ['incline bench', 'incline press'],
      'romanian-deadlift': ['rdl', 'romanian dl', 'stiff leg deadlift'],
      'cable-fly': ['cable flies', 'flies', 'flyes', 'pec fly'],
      'tricep-pushdown': ['pushdowns', 'tricep pushdowns', 'rope pushdown'],
      'lateral-raise': ['lateral raises', 'side raise', 'side raises'],
      'face-pull': ['face pulls'],
      'leg-extension': ['leg extensions', 'quad extension'],
      'leg-curl': ['leg curls', 'hamstring curl'],
      'calf-raise': ['calf raises', 'calves'],
    };

    return aliasMap[id] || [];
  }

  // Try to match a parsed exercise name to an existing exercise
  private matchExercise(name: string): { id: string; isCustom: boolean } | null {
    const normalizedName = name.toLowerCase().trim();

    // Direct match in database exercises
    if (this.exerciseNameCache.has(normalizedName)) {
      return { id: this.exerciseNameCache.get(normalizedName)!, isCustom: false };
    }

    // Direct match in custom exercises
    if (this.customExerciseCache.has(normalizedName)) {
      return { id: this.customExerciseCache.get(normalizedName)!, isCustom: true };
    }

    // Try partial matching in database exercises
    for (const [cachedName, id] of this.exerciseNameCache.entries()) {
      if (normalizedName.includes(cachedName) || cachedName.includes(normalizedName)) {
        return { id, isCustom: false };
      }
    }

    // Try partial matching in custom exercises
    for (const [cachedName, id] of this.customExerciseCache.entries()) {
      if (normalizedName.includes(cachedName) || cachedName.includes(normalizedName)) {
        return { id, isCustom: true };
      }
    }

    // No match found - this will be a new custom exercise
    return null;
  }

  // AI-assisted matching for exercise names that didn't match locally
  private async aiAssistedMatch(
    exerciseName: string,
    availableExercises: string[]
  ): Promise<{ matchedName: string; confidence: number } | null> {
    if (!this.AI_API_KEY) {
      return null;
    }

    try {
      const prompt = `You are matching exercise names. Given the input exercise name, find the best match from the available exercises list.

INPUT EXERCISE: "${exerciseName}"

AVAILABLE EXERCISES:
${availableExercises.slice(0, 50).join('\n')}

RULES:
1. Only return a match if you're confident it's the same exercise (just named differently)
2. Common variations to match: "DB" = "Dumbbell", "BB" = "Barbell", "Press" = "Chest Press", etc.
3. If no good match exists, return null
4. Consider that "Incline DB Press" should match "Incline Dumbbell Press"

Return ONLY valid JSON (no markdown):
{
  "matchedName": "Exact name from the available list" or null,
  "confidence": 0.0 to 1.0
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an exercise name matcher. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
      }

      const result = JSON.parse(cleanedContent);

      if (result.matchedName && result.confidence >= 0.7) {
        return { matchedName: result.matchedName, confidence: result.confidence };
      }

      return null;
    } catch (error) {
      console.error('AI-assisted matching failed:', error);
      return null;
    }
  }

  // Parse workout notes using AI
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
      const response = await this.callAI(prompt);

      // Get all available exercise names for AI matching
      const allExerciseNames = this.getAllExerciseNames();

      // Match exercises to existing database with AI-assisted fallback
      const exercises: ParsedExercise[] = [];

      for (const ex of response.exercises) {
        // First try local matching
        let match = this.matchExercise(ex.name);

        // If no local match, try AI-assisted matching
        if (!match) {
          const aiMatch = await this.aiAssistedMatch(ex.name, allExerciseNames);
          if (aiMatch) {
            // Find the ID for the matched name
            const matchedExercise = this.matchExercise(aiMatch.matchedName);
            if (matchedExercise) {
              match = matchedExercise;
              console.log(`AI matched "${ex.name}" -> "${aiMatch.matchedName}" (${aiMatch.confidence * 100}% confidence)`);
            }
          }
        }

        exercises.push({
          name: ex.name,
          matchedExerciseId: match?.id,
          isCustom: match ? match.isCustom : true, // New custom if no match at all
          sets: ex.sets.map(s => ({
            weight: s.weight,
            reps: s.reps,
            unit: s.unit as WeightUnit,
          })),
          recommendedSets: ex.recommendedSets?.map(s => ({
            weight: s.weight,
            reps: s.reps,
            unit: s.unit as WeightUnit,
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

  // Build the AI prompt for parsing
  private buildParsePrompt(text: string, defaultUnit: WeightUnit): string {
    return `Parse the following workout notes into structured data. Extract each exercise with its sets, weights, and reps.

IMPORTANT RULES:
1. Each exercise should have an array of individual sets (not grouped)
2. If reps are listed as "8, 8, 6" that means 3 separate sets with those rep counts
3. If format is "3x8" that means 3 sets of 8 reps each
4. If format is "135x8" that means weight 135 for 8 reps (1 set)
5. If no weight specified for bodyweight exercises, use weight: 0
6. Default unit is "${defaultUnit}" unless specified otherwise
7. Common formats to recognize:
   - "Bench 135x8, 155x6" = 2 sets
   - "Squats 225 for 5 reps, 3 sets" = 3 sets of 225x5
   - "Pullups bodyweight x 10, 8, 6" = 3 sets
   - "DB curls 25s 3x12" = 3 sets of 25x12

DISTINGUISHING TARGET vs ACTUAL SETS:
- "Target" sets are PLANNED sets, NOT actual working sets performed
- Keywords that indicate TARGET sets: "target", "recommended", "plan", "goal", "aim for", "try", "should do"
- Keywords that indicate ACTUAL sets (real working sets performed): "did", "completed", "actual", "hit", "got", "lifted", specific weight x rep notation without qualifiers
- If the input shows both target AND actual for an exercise, put target in "recommendedSets" and actual in "sets"
- If no distinction is made, assume all sets are ACTUAL working sets (put in "sets")
- NEVER put target sets in the main "sets" array - only actual working sets go there

EXAMPLES:
- "Bench target 135x8, did 145x8, 155x6" → recommendedSets: [135x8], sets: [145x8, 155x6]
- "Squats target 225x5, actual 225x5, 235x4" → recommendedSets: [225x5], sets: [225x5, 235x4]
- "Deadlift 315x5, 335x3" (no qualifiers) → sets: [315x5, 335x3] (assumed actual)

WORKOUT NOTES:
${text}

Return ONLY valid JSON in this exact format (no markdown, no backticks):
{
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": [
        { "weight": 145, "reps": 8, "unit": "lbs" },
        { "weight": 155, "reps": 6, "unit": "lbs" }
      ],
      "recommendedSets": [
        { "weight": 135, "reps": 8, "unit": "lbs" }
      ]
    }
  ],
  "confidence": 0.95
}

NOTE: "recommendedSets" is optional - only include it if the input explicitly mentions recommended/target/planned sets.
The "sets" array should ONLY contain actual working sets that were performed.

The confidence score should be between 0 and 1, where 1 means very confident in the parsing.`;
  }

  // Call the AI API
  private async callAI(prompt: string): Promise<AIParseResponse> {
    // Using gpt-4o for parsing - supports temperature parameter
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

    return JSON.parse(cleanedContent);
  }

  // Fallback parser when AI is not available
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

  // Parse a single line using regex
  private parseLineRegex(line: string, defaultUnit: WeightUnit): ParsedExercise | null {
    // Try to extract exercise name (everything before numbers)
    const nameMatch = line.match(/^([a-zA-Z\s]+)/);
    if (!nameMatch) return null;

    const name = nameMatch[1].trim();
    if (!name) return null;

    // Extract all numbers from the line
    const numbers = line.match(/\d+/g)?.map(Number) || [];
    if (numbers.length === 0) {
      // Bodyweight exercise with no numbers
      return {
        name,
        isCustom: true,
        sets: [{ weight: 0, reps: 10, unit: defaultUnit }], // Default to 10 reps
      };
    }

    const sets: ParsedSet[] = [];
    const match = this.matchExercise(name);

    // Try to detect pattern: weight x reps or sets x reps @ weight
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

    // Pattern: 3 sets of 12 @ 135 or 3x12 @ 135
    if (sets.length === 0) {
      const setsRepsWeight = line.match(/(\d+)\s*(?:sets?\s*(?:of|x)?\s*)?(\d+).*?@?\s*(\d+)/i);
      if (setsRepsWeight) {
        const [, setCount, reps, weight] = setsRepsWeight;
        const numSets = parseInt(setCount);
        for (let i = 0; i < numSets; i++) {
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
      // Assume first number is weight, second is reps
      sets.push({
        weight: numbers[0],
        reps: numbers[1],
        unit: defaultUnit,
      });
    } else if (sets.length === 0 && numbers.length === 1) {
      // Single number - could be reps for bodyweight
      sets.push({
        weight: 0,
        reps: numbers[0],
        unit: defaultUnit,
      });
    }

    if (sets.length === 0) return null;

    return {
      name,
      matchedExerciseId: match?.id,
      isCustom: !match,
      sets,
    };
  }

  // Convert parsed workout to summary format for toast
  toSummary(parsed: ParsedWorkout): ParsedExerciseSummary[] {
    return parsed.exercises.map(ex => ({
      name: ex.matchedExerciseId
        ? getWorkoutById(ex.matchedExerciseId)?.name || ex.name
        : ex.name,
      setCount: ex.sets.length,
      sets: ex.sets, // Actual working sets
      recommendedSets: ex.recommendedSets, // Template/target sets
    }));
  }

  // Convert parsed workout to GeneratedWorkout format for saving
  // Also auto-creates custom exercises for unmatched exercise names
  async toGeneratedWorkoutWithCustomExercises(parsed: ParsedWorkout, duration: number): Promise<GeneratedWorkout> {
    const exercises: WorkoutExerciseSession[] = [];
    let newCustomExercisesCreated = false;

    for (const ex of parsed.exercises) {
      let exerciseId = ex.matchedExerciseId;

      // If this is a custom exercise (no match), create it
      if (ex.isCustom && !exerciseId) {
        const customId = `custom_${ex.name.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`;

        // Check if a custom exercise with this name already exists
        const existingCustom = await storageService.getCustomExerciseByName(ex.name);

        if (existingCustom) {
          exerciseId = existingCustom.id;
        } else {
          // Create new custom exercise
          const customExercise: CustomExercise = {
            id: customId,
            name: ex.name,
            isCustom: true,
            createdAt: new Date(),
          };
          await storageService.saveCustomExercise(customExercise);
          exerciseId = customId;
          newCustomExercisesCreated = true;
          console.log(`Created new custom exercise: "${ex.name}" (${customId})`);
        }
      }

      const completedSets: WorkoutSetCompletion[] = ex.sets.map((set, index) => ({
        setNumber: index + 1,
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        completed: true,
      }));

      exercises.push({
        id: exerciseId || `custom_${ex.name.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`,
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

  // Sync version for backwards compatibility
  toGeneratedWorkout(parsed: ParsedWorkout, duration: number): GeneratedWorkout {
    const exercises: WorkoutExerciseSession[] = parsed.exercises.map(ex => {
      const completedSets: WorkoutSetCompletion[] = ex.sets.map((set, index) => ({
        setNumber: index + 1,
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        completed: true,
      }));

      return {
        id: ex.matchedExerciseId || `custom_${ex.name.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`,
        sets: ex.sets.length,
        reps: ex.sets.length > 0 ? String(ex.sets[0].reps) : '0',
        completedSets,
        isCompleted: true,
      };
    });

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
}

export const workoutNoteParser = new WorkoutNoteParser();
