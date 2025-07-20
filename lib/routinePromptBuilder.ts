import { RoutineCreationData } from '@/components/routine/CreateRoutineFlow';
import { WorkoutContext } from '@/types';
import { DefaultRoutinePromptStrategy, RoutinePromptStrategy } from './prompts/routine';

export type RoutinePromptType = 'powerlifting' | 'bodybuilding' | 'general' | 'athletic' | 'functional' | 'bodyweight';

export class RoutinePromptBuilder {
  private promptStrategies: Record<string, RoutinePromptStrategy> = {
    powerlifting: new DefaultRoutinePromptStrategy(),
    bodybuilding: new DefaultRoutinePromptStrategy(),
    general: new DefaultRoutinePromptStrategy(),
    athletic: new DefaultRoutinePromptStrategy(),
    functional: new DefaultRoutinePromptStrategy(),
    bodyweight: new DefaultRoutinePromptStrategy(),
  };

  async buildRoutinePrompt(
    context: WorkoutContext,
    routineData: RoutineCreationData
  ): Promise<string> {
    const trainingStyle = routineData.trainingStyle || 'general';
    const strategy = this.promptStrategies[trainingStyle] || this.promptStrategies.general;
    
    return await strategy.buildRoutinePrompt(context, routineData);
  }
}





export const routinePromptBuilder = new RoutinePromptBuilder(); 