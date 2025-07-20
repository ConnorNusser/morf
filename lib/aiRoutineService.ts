import { RoutineCreationData } from '@/components/routine/CreateRoutineFlow';
import { GeneratedWorkout, Routine, WorkoutContext } from '@/types';
import OpenAI from 'openai';
import { DAY_NAMES_INTERNAL } from './day';
import { routinePromptBuilder } from './routinePromptBuilder';

class AIRoutineService {
  private readonly AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;
  private readonly MAX_RETRY_ATTEMPTS = 2;
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.AI_API_KEY,
    });
  }

  async generateRoutine(
    context: WorkoutContext,
    routineData: RoutineCreationData
  ): Promise<Routine> {
    if (!this.AI_API_KEY) {
      throw new Error('AI API key not configured');
    }

    let attempts = 0;

    while (attempts <= this.MAX_RETRY_ATTEMPTS) {
      try {
        const prompt = await routinePromptBuilder.buildRoutinePrompt(context, routineData);
        const workouts = await this.callAIAPI(prompt);
        
        const routine: Routine = {
          id: `routine-${Date.now()}`,
          name: `${routineData.trainingStyle || 'Custom'} ${routineData.daysPerWeek}-Day Routine`,
          description: this.generateRoutineDescription(routineData),
          exercises: workouts,
          createdAt: new Date(),
        };

        return routine;

      } catch (error) {
        attempts++;
        
        if (attempts > this.MAX_RETRY_ATTEMPTS) {
          throw new Error('Failed to generate routine after multiple attempts');
        }
      }
    }

    throw new Error('Failed to generate routine');
  }

  private async callAIAPI(prompt: string): Promise<GeneratedWorkout[]> {

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional fitness coach. Return only valid JSON arrays of workout objects. Do not include any explanatory text before or after the JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from AI API');
    }

    const cleanContent = content.trim().replace(/```json\s*|\s*```/g, '');
    
    try {
      const workouts = JSON.parse(cleanContent);
      
      if (!Array.isArray(workouts)) {
        throw new Error('AI response is not an array');
      }

      return workouts.map((workout: any, index: number) => {
        return {
          id: workout.id || `routine-workout-${index + 1}`,
          title: workout.title || `Day ${index + 1}`,
          description: workout.description || 'Workout description',
          dayOfWeek: workout.dayOfWeek || DAY_NAMES_INTERNAL[index % 7],
          exercises: this.validateExercises(workout.exercises || []),
          estimatedDuration: workout.estimatedDuration || 60,
          difficulty: workout.difficulty || 'Intermediate',
          createdAt: new Date(),
        };
      });

    } catch (parseError) {
      throw new Error('Invalid JSON response from AI');
    }
  }

  private validateExercises(exercises: any[]): any[] {
    return exercises.map((exercise: any, index: number) => ({
      id: exercise.id || `exercise-${index + 1}`,
      sets: exercise.sets || 3,
      reps: exercise.reps || '8-12',
      rest: exercise.rest || 60,
      notes: exercise.notes || '',
      completedSets: [],
      isCompleted: false,
    }));
  }

  private generateRoutineDescription(routineData: RoutineCreationData): string {
    const parts = [];
    
    parts.push(`${routineData.daysPerWeek}-day ${routineData.trainingStyle || 'general'} routine`);
    
    if (routineData.workoutDuration) {
      parts.push(`${routineData.workoutDuration} minutes per session`);
    }
    
    if (routineData.muscleGroupFocus.length > 0) {
      parts.push(`focusing on ${routineData.muscleGroupFocus.join(', ')}`);
    }
    
    if (routineData.inspiration.length > 0) {
      parts.push(`inspired by ${routineData.inspiration.join(' and ')} training`);
    }

    return parts.join(', ') + '.';
  }
}

export const aiRoutineService = new AIRoutineService(); 