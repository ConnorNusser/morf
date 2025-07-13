import {
  ExerciseSet,
  GeneratedWorkout,
  Workout,
  WorkoutContext,
  WorkoutExerciseSession,
  WorkoutSplit
} from '@/types';
import OpenAI from 'openai';
import { promptBuilder } from './promptBuilder';
import { getStrengthLevelName } from './strengthStandards';
import { calculateOverallPercentile } from './utils';
import { getAvailableWorkouts, getWorkoutById } from './workouts';
import { POWERLIFTING_EXERCISE_PRIORITY, POWERLIFTING_WORKOUT_TEMPLATES, PRIMARY_POWERLIFTING_LIFTS } from './workoutTemplates';
import { ValidationResult, workoutValidator } from './workoutValidator';

class AIWorkoutService {
  private readonly AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;
  private readonly MAX_RETRY_ATTEMPTS = 2;
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: this.AI_API_KEY,
    });
  }

  async generateWorkout(context: WorkoutContext, customRequest?: string, workoutType?: WorkoutSplit): Promise<GeneratedWorkout> {
    if (!this.AI_API_KEY) {
      return await this.generateFallback(context);
    }

    const analysis = await promptBuilder.analyzeWorkoutHistory(context.workoutHistory, getWorkoutById.bind(this), workoutType);
    
    const percentiles = context.userProgress.map(p => p.percentileRanking);
    const overallPercentile = calculateOverallPercentile(percentiles);
    analysis.overallPercentile = overallPercentile;
    analysis.strengthLevel = overallPercentile >= 75 ? 'Advanced' : 
                            overallPercentile >= 50 ? 'Intermediate' : 
                            overallPercentile >= 25 ? 'Novice' : 'Beginner';

    let attempts = 0;

    while (attempts <= this.MAX_RETRY_ATTEMPTS) {
      try {
        const prompt = await promptBuilder.buildPrompt(context, analysis, customRequest, workoutType);
        const workout = await this.callAIAPI(prompt);
        const validationResult = workoutValidator.validate(workout, getWorkoutById.bind(this));
        if (validationResult.isValid) {
          return workout;
        }

        if (attempts < this.MAX_RETRY_ATTEMPTS) {
          const lastPrompt = workoutValidator.generateFeedbackPrompt(workout, validationResult, prompt);
          attempts++;
          continue;
        }
        return await this.generateFallback(context);

      } catch (error) {
        attempts++;
        
        if (attempts > this.MAX_RETRY_ATTEMPTS) {
          return await this.generateFallback(context);
        }
      }
    }

    return await this.generateFallback(context);
  }

  private async callAIAPI(prompt: string): Promise<GeneratedWorkout> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a powerlifting coach. You MUST return ONLY valid JSON for workout generation. Do not use markdown, code blocks, backticks, or any other formatting. Your response must start with { and end with }. Return raw JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      throw new Error('No content received from API');
    }
    const result = JSON.parse(messageContent);
    
    // Convert exercises to proper format
    const exercises: WorkoutExerciseSession[] = (result.exercises || []).map((exercise: ExerciseSet) => ({
      ...exercise,
      completedSets: [],
      isCompleted: false,
    }));
    
    return {
      id: `powerlifting_workout_${Date.now()}`,
      ...result,
      exercises,
      createdAt: new Date(),
    };
  }

  private async generateFallback(context: WorkoutContext): Promise<GeneratedWorkout> {
    
    const { userProgress, availableEquipment, preferences, workoutHistory } = context;
    
    const percentiles = userProgress.map(p => p.percentileRanking);
    const overallPercentile = calculateOverallPercentile(percentiles);
    
    const analysis = await promptBuilder.analyzeWorkoutHistory(workoutHistory, getWorkoutById.bind(this));
    const recommendedWorkoutType = promptBuilder.selectWorkoutType(analysis, userProgress);
    const template = POWERLIFTING_WORKOUT_TEMPLATES[recommendedWorkoutType as keyof typeof POWERLIFTING_WORKOUT_TEMPLATES];
    
    let workouts = getAvailableWorkouts(overallPercentile);
    
    // Filter by equipment and muscle groups
    workouts = workouts.filter(w => 
      w.equipment && w.equipment.some(eq => availableEquipment.includes(eq)) &&
      w.primaryMuscles && w.primaryMuscles.some(muscle => template.primaryMuscles.includes(muscle))
    );
    
    if (preferences.excludeBodyweight) {
      workouts = workouts.filter(w => w.equipment && !w.equipment.includes('bodyweight'));
    }

    const availablePrimaryLifts = workouts.filter(w => PRIMARY_POWERLIFTING_LIFTS.includes(w.id));
    const requiredLifts = workouts.filter(w => template.requiredPrimaryLifts.includes(w.id));
    
    let selectedWorkouts: Workout[] = [];
    
    if (requiredLifts.length > 0) {
      selectedWorkouts.push(requiredLifts[0]);
    } else if (availablePrimaryLifts.length > 0) {
      selectedWorkouts.push(availablePrimaryLifts[0]);
    } else {
      const allWorkouts = getAvailableWorkouts(100);
      const emergencyPrimaryLift = allWorkouts.find(w => 
        PRIMARY_POWERLIFTING_LIFTS.includes(w.id) &&
        w.equipment && w.equipment.some(eq => availableEquipment.includes(eq))
      );
      if (emergencyPrimaryLift) {
        selectedWorkouts.push(emergencyPrimaryLift);
      }
    }
    
    const compoundWorkouts = workouts.filter(w => 
      w.category === 'compound' && 
      !selectedWorkouts.includes(w) &&
      POWERLIFTING_EXERCISE_PRIORITY.secondary.includes(w.id)
    );
    
    selectedWorkouts.push(...compoundWorkouts.slice(0, 2));
    
    if (selectedWorkouts.length < 4) {
      const remainingCompound = workouts.filter(w => 
        w.category === 'compound' && !selectedWorkouts.includes(w)
      );
      const toAdd = remainingCompound.slice(0, 4 - selectedWorkouts.length);
      selectedWorkouts.push(...toAdd);
    }
    
    if (selectedWorkouts.length < 6) {
      const isolationWorkouts = workouts.filter(w => 
        w.category === 'isolation' && !selectedWorkouts.includes(w)
      );
      const isolationToAdd = isolationWorkouts.slice(0, 6 - selectedWorkouts.length);
      selectedWorkouts.push(...isolationToAdd);
    }
    
    if (selectedWorkouts.length < 4) {
      const allAvailableWorkouts = getAvailableWorkouts(100).filter(w => 
        w.equipment && w.equipment.some(eq => availableEquipment.includes(eq)) &&
        !selectedWorkouts.includes(w)
      );
      const emergencyExercises = allAvailableWorkouts.slice(0, 4 - selectedWorkouts.length);
      selectedWorkouts.push(...emergencyExercises);
    }
    
    selectedWorkouts = selectedWorkouts.slice(0, 6);
    
    const exercises: WorkoutExerciseSession[] = selectedWorkouts.map(w => {
      const isPrimaryLift = PRIMARY_POWERLIFTING_LIFTS.includes(w.id);
      const isSecondaryLift = POWERLIFTING_EXERCISE_PRIORITY.secondary.includes(w.id);
      
      return {
        id: w.id,
        sets: isPrimaryLift ? 4 : isSecondaryLift ? 3 : 3,
        reps: isPrimaryLift ? '3-6' : w.category === 'compound' ? '6-10' : '8-12',
        completedSets: [],
        isCompleted: false,
      };
    });

    const strengthLevel = getStrengthLevelName(overallPercentile);

    const fallbackWorkout = {
      id: `powerlifting_fallback_${Date.now()}`,
      title: `${recommendedWorkoutType} Powerlifting Workout`,
      description: `${template.description} Focus: ${template.powerliftingFocus}. Designed to improve competition performance and build strength in the main powerlifting movements.`,
      exercises,
      estimatedDuration: exercises.length * 10 + 15,
      difficulty: strengthLevel,
      createdAt: new Date(),
    };
    
    // Validate the fallback workout
    const validation = workoutValidator.validate(fallbackWorkout, getWorkoutById.bind(this));
    console.log(`🔍 Fallback validation: Score ${validation.score}/100, Valid: ${validation.isValid}`);
    
    if (!validation.isValid) {
      console.error('❌ CRITICAL: Even fallback workout failed validation!', validation.criticalIssues);
    }
    
    return fallbackWorkout;
  }

  // Helper method to validate a workout (useful for testing)
  validateWorkout(workout: GeneratedWorkout): ValidationResult {
    return workoutValidator.validate(workout, getWorkoutById.bind(this));
  }
}

export const aiWorkoutService = new AIWorkoutService(); 