import { CustomExercise, Equipment, GeneratedWorkout, MuscleGroup, UserProfile, WorkoutCategory } from '@/types';
import OpenAI from 'openai';
import { storageService } from './storage';
import { userService } from './userService';
import { getAvailableWorkouts, getWorkoutById, getWorkoutsByEquipment } from './workouts';

interface GenerateWorkoutOptions {
  focusArea?: string;
  duration?: number;
  customRequest?: string;
}

interface AIGeneratedWorkoutNote {
  title: string;
  noteText: string;
  exercises: {
    name: string;
    sets: number;
    reps: number;
    suggestedWeight: number;
  }[];
  contextQuestions?: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RefinePlanResponse {
  noteText: string;
  title: string;
  response: string;
  followUpQuestions?: string[];
}

interface AICustomExerciseMetadata {
  displayName: string;
  category: WorkoutCategory;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  description: string;
}

class AIWorkoutGeneratorService {
  private readonly AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.AI_API_KEY,
    });
  }

  /**
   * Generate a workout as note-style text that can be pasted into the notes input
   */
  async generateWorkoutNote(options: GenerateWorkoutOptions = {}): Promise<AIGeneratedWorkoutNote> {
    // Get user context
    const userProfile = await userService.getRealUserProfile();
    const workoutHistory = await storageService.getWorkoutHistory();
    const customExercises = await storageService.getCustomExercises();

    if (!this.AI_API_KEY) {
      return this.generateFallbackWorkout(userProfile, options);
    }

    try {
      const prompt = this.buildPrompt(userProfile, workoutHistory, customExercises, options);
      const response = await this.callAI(prompt);
      return response;
    } catch (error) {
      console.error('AI workout generation failed, using fallback:', error);
      return this.generateFallbackWorkout(userProfile, options);
    }
  }

  /**
   * Refine an existing workout plan based on chat conversation
   */
  async refinePlan(
    currentPlan: string,
    chatHistory: ChatMessage[],
    userMessage: string
  ): Promise<RefinePlanResponse> {
    // Get user context
    const userProfile = await userService.getRealUserProfile();
    const workoutHistory = await storageService.getWorkoutHistory();
    const customExercises = await storageService.getCustomExercises();

    if (!this.AI_API_KEY) {
      return {
        noteText: currentPlan,
        title: 'Workout',
        response: "I can't refine the plan without an API key. You can edit the plan manually.",
        followUpQuestions: [],
      };
    }

    try {
      const prompt = this.buildRefinePrompt(
        currentPlan,
        chatHistory,
        userMessage,
        userProfile,
        workoutHistory,
        customExercises
      );
      const response = await this.callRefineAI(prompt);
      return response;
    } catch (error) {
      console.error('AI plan refinement failed:', error);
      return {
        noteText: currentPlan,
        title: 'Workout',
        response: "Sorry, I couldn't process that. Try rephrasing or edit the plan directly.",
        followUpQuestions: [],
      };
    }
  }

  private buildRefinePrompt(
    currentPlan: string,
    chatHistory: ChatMessage[],
    userMessage: string,
    userProfile: UserProfile | null,
    workoutHistory: GeneratedWorkout[],
    customExercises: CustomExercise[]
  ): string {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const userEquipment = userProfile?.equipmentFilter?.includedEquipment || ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight'] as Equipment[];

    // Get available exercises filtered by user's equipment (100 percentile = all theme levels)
    const availableExercises = userEquipment.length > 0
      ? getWorkoutsByEquipment(userEquipment, 100)
      : getAvailableWorkouts(100);
    const exerciseNames = availableExercises.map(e => e.name);
    // Always include all custom exercises (they're not equipment-specific)
    const customExerciseNames = customExercises.map(e => e.name);
    const allExerciseNames = [...exerciseNames, ...customExerciseNames];

    // Format equipment list for display
    const equipmentDisplayMap: Record<Equipment, string> = {
      barbell: 'Barbell',
      dumbbell: 'Dumbbells',
      machine: 'Machines',
      cable: 'Cables',
      kettlebell: 'Kettlebell',
      bodyweight: 'Bodyweight',
    };
    const userEquipmentDisplay = userEquipment.map(e => equipmentDisplayMap[e]).join(', ');

    // Build chat history string
    const chatHistoryStr = chatHistory
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    return `You are helping refine a workout plan through conversation.

CURRENT PLAN:
${currentPlan}

CONVERSATION HISTORY:
${chatHistoryStr}

USER'S NEW MESSAGE:
${userMessage}

USER CONTEXT:
- Weight Unit: ${weightUnit}
- Available Equipment: ${userEquipmentDisplay}

AVAILABLE EXERCISES (already filtered to user's equipment):
${allExerciseNames.join(', ')}

INSTRUCTIONS:
1. Understand what the user wants to change or know
2. Update the plan if they request changes (add/remove exercises, adjust weights/reps, swap exercises)
3. Keep the same format: "Exercise Name (Equipment) WeightxReps, WeightxReps" followed by "Actual" on the next line, with blank lines between exercise blocks
4. Provide a brief, helpful response explaining what you changed or answering their question
5. Suggest 1-2 follow-up questions if relevant

EXERCISE NAMING FORMAT - Always include equipment in parentheses:
- Use format: "Exercise Name (Equipment)"
- Examples: "Bench Press (Barbell)", "Chest Press (Dumbbells)", "Tricep Pushdown (Cables)"
- Equipment types: Barbell, Dumbbells, Cables, Machine, Smith Machine, Kettlebell, Bodyweight

CRITICAL - EQUIPMENT CONSTRAINTS:
- The user has specified their available equipment: ${userEquipmentDisplay}
- ONLY use exercises that use this equipment - do NOT suggest exercises requiring equipment they don't have
- If the user further specifies equipment in their request (e.g., "dumbbells only"), narrow it down further
- When in doubt about equipment, ask for clarification
- Common equipment mappings:
  * "dumbbells only" = dumbbell exercises only (DB press, DB rows, DB curls, etc.)
  * "barbell only" = barbell exercises only (bench, squat, deadlift, rows, etc.)
  * "bodyweight" = no equipment (pushups, pullups, dips, squats, lunges, etc.)
  * "home gym" = typically dumbbells, maybe a barbell, no cables/machines

Return ONLY valid JSON (no markdown, no backticks):
{
  "noteText": "The updated workout plan (or same if no changes needed)",
  "title": "Short title for the workout",
  "response": "Brief response to the user (1-2 sentences)",
  "followUpQuestions": ["Optional follow-up question 1", "Optional follow-up question 2"]
}`;
  }

  private async callRefineAI(prompt: string): Promise<RefinePlanResponse> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful personal trainer refining workout plans through conversation. Be concise and helpful. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from AI');
    }

    // Clean the response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    }

    return JSON.parse(cleanedContent);
  }

  private buildPrompt(
    userProfile: UserProfile | null,
    workoutHistory: GeneratedWorkout[],
    customExercises: CustomExercise[],
    options: GenerateWorkoutOptions
  ): string {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const gender = userProfile?.gender || 'male';
    const userEquipment = userProfile?.equipmentFilter?.includedEquipment || ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight'] as Equipment[];

    // Get available exercises filtered by user's equipment (100 percentile = all theme levels)
    const availableExercises = userEquipment.length > 0
      ? getWorkoutsByEquipment(userEquipment, 100)
      : getAvailableWorkouts(100);
    const exerciseNames = availableExercises.map(e => e.name);

    // Always include all custom exercises (they're not equipment-specific)
    const customExerciseNames = customExercises.map(e => e.name);
    const allExerciseNames = [...exerciseNames, ...customExerciseNames];

    // Format equipment list for display
    const equipmentDisplayMap: Record<Equipment, string> = {
      barbell: 'Barbell',
      dumbbell: 'Dumbbells',
      machine: 'Machines',
      cable: 'Cables',
      kettlebell: 'Kettlebell',
      bodyweight: 'Bodyweight',
    };
    const userEquipmentDisplay = userEquipment.map(e => equipmentDisplayMap[e]).join(', ');

    // Analyze recent workout history for context
    const recentWorkouts = workoutHistory.slice(-5);
    const recentExercises = recentWorkouts.flatMap(w =>
      w.exercises.map(ex => {
        const info = getWorkoutById(ex.id);
        // Check custom exercises if not found in database
        const customEx = !info ? customExercises.find(c => c.id === ex.id) : null;
        const bestSet = ex.completedSets?.reduce((best, current) => {
          return (current.weight > best.weight) ? current : best;
        }, { weight: 0, reps: 0 });
        return {
          name: info?.name || customEx?.name || ex.id,
          weight: bestSet?.weight || 0,
          reps: bestSet?.reps || 0,
        };
      })
    );

    // Build exercise history summary
    const exerciseHistorySummary = recentExercises.length > 0
      ? `Recent exercise history (use these for weight suggestions):\n${recentExercises.map(e => `- ${e.name}: ${e.weight}${weightUnit} x ${e.reps}`).join('\n')}`
      : 'No recent workout history - use reasonable starting weights for a beginner/intermediate lifter.';

    // Build custom exercises summary
    const customExercisesSummary = customExerciseNames.length > 0
      ? `\nUser's custom exercises (prefer these when relevant):\n${customExerciseNames.map(n => `- ${n}`).join('\n')}`
      : '';

    // The user's request is the primary input
    const userRequest = options.customRequest || options.focusArea || 'a balanced full-body workout';

    return `Generate a workout based on this request: "${userRequest}"

USER CONTEXT:
- Gender: ${gender}
- Weight Unit: ${weightUnit}
- Available Equipment: ${userEquipmentDisplay}
${exerciseHistorySummary}
${customExercisesSummary}

AVAILABLE EXERCISES (prefer using these exact names when possible):
${allExerciseNames.join(', ')}

FORMATTING RULES:
1. Generate 4-7 exercises matching the user's request
2. PREFER exercises from the AVAILABLE EXERCISES list above - use their exact names
3. If you need an exercise not in the list, use a clear, standard name
4. Format as simple notes, one exercise per line
5. Each line: "Exercise Name WeightxReps, WeightxReps, WeightxReps"
6. Use ${weightUnit} for all weights (no unit symbol needed)
7. Base weights on the user's history if available, otherwise use reasonable defaults
8. Include 2-4 sets per exercise with slight weight progression or same weight

EXERCISE NAMING FORMAT - Always include equipment in parentheses:
- Use format: "Exercise Name (Equipment)"
- Examples: "Bench Press (Barbell)", "Chest Press (Dumbbells)", "Tricep Pushdown (Cables)"
- Equipment types: Barbell, Dumbbells, Cables, Machine, Smith Machine, Kettlebell, Bodyweight

CRITICAL - EQUIPMENT CONSTRAINTS:
- The user has specified their available equipment: ${userEquipmentDisplay}
- ONLY use exercises that use this equipment - do NOT suggest exercises requiring equipment they don't have
- If the user further specifies equipment in their request (e.g., "dumbbells only"), narrow it down further
- Common equipment mappings:
  * "dumbbells only" = dumbbell exercises only (DB press, DB rows, DB curls, goblet squats, lunges, etc.)
  * "barbell only" = barbell exercises only (bench, squat, deadlift, rows, OHP, etc.)
  * "barbell and dumbbells" = only barbell and dumbbell exercises, NO cables or machines
  * "bodyweight" = no equipment (pushups, pullups, dips, bodyweight squats, lunges, etc.)
  * "home gym" = typically dumbbells, maybe a barbell, no cables/machines

EXAMPLES of noteText format (with blank lines between exercises):
"Bench Press (Barbell) 135x10, 145x8, 155x6
Actual

Incline Chest Press (Dumbbells) 40x12, 45x10, 45x10
Actual

Chest Fly (Cables) 30x15, 30x12, 35x10
Actual

Tricep Pushdown (Cables) 50x12, 55x10, 55x10
Actual"

NOTE: Each exercise MUST have "Actual" on the line below it (for users to fill in their completed sets). Separate each exercise block with a blank line.

Return ONLY valid JSON (no markdown, no backticks):
{
  "title": "Short title for this workout",
  "noteText": "The workout as described above, exercises separated by newlines",
  "exercises": [{"name": "Exercise Name", "sets": 3, "reps": 10, "suggestedWeight": 135}],
  "contextQuestions": ["2-3 personalized questions to help refine the plan based on their history"]
}

CONTEXT QUESTIONS RULES:
- Generate 2-3 short, helpful questions based on the user's history and request
- Questions should help customize the workout (weight adjustments, exercise swaps, focus areas)
- If user has history, reference it (e.g., "You hit 155 last week - want to try 160 today?")
- Keep questions concise and actionable
- Examples: "Include tricep isolation?", "Go heavier on compounds?", "Add any supersets?"`;
  }

  private async callAI(prompt: string): Promise<AIGeneratedWorkoutNote> {
    // Note: GPT-5 models don't support temperature parameter
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a personal trainer generating workout plans in a simple note format. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 10000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from AI');
    }

    // Clean the response
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    }

    return JSON.parse(cleanedContent);
  }

  private generateFallbackWorkout(
    userProfile: UserProfile | null,
    options: GenerateWorkoutOptions
  ): AIGeneratedWorkoutNote {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const isMale = userProfile?.gender !== 'female';

    // Default weights based on gender (in lbs, will be converted if needed)
    let baseWeights = isMale
      ? { squat: 135, bench: 135, row: 95, press: 65, curl: 25, extension: 30 }
      : { squat: 65, bench: 65, row: 45, press: 35, curl: 15, extension: 20 };

    // Convert to kg if user prefers
    if (weightUnit === 'kg') {
      baseWeights = {
        squat: Math.round(baseWeights.squat * 0.453592 / 2.5) * 2.5,
        bench: Math.round(baseWeights.bench * 0.453592 / 2.5) * 2.5,
        row: Math.round(baseWeights.row * 0.453592 / 2.5) * 2.5,
        press: Math.round(baseWeights.press * 0.453592 / 2.5) * 2.5,
        curl: Math.round(baseWeights.curl * 0.453592 / 2.5) * 2.5,
        extension: Math.round(baseWeights.extension * 0.453592 / 2.5) * 2.5,
      };
    }

    // Parse user request to determine focus area
    const userRequest = (options.customRequest || options.focusArea || '').toLowerCase();
    let focusArea = 'full-body';

    if (userRequest.includes('push') || userRequest.includes('chest') || userRequest.includes('tricep')) {
      focusArea = 'push';
    } else if (userRequest.includes('pull') || userRequest.includes('back') || userRequest.includes('bicep')) {
      focusArea = 'pull';
    } else if (userRequest.includes('leg') || userRequest.includes('squat') || userRequest.includes('lower')) {
      focusArea = 'legs';
    } else if (userRequest.includes('upper')) {
      focusArea = 'upper';
    }

    let exercises: { name: string; sets: number; reps: number; suggestedWeight: number }[];
    let title: string;

    if (focusArea === 'push') {
      title = 'Push Day';
      exercises = [
        { name: 'Bench Press', sets: 4, reps: 8, suggestedWeight: baseWeights.bench },
        { name: 'Incline Dumbbell Press', sets: 3, reps: 10, suggestedWeight: Math.round(baseWeights.bench * 0.3) },
        { name: 'Overhead Press', sets: 3, reps: 8, suggestedWeight: baseWeights.press },
        { name: 'Cable Fly', sets: 3, reps: 12, suggestedWeight: Math.round(baseWeights.bench * 0.2) },
        { name: 'Tricep Pushdown', sets: 3, reps: 12, suggestedWeight: baseWeights.extension },
      ];
    } else if (focusArea === 'pull') {
      title = 'Pull Day';
      exercises = [
        { name: 'Barbell Row', sets: 4, reps: 8, suggestedWeight: baseWeights.row },
        { name: 'Lat Pulldown', sets: 3, reps: 10, suggestedWeight: Math.round(baseWeights.row * 0.8) },
        { name: 'Seated Cable Row', sets: 3, reps: 10, suggestedWeight: Math.round(baseWeights.row * 0.7) },
        { name: 'Face Pull', sets: 3, reps: 15, suggestedWeight: Math.round(baseWeights.row * 0.3) },
        { name: 'Dumbbell Curl', sets: 3, reps: 12, suggestedWeight: baseWeights.curl },
      ];
    } else if (focusArea === 'legs') {
      title = 'Leg Day';
      exercises = [
        { name: 'Squat', sets: 4, reps: 6, suggestedWeight: baseWeights.squat },
        { name: 'Romanian Deadlift', sets: 3, reps: 10, suggestedWeight: Math.round(baseWeights.squat * 0.8) },
        { name: 'Leg Press', sets: 3, reps: 12, suggestedWeight: baseWeights.squat * 2 },
        { name: 'Leg Extension', sets: 3, reps: 12, suggestedWeight: baseWeights.extension * 2 },
        { name: 'Calf Raise', sets: 4, reps: 15, suggestedWeight: baseWeights.squat },
      ];
    } else if (focusArea === 'upper') {
      title = 'Upper Body';
      exercises = [
        { name: 'Bench Press', sets: 3, reps: 8, suggestedWeight: baseWeights.bench },
        { name: 'Barbell Row', sets: 3, reps: 8, suggestedWeight: baseWeights.row },
        { name: 'Overhead Press', sets: 3, reps: 10, suggestedWeight: baseWeights.press },
        { name: 'Lat Pulldown', sets: 3, reps: 10, suggestedWeight: Math.round(baseWeights.row * 0.8) },
        { name: 'Dumbbell Curl', sets: 3, reps: 12, suggestedWeight: baseWeights.curl },
        { name: 'Tricep Pushdown', sets: 3, reps: 12, suggestedWeight: baseWeights.extension },
      ];
    } else {
      title = 'Full Body Workout';
      exercises = [
        { name: 'Squat', sets: 3, reps: 8, suggestedWeight: baseWeights.squat },
        { name: 'Bench Press', sets: 3, reps: 8, suggestedWeight: baseWeights.bench },
        { name: 'Barbell Row', sets: 3, reps: 8, suggestedWeight: baseWeights.row },
        { name: 'Overhead Press', sets: 3, reps: 10, suggestedWeight: baseWeights.press },
        { name: 'Dumbbell Curl', sets: 3, reps: 12, suggestedWeight: baseWeights.curl },
      ];
    }

    // Build note text with "Actual" placeholder below each exercise
    const noteText = exercises.map(ex => {
      const sets = [];
      for (let i = 0; i < ex.sets; i++) {
        // Slight variation in reps for realism
        const reps = ex.reps + (i === ex.sets - 1 ? -2 : 0);
        sets.push(`${ex.suggestedWeight}x${Math.max(reps, 1)}`);
      }
      return `${ex.name} ${sets.join(', ')}\nActual`;
    }).join('\n\n');

    return {
      title,
      noteText,
      exercises,
    };
  }

  /**
   * Generate metadata for a custom exercise using AI
   * This creates proper muscle groups, equipment, category, and description
   */
  async generateCustomExerciseMetadata(exerciseName: string): Promise<CustomExercise> {
    // Try AI first, fall back to defaults
    if (this.AI_API_KEY) {
      try {
        const metadata = await this.callCustomExerciseAI(exerciseName);
        // Use AI-formatted displayName for the exercise name
        const formattedName = metadata.displayName || exerciseName;
        const kebabId = formattedName
          .toLowerCase()
          .replace(/[()]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        return {
          id: kebabId,
          name: formattedName,
          category: metadata.category,
          primaryMuscles: metadata.primaryMuscles,
          secondaryMuscles: metadata.secondaryMuscles,
          equipment: metadata.equipment,
          description: metadata.description,
          isMainLift: false,
          themeLevel: 'beginner',
          isCustom: true,
          createdAt: new Date(),
        };
      } catch (error) {
        console.error('AI custom exercise generation failed, using defaults:', error);
      }
    }

    // Fallback: generate reasonable defaults
    const kebabId = exerciseName
      .toLowerCase()
      .replace(/[()]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return this.generateFallbackCustomExercise(exerciseName, kebabId);
  }

  private async callCustomExerciseAI(exerciseName: string): Promise<AICustomExerciseMetadata> {
    const prompt = `You are a fitness expert. Given the exercise name "${exerciseName}", return JSON with exercise metadata.

VALID VALUES:
- displayName: Properly formatted exercise name in Title Case with equipment in parentheses at the end
  Examples: "Super Horizontal Bench Press (Machine)", "Incline Cable Fly (Cables)", "Pause Squat (Barbell)"
- category: "compound" | "isolation" | "cardio" | "flexibility"
- primaryMuscles: Array of 1-2 from ["chest", "back", "shoulders", "arms", "legs", "glutes", "core"]
- secondaryMuscles: Array of 0-3 from ["chest", "back", "shoulders", "arms", "legs", "glutes", "core"]
- equipment: Array from ["barbell", "dumbbell", "machine", "cable", "kettlebell", "bodyweight"]
- description: Short 1-sentence description of the exercise

FORMATTING RULES for displayName:
- Use Title Case for all words
- Put primary equipment type in parentheses at the end
- Equipment labels: (Barbell), (Dumbbells), (Machine), (Cables), (Kettlebell), (Bodyweight)
- If input is "super horizontal bench press", output displayName: "Super Horizontal Bench Press (Machine)"
- If input is "incline cable fly", output displayName: "Incline Cable Fly (Cables)"

RETURN ONLY VALID JSON:
{
  "displayName": "Exercise Name (Equipment)",
  "category": "compound",
  "primaryMuscles": ["chest"],
  "secondaryMuscles": ["shoulders", "arms"],
  "equipment": ["machine"],
  "description": "A pressing movement targeting the chest."
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a fitness expert. Return only valid JSON for exercise metadata.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from AI');
    }

    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    }

    return JSON.parse(cleanedContent);
  }

  private generateFallbackCustomExercise(exerciseName: string, kebabId: string): CustomExercise {
    const nameLower = exerciseName.toLowerCase();

    // Infer equipment from name
    let equipment: Equipment[] = ['bodyweight'];
    if (nameLower.includes('barbell') || nameLower.includes('bar ')) equipment = ['barbell'];
    else if (nameLower.includes('dumbbell') || nameLower.includes('db ')) equipment = ['dumbbell'];
    else if (nameLower.includes('machine')) equipment = ['machine'];
    else if (nameLower.includes('cable')) equipment = ['cable'];
    else if (nameLower.includes('kettlebell') || nameLower.includes('kb ')) equipment = ['kettlebell'];

    // Infer primary muscle from common exercise patterns
    let primaryMuscles: MuscleGroup[] = ['chest'];
    let secondaryMuscles: MuscleGroup[] = [];
    let category: WorkoutCategory = 'isolation';

    if (nameLower.includes('press') || nameLower.includes('bench') || nameLower.includes('fly') || nameLower.includes('push')) {
      primaryMuscles = ['chest'];
      secondaryMuscles = ['shoulders', 'arms'];
      category = 'compound';
    } else if (nameLower.includes('row') || nameLower.includes('pull') || nameLower.includes('lat')) {
      primaryMuscles = ['back'];
      secondaryMuscles = ['arms'];
      category = 'compound';
    } else if (nameLower.includes('squat') || nameLower.includes('leg press') || nameLower.includes('lunge')) {
      primaryMuscles = ['legs'];
      secondaryMuscles = ['glutes', 'core'];
      category = 'compound';
    } else if (nameLower.includes('deadlift') || nameLower.includes('hip')) {
      primaryMuscles = ['back', 'legs'];
      secondaryMuscles = ['glutes', 'core'];
      category = 'compound';
    } else if (nameLower.includes('shoulder') || nameLower.includes('ohp') || nameLower.includes('lateral') || nameLower.includes('arnold')) {
      primaryMuscles = ['shoulders'];
      secondaryMuscles = ['arms'];
      category = nameLower.includes('lateral') ? 'isolation' : 'compound';
    } else if (nameLower.includes('curl') || nameLower.includes('bicep')) {
      primaryMuscles = ['arms'];
      category = 'isolation';
    } else if (nameLower.includes('tricep') || nameLower.includes('extension') || nameLower.includes('pushdown')) {
      primaryMuscles = ['arms'];
      category = 'isolation';
    } else if (nameLower.includes('calf') || nameLower.includes('calves')) {
      primaryMuscles = ['legs'];
      category = 'isolation';
    } else if (nameLower.includes('ab') || nameLower.includes('crunch') || nameLower.includes('plank') || nameLower.includes('core')) {
      primaryMuscles = ['core'];
      category = 'isolation';
    } else if (nameLower.includes('glute') || nameLower.includes('thrust')) {
      primaryMuscles = ['glutes'];
      secondaryMuscles = ['legs'];
      category = 'isolation';
    }

    return {
      id: kebabId,
      name: exerciseName,
      category,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      description: `Custom exercise: ${exerciseName}`,
      isMainLift: false,
      themeLevel: 'beginner',
      isCustom: true,
      createdAt: new Date(),
    };
  }
}

export const aiWorkoutGenerator = new AIWorkoutGeneratorService();
