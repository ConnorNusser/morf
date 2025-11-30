import { CustomExercise, GeneratedWorkout, WeightUnit, WorkoutExerciseSession, WorkoutSetCompletion } from '@/types';
import OpenAI from 'openai';
import { aiWorkoutGenerator } from './aiWorkoutGenerator';
import { storageService } from './storage';
import { getAvailableWorkouts, getWorkoutById } from './workouts';

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
      // Barbell exercises
      'bench-press': ['bench', 'flat bench', 'barbell bench', 'bb bench', 'bench press barbell'],
      'squat': ['squats', 'back squat', 'barbell squat', 'bb squat'],
      'deadlift': ['deadlifts', 'conventional deadlift', 'deads', 'barbell deadlift', 'bb deadlift'],
      'overhead-press': ['ohp', 'military press', 'barbell shoulder press', 'barbell press', 'bb ohp'],
      'barbell-row': ['bent over row', 'rows', 'bb row', 'barbell rows', 'bent row'],
      'incline-bench-press': ['incline bench', 'incline press', 'incline barbell', 'incline bb'],
      'romanian-deadlift': ['rdl', 'romanian dl', 'stiff leg deadlift', 'barbell rdl', 'bb rdl'],
      'sumo-deadlift': ['sumo', 'sumo dl', 'sumo deads'],
      'barbell-bicep-curl': ['bb curl', 'barbell curls', 'barbell curl'],
      'barbell-hip-thrust': ['bb hip thrust', 'barbell thrust'],
      'barbell-shrugs': ['bb shrugs', 'barbell shrug'],
      'barbell-lunges': ['bb lunges', 'barbell lunge'],
      'front-squat': ['front squats', 'bb front squat'],
      't-bar-row': ['t bar row', 'tbar row', 't-bar'],

      // Dumbbell exercises
      'dumbbell-chest-press': ['db bench', 'dumbbell bench', 'db press', 'dumbbell press', 'dumbbell bench press'],
      'bicep-curl': ['db curl', 'curls', 'dumbbell curl', 'dumbbell curls'],
      'dumbbell-shoulder-press': ['db shoulder press', 'db press', 'dumbbell ohp'],
      'hammer-curl': ['hammer curls', 'db hammer curl'],
      'lateral-raise': ['lateral raises', 'side raise', 'side raises', 'db lateral raise'],
      'dumbbell-flyes': ['db fly', 'db flyes', 'dumbbell fly', 'chest fly dumbbell'],
      'dumbbell-bent-over-row': ['db row', 'dumbbell row', 'one arm row'],
      'single-arm-dumbbell-row': ['single arm row', 'one arm db row', 'single db row'],
      'incline-dumbbell-chest-press': ['incline db press', 'incline dumbbell', 'incline dumbbell press'],
      'dumbbell-romanian-deadlift': ['db rdl', 'dumbbell rdl'],
      'goblet-squat': ['goblet squats', 'db goblet squat'],
      'dumbbell-lunges': ['db lunges', 'dumbbell lunge'],
      'skull-crushers': ['skull crusher', 'db skull crushers', 'lying tricep extension'],
      'dumbbell-shrugs': ['db shrugs', 'dumbbell shrug'],

      // Cable exercises
      'lat-pulldown': ['lat pulldowns', 'pulldown', 'pulldowns', 'cable pulldown'],
      'cable-tricep-pushdown': ['pushdowns', 'tricep pushdowns', 'rope pushdown', 'cable pushdown', 'tricep pulldowns', 'tricep pulldown'],
      'cable-chest-fly': ['cable fly', 'cable flies', 'cable flyes', 'pec fly cables'],
      'seated-cable-row': ['cable row', 'seated row cables', 'low row'],
      'cable-bicep-curl': ['cable curl', 'cable curls'],
      'cable-lateral-raise': ['cable lateral', 'cable side raise'],
      'cable-rear-delt-fly': ['cable rear delt', 'face pull', 'face pulls'],
      'cable-wood-chop': ['wood chops', 'cable chop'],

      // Machine exercises
      'leg-press': ['leg press machine', 'machine leg press'],
      'leg-extension': ['leg extensions', 'quad extension', 'machine leg extension'],
      'leg-curl': ['leg curls', 'hamstring curl', 'machine leg curl'],
      'chest-press-machine': ['machine chest press', 'machine bench', 'chest press machine', 'machine press'],
      'shoulder-press-machine': ['machine shoulder press', 'machine ohp'],
      'seated-row-machine': ['machine row', 'machine rows'],
      'chest-fly-machine': ['machine fly', 'pec deck', 'pec fly machine'],
      'hack-squat-machine': ['hack squat', 'hack squats'],
      'smith-machine-squat': ['smith squat', 'smith machine squat'],
      'smith-machine-bench-press': ['smith bench', 'smith press', 'smith machine bench'],
      'machine-hip-thrust': ['hip thrust machine'],
      'machine-lateral-raise': ['machine lateral', 'lateral raise machine'],
      'machine-rear-delt-fly': ['reverse fly machine', 'rear delt machine'],

      // Bodyweight exercises
      'pull-up': ['pullups', 'pull ups', 'pullup'],
      'chin-up': ['chinups', 'chin ups', 'chinup'],
      'push-up': ['pushups', 'push ups', 'pushup'],
      'dip': ['dips', 'parallel bar dips'],
      'plank': ['planks', 'front plank'],

      // Kettlebell exercises
      'kettlebell-swing': ['kb swing', 'kettlebell swings', 'kb swings'],
      'kettlebell-goblet-squat': ['kb goblet squat', 'kettlebell squat'],

      // Common misspellings
      'calf-raise': ['calf raises', 'calves', 'calf raise', 'calve raise'],
    };

    return aliasMap[id] || [];
  }

  // Modifiers that change the meaning of an exercise significantly
  private readonly SIGNIFICANT_MODIFIERS = [
    'incline', 'decline', 'flat', 'seated', 'standing', 'lying',
    'reverse', 'close grip', 'wide grip', 'narrow', 'sumo', 'romanian',
    'front', 'rear', 'lateral', 'overhead', 'behind', 'single arm', 'one arm',
    'super', 'pause', 'tempo', 'explosive', 'slow'
  ];

  // Check if a name contains any significant modifiers
  private getModifiers(name: string): string[] {
    const lowerName = name.toLowerCase();
    return this.SIGNIFICANT_MODIFIERS.filter(mod => lowerName.includes(mod));
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

    // Get modifiers in the input name
    const inputModifiers = this.getModifiers(normalizedName);

    // Try partial matching in database exercises (with modifier awareness)
    for (const [cachedName, id] of this.exerciseNameCache.entries()) {
      if (this.isValidPartialMatch(normalizedName, cachedName, inputModifiers)) {
        return { id, isCustom: false };
      }
    }

    // Try partial matching in custom exercises (with modifier awareness)
    for (const [cachedName, id] of this.customExerciseCache.entries()) {
      if (this.isValidPartialMatch(normalizedName, cachedName, inputModifiers)) {
        return { id, isCustom: true };
      }
    }

    // No match found - this will be a new custom exercise
    return null;
  }

  // Check if partial match is valid (not a false positive due to modifiers)
  private isValidPartialMatch(inputName: string, cachedName: string, inputModifiers: string[]): boolean {
    // Must have substring relationship
    if (!inputName.includes(cachedName) && !cachedName.includes(inputName)) {
      return false;
    }

    // Get modifiers in the cached name
    const cachedModifiers = this.getModifiers(cachedName);

    // If input has modifiers that the cached name doesn't have, it's likely a different exercise
    // e.g., "incline chest fly" should NOT match "chest fly"
    const extraInputModifiers = inputModifiers.filter(mod => !cachedModifiers.includes(mod));
    if (extraInputModifiers.length > 0) {
      return false;
    }

    // If cached has modifiers that input doesn't have, also reject
    // e.g., "chest fly" should NOT match "incline chest fly" in the cache
    const extraCachedModifiers = cachedModifiers.filter(mod => !inputModifiers.includes(mod));
    if (extraCachedModifiers.length > 0) {
      return false;
    }

    return true;
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
1. Only return a match if you're VERY confident it's the EXACT same exercise (just named differently)
2. Common abbreviation matches: "DB" = "Dumbbell", "BB" = "Barbell"
3. If the input has words like "super", "special", "custom", or other unique modifiers NOT in the available list, return null
4. If the input describes a different VARIATION (e.g., different angle, grip, or style), return null
5. "Super horizontal bench press" is NOT the same as "Bench Press" - return null
6. "Incline cable fly" is NOT the same as "Chest Fly (Cables)" - different angle means different exercise
7. Only match if ALL significant words match (just reordered or abbreviated)

Return ONLY valid JSON (no markdown):
{
  "matchedName": "Exact name from the available list" or null,
  "confidence": 0.0 to 1.0
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a strict exercise name matcher. Only match if exercises are EXACTLY the same movement. Return only valid JSON.' },
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

      // Require 85% confidence for a match (raised from 70%)
      if (result.matchedName && result.confidence >= 0.85) {
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

EQUIPMENT KEYWORDS - Use these to format exercise names correctly:
- "barbell", "bb", "bar" → indicates barbell exercise: "Bench Press (Barbell)"
- "dumbbell", "db", "dumbbells" → indicates dumbbell exercise: "Chest Press (Dumbbells)"
- "cable", "cables" → indicates cable exercise: "Tricep Pushdown (Cables)"
- "machine" → indicates machine exercise: "Chest Press (Machine)"
- "smith", "smith machine" → indicates Smith machine: "Bench Press (Smith Machine)"
- "kettlebell", "kb" → indicates kettlebell: "Swing (Kettlebell)"
- "bodyweight", "bw" → indicates bodyweight: "Pull-up (Bodyweight)"
- "single arm", "one arm", "unilateral" → indicates single-sided exercise

EXERCISE NAME MATCHING RULES:
- Include equipment type in parentheses at the end: "Exercise Name (Equipment)"
- "machine bench press" = "Bench Press (Machine)", NOT "Bench Press (Barbell)"
- "bench press" (no qualifier) = "Bench Press (Barbell)" (default to barbell for main lifts)
- "db bench" or "dumbbell bench" = "Chest Press (Dumbbells)"
- "cable fly" = "Chest Fly (Cables)"
- "tricep pulldown" or "tricep pushdown" = "Tricep Pushdown (Cables)"
- Handle misspellings and abbreviations (e.g., "lat pulldown" = "Lat Pulldown (Cables)")
- "custom" keyword means user's custom exercise - assume this doesn't match any of the available exercises

CRITICAL - UNRECOGNIZED/CUSTOM EXERCISES:
- If you cannot confidently match an exercise name to a standard exercise, STILL format it properly
- Use Title Case and add equipment type in parentheses based on context clues
- Do NOT try to match to a known exercise - just format the name nicely
- Examples:
  * "super horizontal bench press" → "Super Horizontal Bench Press (Machine)"
  * "incline cable fly" → "Incline Cable Fly (Cables)"
  * "crazy 8s biceps" → "Crazy 8s Biceps (Dumbbells)" (assume dumbbells if no equipment mentioned for arm exercises)
  * "pause squat" → "Pause Squat (Barbell)" (assume barbell for squat variations)
- ALWAYS format exercise names in Title Case with equipment in parentheses, even for custom exercises

DISTINGUISHING TARGET vs ACTUAL SETS:
- "Target" sets are PLANNED sets, NOT actual working sets performed
- Keywords that indicate TARGET sets: "target", "recommended", "plan", "goal", "aim for", "try", "should do"
- Keywords that indicate ACTUAL sets (real working sets performed): "did", "completed", "actual", "hit", "got", "lifted", specific weight x rep notation without qualifiers
- If the input shows both target AND actual for an exercise, put target in "recommendedSets" and actual in "sets"
- If no distinction is made, assume all sets are ACTUAL working sets (put in "sets")
- NEVER put target sets in the main "sets" array - only actual working sets go there

EXAMPLES:
- "Bench target 135x8, did 145x8, 155x6" → name: "Bench Press (Barbell)", recommendedSets: [135x8], sets: [145x8, 155x6]
- "Machine bench 100x10" → name: "Bench Press (Machine)", sets: [100x10]
- "DB bench 40x12" → name: "Chest Press (Dumbbells)", sets: [40x12]
- "Tricep pulldowns 50x15" → name: "Tricep Pushdown (Cables)", sets: [50x15]
- "Single arm db row 35x10" → name: "Single Arm Row (Dumbbells)", sets: [35x10]

WORKOUT NOTES:
${text}

Return ONLY valid JSON in this exact format (no markdown, no backticks):
{
  "exercises": [
    {
      "name": "Exercise Name (Equipment)",
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
  // Consolidates exercises with the same name
  toSummary(parsed: ParsedWorkout): ParsedExerciseSummary[] {
    const consolidatedMap = new Map<string, ParsedExerciseSummary>();

    for (const ex of parsed.exercises) {
      const displayName = ex.matchedExerciseId
        ? getWorkoutById(ex.matchedExerciseId)?.name || ex.name
        : ex.name;

      // Normalize the name for comparison (lowercase, trim)
      const normalizedName = displayName.toLowerCase().trim();

      if (consolidatedMap.has(normalizedName)) {
        // Consolidate with existing exercise
        const existing = consolidatedMap.get(normalizedName)!;
        existing.sets = [...existing.sets, ...ex.sets];
        existing.setCount = existing.sets.length;

        // Merge recommended sets if present
        if (ex.recommendedSets) {
          existing.recommendedSets = [
            ...(existing.recommendedSets || []),
            ...ex.recommendedSets,
          ];
        }
      } else {
        // Add new exercise to map
        consolidatedMap.set(normalizedName, {
          name: displayName,
          setCount: ex.sets.length,
          sets: [...ex.sets],
          recommendedSets: ex.recommendedSets ? [...ex.recommendedSets] : undefined,
        });
      }
    }

    return Array.from(consolidatedMap.values());
  }

  // Convert parsed workout to GeneratedWorkout format for saving
  // Also auto-creates custom exercises for unmatched exercise names
  // Uses AI to generate proper metadata (muscle groups, equipment, category)
  async toGeneratedWorkoutWithCustomExercises(parsed: ParsedWorkout, duration: number): Promise<GeneratedWorkout> {
    const exercises: WorkoutExerciseSession[] = [];
    let newCustomExercisesCreated = false;

    for (const ex of parsed.exercises) {
      let exerciseId = ex.matchedExerciseId;

      // If this is a custom exercise (no match), create it with AI-generated metadata
      if (ex.isCustom && !exerciseId) {
        // Check if a custom exercise with this name already exists
        const existingCustom = await storageService.getCustomExerciseByName(ex.name);

        if (existingCustom) {
          exerciseId = existingCustom.id;
        } else {
          // Generate custom exercise with AI (includes proper ID format, muscle groups, equipment, etc.)
          const customExercise = await aiWorkoutGenerator.generateCustomExerciseMetadata(ex.name);
          await storageService.saveCustomExercise(customExercise);
          exerciseId = customExercise.id;
          newCustomExercisesCreated = true;
          console.log(`Created new custom exercise: "${ex.name}" (${customExercise.id})`);
        }
      }

      const completedSets: WorkoutSetCompletion[] = ex.sets.map((set, index) => ({
        setNumber: index + 1,
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        completed: true,
      }));

      // Generate kebab-case ID if we still don't have one
      const fallbackId = ex.name
        .toLowerCase()
        .replace(/[()]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      exercises.push({
        id: exerciseId || fallbackId,
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

  // Sync version for backwards compatibility (uses kebab-case IDs)
  toGeneratedWorkout(parsed: ParsedWorkout, duration: number): GeneratedWorkout {
    const exercises: WorkoutExerciseSession[] = parsed.exercises.map(ex => {
      const completedSets: WorkoutSetCompletion[] = ex.sets.map((set, index) => ({
        setNumber: index + 1,
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        completed: true,
      }));

      // Generate kebab-case ID for custom exercises
      const kebabId = ex.name
        .toLowerCase()
        .replace(/[()]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      return {
        id: ex.matchedExerciseId || kebabId,
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
