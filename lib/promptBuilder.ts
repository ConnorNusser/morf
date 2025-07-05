import { WorkoutContext } from '@/types';
import { calculateOverallPercentile } from './utils';
import { getAvailableWorkouts } from './workouts';
import { POWERLIFTING_WORKOUT_TEMPLATES, PRIMARY_POWERLIFTING_LIFTS } from './workoutTemplates';

export interface WorkoutAnalysis {
  recentMuscleGroups: string[];
  daysSinceLastWorkout: number;
  workoutFrequency: string;
  recentExerciseIds: string[];
  overallPercentile: number;
  strengthLevel: string;
}

export class PromptBuilder {
  analyzeWorkoutHistory(workoutHistory: any[], getWorkoutById: (id: string) => any): WorkoutAnalysis {
    const recentWorkouts = workoutHistory.slice(-10); // Last 10 workouts
    const recentMuscleGroups: string[] = [];
    
    // Extract muscle groups from recent exercises
    recentWorkouts.forEach(workout => {
      workout.exercises.forEach((exercise: any) => {
        const workoutDetails = getWorkoutById(exercise.id);
        if (workoutDetails && workoutDetails.primaryMuscles) {
          recentMuscleGroups.push(...workoutDetails.primaryMuscles);
        }
      });
    });

    const daysSinceLastWorkout = recentWorkouts.length > 0 
      ? Math.floor((Date.now() - new Date(recentWorkouts[recentWorkouts.length - 1].createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 7;

    const workoutFrequency = recentWorkouts.length >= 6 ? 'high' : 
                           recentWorkouts.length >= 3 ? 'moderate' : 'low';

    const recentExerciseIds = workoutHistory.slice(-3).flatMap(w => w.exercises.map((e: any) => e.id));

    return { 
      recentMuscleGroups, 
      daysSinceLastWorkout, 
      workoutFrequency, 
      recentExerciseIds,
      overallPercentile: 50, // Will be calculated later
      strengthLevel: 'Intermediate' // Will be calculated later
    };
  }

  selectWorkoutType(analysis: WorkoutAnalysis, userProgress: any[]): string {
    const workoutSplits = [
      'Push (Chest, Shoulders, Triceps)',
      'Pull (Back, Biceps)',
      'Legs (Quads, Glutes, Hamstrings)',
      'Full Body',
      'Upper Body',
    ]
    return workoutSplits[Math.floor(Math.random() * workoutSplits.length)];
  }

  buildPrompt(context: WorkoutContext, analysis: WorkoutAnalysis, customRequest?: string, workoutTypeOverride?: string): string {
    const { userProfile, userProgress, availableEquipment, workoutHistory, preferences } = context;
    
    const percentiles = userProgress.map(p => p.percentileRanking);
    const overallPercentile = calculateOverallPercentile(percentiles);
    const availableWorkouts = getAvailableWorkouts(overallPercentile);
    
    const recommendedWorkoutType = workoutTypeOverride || this.selectWorkoutType(analysis, userProgress);
    const template = POWERLIFTING_WORKOUT_TEMPLATES[recommendedWorkoutType as keyof typeof POWERLIFTING_WORKOUT_TEMPLATES];
    
    // Filter workouts based on equipment and focus areas
    let filteredWorkouts = availableWorkouts.filter(workout =>
      workout.equipment && workout.equipment.some(eq => availableEquipment && availableEquipment.includes(eq)) &&
      workout.primaryMuscles && workout.primaryMuscles.some(muscle => template.primaryMuscles && template.primaryMuscles.includes(muscle))
    );
    
    if (preferences.excludeBodyweight) {
      filteredWorkouts = filteredWorkouts.filter(w => w.equipment && !w.equipment.includes('bodyweight'));
    }

    // Ensure primary powerlifting lifts are available
    const availablePrimaryLifts = filteredWorkouts.filter(w => 
      PRIMARY_POWERLIFTING_LIFTS.includes(w.id)
    );

    // Get required lifts for this template
    const requiredLifts = filteredWorkouts.filter(w => 
      template.requiredPrimaryLifts.includes(w.id)
    );

    const strengthLevel = overallPercentile >= 75 ? 'Advanced' : 
                         overallPercentile >= 50 ? 'Intermediate' : 
                         overallPercentile >= 25 ? 'Novice' : 'Beginner';

    return `    
You are an expert powerlifting coach with competition experience designing training programs.

CLIENT PROFILE:
- Gender: ${userProfile.gender}
- Powerlifting Strength Level: ${strengthLevel} (${overallPercentile}th percentile)
- Days since last workout: ${analysis.daysSinceLastWorkout}
- Training frequency: ${analysis.workoutFrequency}

POWERLIFTING ANALYSIS:
Recent muscle groups trained: ${analysis.recentMuscleGroups.join(', ') || 'None'}
Recent exercises (avoid overuse): ${analysis.recentExerciseIds.join(', ') || 'None'}

TODAY'S POWERLIFTING FOCUS: "${recommendedWorkoutType}"
${template.description}
Powerlifting emphasis: ${template.powerliftingFocus}

MANDATORY: ALWAYS include at least ONE of these primary powerlifting lifts:
${availablePrimaryLifts.map(w => `${w.id}: ${w.name}`).join('\n')}

REQUIRED LIFTS for this session (must include at least one):
${requiredLifts.map(w => `${w.id}: ${w.name} - ${template.powerliftingFocus}`).join('\n')}

ALL AVAILABLE EXERCISES (use ONLY these IDs):
${filteredWorkouts.map(w => `${w.id}: ${w.name} (${w.primaryMuscles.join(', ')}) - ${w.category}`).join('\n')}

POWERLIFTING COACH INSTRUCTIONS:
1. MANDATORY: Include at least 1 primary powerlifting lift (squat, bench-press, deadlift, or overhead-press)
2. Design a ${recommendedWorkoutType.toLowerCase()} workout targeting: ${template.focusAreas.join(', ')}
3. Prioritize compound movements that support powerlifting performance
4. Structure: Primary lift → Competition support → Accessories
5. Volume for powerlifting: 3-5 sets
6. Rep ranges: Competition lifts (1-8), Support lifts (6-12), Accessories (8-15)
7. Focus on movements that carry over to competition lifts
8. Consider powerlifting-specific progression and periodization
9. Given an exact number for sets and reps, do not use a range
10. Include between 4 and 7 exercises for the workout, this should also determine how long the duration is, note the number of exercises should be completely random
11. Make sure to have exercises be correlary to each other, and make sense when picking out a workout plan for our client
12. CRITICAL: For estimatedDuration, calculate as exercises.length * 12 (e.g., 4 exercises = 48, 6 exercises = 72, 8 exercises = 96)

${customRequest ? `SPECIAL POWERLIFTING REQUEST: ${customRequest}` : ''}

The time is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

Return ONLY valid JSON:
{
"title":"A workout title based on the time of day, day of the week and the type of body workout eg. 'Tuesday Legs' or 'Friday Push' or 'Saturday is for the boys benching' or 'Monday is for the girls' or 'Weekend Warriors hate legs'",
"description":"[2-3 sentence description emphasizing powerlifting benefits and competition lift carryover]",
"exercises":[{"id":"squat","sets":3,"reps":"4"}, {"id":"leg-press","sets":4,"reps":"8"}, {"id":"exercise-id","sets":3,"reps":"4"}, {"id":"exercise-id","sets":3,"reps":"4"}],
"estimatedDuration": 96,
"difficulty":"${strengthLevel}"}`;
  }
}

export const promptBuilder = new PromptBuilder(); 