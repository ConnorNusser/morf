import { CustomExercise, Equipment, GeneratedWorkout, MuscleGroup, TrackingType, UserProfile, WorkoutCategory } from '@/types';
import OpenAI from 'openai';
import { analyticsService } from '@/lib/services/analytics';
import { buildCustomExercisePrompt } from './prompts/customExercise.prompt';
import { buildWorkoutGenerationPrompt } from './prompts/workoutGeneration.prompt';
import { buildWorkoutRefinementPrompt } from './prompts/workoutRefinement.prompt';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { getAvailableWorkouts, getWorkoutById, getWorkoutsByEquipment } from '@/lib/workout/workouts';

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
      apiKey: this.AI_API_KEY || process.env.OPENAI_API_KEY,
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
      const response = await this.callAI(prompt, options.customRequest);
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
      const response = await this.callRefineAI(prompt, userMessage);
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
    _workoutHistory: GeneratedWorkout[],
    customExercises: CustomExercise[]
  ): string {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const userEquipment = userProfile?.equipmentFilter?.includedEquipment || ['barbell', 'dumbbell', 'machine', 'smith-machine', 'cable', 'kettlebell', 'bodyweight'] as Equipment[];

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
      'smith-machine': 'Smith Machine',
      cable: 'Cables',
      kettlebell: 'Kettlebell',
      bodyweight: 'Bodyweight',
    };
    const userEquipmentDisplay = userEquipment.map(e => equipmentDisplayMap[e]).join(', ');

    // Build chat history string
    const chatHistoryStr = chatHistory
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    return buildWorkoutRefinementPrompt({
      currentPlan,
      chatHistoryStr,
      userMessage,
      weightUnit,
      userEquipmentDisplay,
      allExerciseNames,
    });
  }

  private async callRefineAI(prompt: string, userMessage: string): Promise<RefinePlanResponse> {
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

    const parsed = JSON.parse(cleanedContent);

    // Track AI usage analytics
    analyticsService.trackAIUsage({
      requestType: 'plan_builder',
      inputText: userMessage,
      outputData: parsed,
      tokensUsed: response.usage?.total_tokens,
      model: 'gpt-4o',
    });

    return parsed;
  }

  private buildPrompt(
    userProfile: UserProfile | null,
    workoutHistory: GeneratedWorkout[],
    customExercises: CustomExercise[],
    options: GenerateWorkoutOptions
  ): string {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const gender = userProfile?.gender || 'male';
    const userEquipment = userProfile?.equipmentFilter?.includedEquipment || ['barbell', 'dumbbell', 'machine', 'smith-machine', 'cable', 'kettlebell', 'bodyweight'] as Equipment[];

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
      'smith-machine': 'Smith Machine',
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

    return buildWorkoutGenerationPrompt({
      userRequest,
      gender,
      weightUnit,
      userEquipmentDisplay,
      exerciseHistorySummary,
      customExercisesSummary,
      allExerciseNames,
    });
  }

  private async callAI(prompt: string, customRequest?: string): Promise<AIGeneratedWorkoutNote> {
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

    const parsed = JSON.parse(cleanedContent);

    // Track AI usage analytics
    analyticsService.trackAIUsage({
      requestType: 'routine_generate',
      inputText: customRequest || 'auto-generated workout',
      outputData: parsed,
      tokensUsed: response.usage?.total_tokens,
      model: 'gpt-4o',
    });

    return parsed;
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
    const prompt = buildCustomExercisePrompt({ exerciseName });

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
    else if (nameLower.includes('smith machine') || nameLower.includes('smith-machine')) equipment = ['smith-machine'];
    else if (nameLower.includes('machine')) equipment = ['machine'];
    else if (nameLower.includes('cable')) equipment = ['cable'];
    else if (nameLower.includes('kettlebell') || nameLower.includes('kb ')) equipment = ['kettlebell'];

    // Infer tracking type from name
    let trackingType: TrackingType = 'reps';
    if (nameLower.includes('plank') || nameLower.includes('hold') || nameLower.includes('hang') ||
        nameLower.includes('wall sit') || nameLower.includes('isometric')) {
      trackingType = 'timed';
    } else if (nameLower.includes('row machine') || nameLower.includes('rowing') ||
               nameLower.includes('treadmill') || nameLower.includes('bike') ||
               nameLower.includes('elliptical') || nameLower.includes('stair') ||
               nameLower.includes('run') || nameLower.includes('jog') ||
               nameLower.includes('cycle') || nameLower.includes('cardio')) {
      trackingType = 'cardio';
    }

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
    } else if (trackingType === 'cardio') {
      // Cardio exercises typically target legs and full-body
      primaryMuscles = ['legs'];
      secondaryMuscles = ['core'];
      category = 'cardio';
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
      trackingType,
      isCustom: true,
      createdAt: new Date(),
    };
  }
}

export const aiWorkoutGenerator = new AIWorkoutGeneratorService();
