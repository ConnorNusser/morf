import { RoutineCreationData } from '@/components/routine/CreateRoutineFlow';
import { WorkoutContext } from '@/types';
import { getStrengthLevelName } from '../strengthStandards';
import { calculateOverallPercentile } from '../utils';
import { getAvailableWorkouts } from '../workouts';

export interface RoutinePromptStrategy {
  buildRoutinePrompt(
    context: WorkoutContext, 
    routineData: RoutineCreationData
  ): Promise<string>;
}

export class DefaultRoutinePromptStrategy implements RoutinePromptStrategy {
  async buildRoutinePrompt(
    context: WorkoutContext, 
    routineData: RoutineCreationData
  ): Promise<string> {
    const { userProfile, userProgress } = context;
    
    const percentiles = userProgress.map(p => p.percentileRanking);
    const overallPercentile = calculateOverallPercentile(percentiles);
    const strengthLevel = getStrengthLevelName(overallPercentile);
    
    // Get available exercises based on equipment choice
    let availableWorkouts;
    if (routineData.useWorkoutFilters && context.workoutFilters) {
      availableWorkouts = getAvailableWorkouts(overallPercentile, context.workoutFilters);
    } else {
      availableWorkouts = getAvailableWorkouts(overallPercentile);
      if (routineData.equipment) {
        availableWorkouts = this.filterByEquipment(availableWorkouts, routineData.equipment);
      }
    }
    
    const workoutExamples = availableWorkouts.slice(0, 50).map(w => 
      `${w.id}: ${w.name} (${w.primaryMuscles?.join(', ') || 'N/A'}) [${w.equipment?.join(', ') || 'N/A'}]`
    ).join('\n');
    
    return `You are a professional fitness coach creating a personalized ${routineData.daysPerWeek}-day workout routine.

USER PROFILE:
- Age: ${userProfile.age}, Gender: ${userProfile.gender}
- Height: ${userProfile.height.value} ${userProfile.height.unit}, Weight: ${userProfile.weight.value} ${userProfile.weight.unit}
- Strength Level: ${strengthLevel}

ROUTINE SPECIFICATIONS (FOLLOW EXACTLY):
- Days per week: ${routineData.daysPerWeek}
- Training style: ${routineData.trainingStyle}
- Duration per workout: ${routineData.workoutDuration} minutes
- Equipment: ${this.getEquipmentDescription(routineData)}
${this.getMuscleGroupSection(routineData.muscleGroupFocus)}
${this.getInspirationSection(routineData.inspiration)}

TRAINING SPLIT STRATEGY:
${this.generateSplitStrategy(routineData)}

AVAILABLE EXERCISES:
${workoutExamples}

REQUIREMENTS:
1. Create exactly ${routineData.daysPerWeek} distinct workouts
2. Each workout must be approximately ${routineData.workoutDuration} minutes
3. Follow ${routineData.trainingStyle} training principles
4. Use only exercises from the available list above
5. Each workout MUST include a dayOfWeek field ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
${routineData.muscleGroupFocus.length > 0 ? `6. PRIORITIZE these muscle groups: ${routineData.muscleGroupFocus.join(', ')}` : ''}
${this.getInspirationRequirements(routineData.inspiration)}

Return ONLY a valid JSON array of ${routineData.daysPerWeek} workout objects:
[
  {
    "id": "routine-day-1",
    "title": "Day 1: [Descriptive Name]",
    "description": "[Brief focus description]",
    "dayOfWeek": "monday",
    "exercises": [
      {
        "id": "[exercise-id-from-available-list]",
        "sets": 3,
        "reps": "8-12",
        "rest": 60,
        "notes": "[Optional form/technique notes]"
      }
    ],
    "estimatedDuration": ${routineData.workoutDuration},
    "difficulty": "${strengthLevel}"
  }
]`;
  }

