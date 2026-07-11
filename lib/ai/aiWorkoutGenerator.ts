import { CustomExercise, Equipment, LoggedWorkout, MuscleGroup, TrackingType, UserProfile, WorkoutCategory } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { analyticsService } from '@/lib/services/analytics';
import { parseGeminiJson } from './geminiJson';
import { buildCustomExercisePrompt } from './prompts/customExercise.prompt';
import { buildWorkoutGenerationPrompt } from './prompts/workoutGeneration.prompt';
import { buildWorkoutRefinementPrompt } from './prompts/workoutRefinement.prompt';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { getAvailableExercises, getCatalogExercise, getExercisesByEquipment } from '@/lib/workout/exerciseCatalog';
import { ALL_EQUIPMENT, formatEquipmentList } from '@/lib/workout/equipment';

interface GenerateWorkoutOptions {
  focusArea?: string;
  customRequest?: string;
}

interface AILoggedWorkoutNote {
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
  private readonly GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(this.GEMINI_API_KEY || '');
  }

  /** Generates note-style text that can be pasted into the notes input. */
  async generateWorkoutNote(options: GenerateWorkoutOptions = {}): Promise<AILoggedWorkoutNote> {
    const userProfile = await userService.getRealUserProfile();
    const workoutHistory = await storageService.getWorkoutHistory();
    const customExercises = await storageService.getCustomExercises();

    if (!this.GEMINI_API_KEY) {
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

  async refinePlan(
    currentPlan: string,
    chatHistory: ChatMessage[],
    userMessage: string
  ): Promise<RefinePlanResponse> {
    const userProfile = await userService.getRealUserProfile();
    const customExercises = await storageService.getCustomExercises();

    if (!this.GEMINI_API_KEY) {
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
    customExercises: CustomExercise[]
  ): string {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const userEquipment = userProfile?.equipmentFilter?.includedEquipment || ALL_EQUIPMENT;

    // 100 percentile = all theme levels.
    const availableExercises = userEquipment.length > 0
      ? getExercisesByEquipment(userEquipment, 100)
      : getAvailableExercises(100);
    const exerciseNames = availableExercises.map(e => e.name);
    // Custom exercises are always included (not equipment-specific).
    const customExerciseNames = customExercises.map(e => e.name);
    const allExerciseNames = [...exerciseNames, ...customExerciseNames];

    const userEquipmentDisplay = formatEquipmentList(userEquipment);

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
    const startTime = Date.now();

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const fullPrompt = `You are a helpful personal trainer refining workout plans through conversation. Be concise and helpful. Return only valid JSON.\n\n${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const content = response.text();

    console.log(`[WorkoutGenerator] callRefineAI took ${Date.now() - startTime}ms`);

    const parsed = parseGeminiJson(content);

    analyticsService.trackAIUsage({
      requestType: 'plan_builder',
      inputText: userMessage,
      outputData: parsed,
      model: 'gemini-2.5-flash',
    });

    return parsed;
  }

  private buildPrompt(
    userProfile: UserProfile | null,
    workoutHistory: LoggedWorkout[],
    customExercises: CustomExercise[],
    options: GenerateWorkoutOptions
  ): string {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const gender = userProfile?.gender || 'male';
    const userEquipment = userProfile?.equipmentFilter?.includedEquipment || ALL_EQUIPMENT;

    // 100 percentile = all theme levels.
    const availableExercises = userEquipment.length > 0
      ? getExercisesByEquipment(userEquipment, 100)
      : getAvailableExercises(100);
    const exerciseNames = availableExercises.map(e => e.name);

    // Custom exercises are always included (not equipment-specific).
    const customExerciseNames = customExercises.map(e => e.name);
    const allExerciseNames = [...exerciseNames, ...customExerciseNames];

    const userEquipmentDisplay = formatEquipmentList(userEquipment);

    const recentWorkouts = workoutHistory.slice(-5);
    const recentExercises = recentWorkouts.flatMap(w =>
      w.exercises.map(ex => {
        const info = getCatalogExercise(ex.id);
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

    const exerciseHistorySummary = recentExercises.length > 0
      ? `Recent exercise history (use these for weight suggestions):\n${recentExercises.map(e => `- ${e.name}: ${e.weight}${weightUnit} x ${e.reps}`).join('\n')}`
      : 'No recent workout history - use reasonable starting weights for a beginner/intermediate lifter.';

    const customExercisesSummary = customExerciseNames.length > 0
      ? `\nUser's custom exercises (prefer these when relevant):\n${customExerciseNames.map(n => `- ${n}`).join('\n')}`
      : '';

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

  private async callAI(prompt: string, customRequest?: string): Promise<AILoggedWorkoutNote> {
    const startTime = Date.now();

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const fullPrompt = `You are a personal trainer generating workout plans in a simple note format. Return only valid JSON.\n\n${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const content = response.text();

    console.log(`[WorkoutGenerator] callAI took ${Date.now() - startTime}ms`);

    const parsed = parseGeminiJson(content);

    analyticsService.trackAIUsage({
      requestType: 'routine_generate',
      inputText: customRequest || 'auto-generated workout',
      outputData: parsed,
      model: 'gemini-2.5-flash',
    });

    return parsed;
  }

  private generateFallbackWorkout(
    userProfile: UserProfile | null,
    options: GenerateWorkoutOptions
  ): AILoggedWorkoutNote {
    const weightUnit = userProfile?.weightUnitPreference || 'lbs';
    const isMale = userProfile?.gender !== 'female';

    // Base weights in lbs (converted below if needed).
    let baseWeights = isMale
      ? { squat: 135, bench: 135, row: 95, press: 65, curl: 25, extension: 30 }
      : { squat: 65, bench: 65, row: 45, press: 35, curl: 15, extension: 20 };

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

    // Each exercise gets an "Actual" placeholder line below it.
    const noteText = exercises.map(ex => {
      const sets = [];
      for (let i = 0; i < ex.sets; i++) {
        const reps = ex.reps + (i === ex.sets - 1 ? -2 : 0); // slight rep variation for realism
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

  /** AI-derives muscle groups, equipment, category, and description; falls back to defaults. */
  async generateCustomExerciseMetadata(exerciseName: string): Promise<CustomExercise> {
    if (this.GEMINI_API_KEY) {
      try {
        const metadata = await this.callCustomExerciseAI(exerciseName);
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

    const kebabId = exerciseName
      .toLowerCase()
      .replace(/[()]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return this.generateFallbackCustomExercise(exerciseName, kebabId);
  }

  private async callCustomExerciseAI(exerciseName: string): Promise<AICustomExerciseMetadata> {
    const startTime = Date.now();
    const prompt = buildCustomExercisePrompt({ exerciseName });

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const fullPrompt = `You are a fitness expert. Return only valid JSON for exercise metadata.\n\n${prompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const content = response.text();

    console.log(`[WorkoutGenerator] callCustomExerciseAI took ${Date.now() - startTime}ms`);

    return parseGeminiJson(content);
  }

  private generateFallbackCustomExercise(exerciseName: string, kebabId: string): CustomExercise {
    const nameLower = exerciseName.toLowerCase();

    let equipment: Equipment[] = ['bodyweight'];
    if (nameLower.includes('barbell') || nameLower.includes('bar ')) equipment = ['barbell'];
    else if (nameLower.includes('dumbbell') || nameLower.includes('db ')) equipment = ['dumbbell'];
    else if (nameLower.includes('smith machine') || nameLower.includes('smith-machine')) equipment = ['smith-machine'];
    else if (nameLower.includes('machine')) equipment = ['machine'];
    else if (nameLower.includes('cable')) equipment = ['cable'];
    else if (nameLower.includes('kettlebell') || nameLower.includes('kb ')) equipment = ['kettlebell'];

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
