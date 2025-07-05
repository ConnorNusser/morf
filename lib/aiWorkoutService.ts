import {
  ExerciseSet,
  GeneratedWorkout,
  Workout,
  WorkoutContext,
  WorkoutExerciseSession
} from '@/types';
import { promptBuilder } from './promptBuilder';
import { calculateOverallPercentile } from './utils';
import { getAvailableWorkouts, getWorkoutById } from './workouts';
import { POWERLIFTING_EXERCISE_PRIORITY, POWERLIFTING_WORKOUT_TEMPLATES, PRIMARY_POWERLIFTING_LIFTS } from './workoutTemplates';
import { ValidationResult, workoutValidator } from './workoutValidator';

class AIWorkoutService {
  private readonly AI_API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;
  private readonly MAX_RETRY_ATTEMPTS = 2;

  async generateWorkout(context: WorkoutContext, customRequest?: string, workoutType?: string): Promise<GeneratedWorkout> {
    if (!this.AI_API_KEY) {
      return this.generateFallback(context);
    }

    const analysis = promptBuilder.analyzeWorkoutHistory(context.workoutHistory, getWorkoutById.bind(this));
    
    const percentiles = context.userProgress.map(p => p.percentileRanking);
    const overallPercentile = calculateOverallPercentile(percentiles);
    analysis.overallPercentile = overallPercentile;
    analysis.strengthLevel = overallPercentile >= 75 ? 'Advanced' : 
                            overallPercentile >= 50 ? 'Intermediate' : 
                            overallPercentile >= 25 ? 'Novice' : 'Beginner';

    let lastPrompt = '';
    let attempts = 0;

    while (attempts <= this.MAX_RETRY_ATTEMPTS) {
      try {
        const prompt = attempts === 0 
          ? promptBuilder.buildPrompt(context, analysis, customRequest, workoutType)
          : lastPrompt;
        console.log('🔍 Prompt:', prompt);
        const workout = await this.callAIAPI(prompt);
        console.log('🔍 Workout:', workout);
        const validationResult = workoutValidator.validate(workout, getWorkoutById.bind(this));
        
        if (validationResult.isValid) {
          return workout;
        }

        if (attempts < this.MAX_RETRY_ATTEMPTS) {
          lastPrompt = workoutValidator.generateFeedbackPrompt(workout, validationResult, prompt);
          attempts++;
          continue;
        }
        return this.generateFallback(context);

      } catch (error) {
        console.error(`AI generation attempt ${attempts + 1} failed:`, error);
        attempts++;
        
        if (attempts > this.MAX_RETRY_ATTEMPTS) {
          return this.generateFallback(context);
        }
      }
    }

    return this.generateFallback(context);
  }

  private async callAIAPI(prompt: string): Promise<GeneratedWorkout> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a powerlifting coach. Return only valid JSON for workout generation.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    const result = JSON.parse(data.choices[0]?.message?.content || '{}');
    
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

  private generateFallback(context: WorkoutContext): GeneratedWorkout {
    console.log('🔄 Generating fallback powerlifting workout...');
    
    const { userProgress, availableEquipment, preferences, workoutHistory } = context;
    
    const percentiles = userProgress.map(p => p.percentileRanking);
    const overallPercentile = calculateOverallPercentile(percentiles);
    
    const analysis = promptBuilder.analyzeWorkoutHistory(workoutHistory, getWorkoutById.bind(this));
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
      console.log(`✅ Added required lift: ${requiredLifts[0].id}`);
    } else if (availablePrimaryLifts.length > 0) {
      selectedWorkouts.push(availablePrimaryLifts[0]);
      console.log(`✅ Added primary lift: ${availablePrimaryLifts[0].id}`);
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

    const strengthLevel = overallPercentile >= 75 ? 'Advanced' : 
                         overallPercentile >= 50 ? 'Intermediate' : 
                         overallPercentile >= 25 ? 'Novice' : 'Beginner';

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