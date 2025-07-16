import { GeneratedWorkout, WorkoutAnalysis, WorkoutContext, WorkoutSplit } from '@/types';
import { BodyweightPromptStrategy } from './prompts/bodyweight';
import { GenericPromptStrategy } from './prompts/generic';
import { PowerliftingPromptStrategy, PromptStrategy } from './prompts/powerlifting';
import { analyzeAutoWorkoutFocus, analyzeSelectedSplitWeaknesses } from './utils';

export type WorkoutPromptType = 'powerlifting' | 'bodyweight' | 'generic';

export class PromptBuilder {
  private promptStrategies: Record<WorkoutPromptType, PromptStrategy> = {
    powerlifting: new PowerliftingPromptStrategy(),
    bodyweight: new BodyweightPromptStrategy(),
    generic: new GenericPromptStrategy(),
  };

  async analyzeWorkoutHistory(workoutHistory: any[], getWorkoutById: (id: string) => any, selectedSplit?: WorkoutSplit): Promise<WorkoutAnalysis> {
    const recentExerciseIds = workoutHistory.slice(-3).flatMap(w => w.exercises.map((e: any) => e.id));

    let autoFocus;
    let splitWeaknesses;

    if (selectedSplit) {
      // User selected a specific split - analyze weaknesses within that split
      splitWeaknesses = await analyzeSelectedSplitWeaknesses(workoutHistory, selectedSplit);
    } else {
      // Auto-generate workout - focus on what was trained longest ago
      autoFocus = await analyzeAutoWorkoutFocus(workoutHistory);
    }

    return { 
      recentExerciseIds,
      overallPercentile: 50, // Will be calculated later
      strengthLevel: 'Intermediate', // Will be calculated later
      autoFocus,
      splitWeaknesses
    };
  }

  selectWorkoutType(analysis: WorkoutAnalysis, userProgress: any[]): string {
    // If we have auto-focus analysis, use its recommendation
    if (analysis.autoFocus) {
      return analysis.autoFocus.recommendedSplit;
    }

    // Fallback to random selection
    const workoutSplits = [
      'push',
      'pull',
      'legs',
      'upper-body',
      'full-body'
    ];

    return workoutSplits[Math.floor(Math.random() * workoutSplits.length)];
  }

  // Determine workout prompt type based on user filter selection
  private determinePromptType(context: WorkoutContext): WorkoutPromptType {
    const { workoutFilters } = context;
    
    // Use the user's explicit workout type selection from filters
    if (workoutFilters?.workoutType) {
      return workoutFilters.workoutType;
    }
    
    // Default to powerlifting if no selection
    return 'powerlifting';
  }

  async buildPrompt(context: WorkoutContext, analysis: WorkoutAnalysis, customRequest?: string, workoutTypeOverride?: WorkoutSplit, previousWorkout?: GeneratedWorkout): Promise<string> {
    // Determine which prompt strategy to use
    const promptType = this.determinePromptType(context);
    const strategy = this.promptStrategies[promptType];
    
    console.log(`🎯 Using ${promptType} prompt strategy`);
    
    // Use the selected strategy to build the prompt
    return await strategy.buildPrompt(context, analysis, customRequest, workoutTypeOverride, previousWorkout);
  }
}

export const promptBuilder = new PromptBuilder(); 