  private getEquipmentDescription(routineData: RoutineCreationData): string {
    if (routineData.useWorkoutFilters) {
      return 'Using current workout filter equipment preferences';
    }
    
    const equipmentMap: Record<string, string> = {
      'full-gym': 'Full gym access (barbells, dumbbells, machines, cables)',
      'home-gym': 'Home gym setup (barbells, dumbbells, basic equipment)',
      'basic': 'Basic equipment (dumbbells, resistance bands)',
      'bodyweight': 'Bodyweight only (no equipment)'
    };
    
    return equipmentMap[routineData.equipment || ''] || 'All available equipment';
  }

  private getMuscleGroupSection(muscleGroupFocus: string[]): string {
    if (muscleGroupFocus.length === 0) return '';
    return `- Muscle group priorities: ${muscleGroupFocus.join(', ')} (EMPHASIZE THESE)`;
  }

  private getInspirationSection(inspiration: string[]): string {
    if (inspiration.length === 0) return '';
    return `- Training inspiration: ${inspiration.join(', ')}`;
  }

  private getInspirationRequirements(inspiration: string[]): string {
    if (inspiration.length === 0) return '';
    
    const requirements = inspiration.map(insp => {
      switch (insp) {
        case 'classic-bodybuilding': return 'Focus on aesthetic development, moderate rep ranges';
        case 'mass-building': return 'Emphasize heavy compound movements for maximum size';
        case 'strength-focused': return 'Prioritize low reps (3-6) with heavy weights';
        case 'aesthetic-physique': return 'Balance mass and definition with varied rep ranges';
        case 'science-based': return 'Use evidence-based exercise selection and programming';
        case 'high-intensity': return 'Include high-intensity techniques and challenging sets';
        case 'periodization': return 'Structure workouts with progressive overload patterns';
        case 'functional-strength': return 'Include compound movements and real-world applications';
        case 'powerlifting-focus': return 'Center around squat, bench, deadlift variations';
        case 'varied-training': return 'Include diverse exercises and training methods';
        case 'minimalist': return 'Focus on basic, fundamental movement patterns';
        case 'explosive-power': return 'Include explosive movements and power development';
        default: return '';
      }
    }).filter(req => req !== '');

    return requirements.length > 0 ? `6. INSPIRATION REQUIREMENTS: ${requirements.join('; ')}` : '';
  }

  private generateSplitStrategy(routineData: RoutineCreationData): string {
    const days = routineData.daysPerWeek || 3;
    const style = routineData.trainingStyle || 'general';
    const focus = routineData.muscleGroupFocus;
    
    let baseStrategy = '';
    
    switch (days) {
      case 2:
        baseStrategy = 'Full body workouts hitting all major muscle groups each session';
        break;
      case 3:
        baseStrategy = style === 'powerlifting' 
          ? 'Each day focuses on one main lift (squat/bench/deadlift) plus accessories'
          : 'Push/Pull/Legs or Full Body approach';
        break;
      case 4:
        baseStrategy = 'Upper/Lower split or Push/Pull/Legs + Full Body';
        break;
      case 5:
        baseStrategy = 'Push/Pull/Legs/Upper/Lower or body part specialization';
        break;
      case 6:
        baseStrategy = 'Push/Pull/Legs repeated twice per week';
        break;
      case 7:
        baseStrategy = 'Daily training with varying intensities and recovery days';
        break;
      default:
        baseStrategy = 'Balanced split appropriate for training frequency';
    }
    
    if (focus.length > 0) {
      baseStrategy += `. CRITICAL: Emphasize ${focus.join(', ')} in every applicable workout.`;
    }
    
    return baseStrategy;
  }

  private filterByEquipment(workouts: any[], equipment: string): any[] {
    const equipmentMap: Record<string, string[]> = {
      'full-gym': ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
      'home-gym': ['barbell', 'dumbbell', 'bodyweight'],
      'basic': ['dumbbell', 'bodyweight', 'resistance_band'],
      'bodyweight': ['bodyweight']
    };

    const allowedEquipment = equipmentMap[equipment] || [];
    
    return workouts.filter(workout => 
      workout.equipment && workout.equipment.some((eq: string) => allowedEquipment.includes(eq))
    );
  }
} 