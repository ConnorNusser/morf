import { CustomExercise, GeneratedWorkout, UserProfile } from '@/types';
import OpenAI from 'openai';
import { storageService } from './storage';
import { userService } from './userService';
import { getAvailableWorkouts, getWorkoutById } from './workouts';

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

    // Get available exercises
    const availableExercises = getAvailableWorkouts(100);
    const exerciseNames = availableExercises.map(e => e.name);
    const customExerciseNames = customExercises.map(e => e.name);
    const allExerciseNames = [...exerciseNames, ...customExerciseNames];

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

AVAILABLE EXERCISES:
${allExerciseNames.join(', ')}

INSTRUCTIONS:
1. Understand what the user wants to change or know
2. Update the plan if they request changes (add/remove exercises, adjust weights/reps, swap exercises)
3. Keep the same format: "Exercise Name WeightxReps, WeightxReps" with blank lines between exercises
4. Provide a brief, helpful response explaining what you changed or answering their question
5. Suggest 1-2 follow-up questions if relevant

CRITICAL - EQUIPMENT CONSTRAINTS:
- If the user specifies equipment (e.g., "dumbbells only", "barbell and dumbbells", "no machines", "bodyweight only"), you MUST ONLY include exercises that use that equipment
- Never suggest cable machines, machines, or other equipment the user didn't mention having access to
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

    // Get available exercises from database
    const availableExercises = getAvailableWorkouts(100);
    const exerciseNames = availableExercises.map(e => e.name);

    // Add custom exercises to the list
    const customExerciseNames = customExercises.map(e => e.name);
    const allExerciseNames = [...exerciseNames, ...customExerciseNames];

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

CRITICAL - EQUIPMENT CONSTRAINTS:
- If the user specifies equipment (e.g., "dumbbells only", "barbell and dumbbells", "no machines", "bodyweight only"), you MUST ONLY include exercises that use that equipment
- Never suggest cable machines, machines, or other equipment the user didn't mention having access to
- Common equipment mappings:
  * "dumbbells only" = dumbbell exercises only (DB press, DB rows, DB curls, goblet squats, lunges, etc.)
  * "barbell only" = barbell exercises only (bench, squat, deadlift, rows, OHP, etc.)
  * "barbell and dumbbells" = only barbell and dumbbell exercises, NO cables or machines
  * "bodyweight" = no equipment (pushups, pullups, dips, bodyweight squats, lunges, etc.)
  * "home gym" = typically dumbbells, maybe a barbell, no cables/machines

EXAMPLES of noteText format (with blank lines between exercises):
"Bench Press 135x10, 145x8, 155x6

Incline Dumbbell Press 40x12, 45x10, 45x10

Cable Fly 30x15, 30x12, 35x10

Tricep Pushdown 50x12, 55x10, 55x10"

NOTE: Separate each exercise with a blank line (double newline).

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

    // Build note text with double newline between exercises for better spacing
    const noteText = exercises.map(ex => {
      const sets = [];
      for (let i = 0; i < ex.sets; i++) {
        // Slight variation in reps for realism
        const reps = ex.reps + (i === ex.sets - 1 ? -2 : 0);
        sets.push(`${ex.suggestedWeight}x${Math.max(reps, 1)}`);
      }
      return `${ex.name} ${sets.join(', ')}`;
    }).join('\n\n');

    return {
      title,
      noteText,
      exercises,
    };
  }
}

export const aiWorkoutGenerator = new AIWorkoutGeneratorService();
