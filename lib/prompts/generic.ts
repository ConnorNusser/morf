import { GeneratedWorkout, WorkoutAnalysis, WorkoutContext, WorkoutSplit } from '@/types';
import { getStrengthLevelName } from '../strengthStandards';
import { calculateOverallPercentile } from '../utils';
import { getAvailableWorkouts } from '../workouts';
import { PromptStrategy } from './powerlifting';

export class GenericPromptStrategy implements PromptStrategy {
  async buildPrompt(context: WorkoutContext, analysis: WorkoutAnalysis, customRequest?: string, workoutTypeOverride?: WorkoutSplit, previousWorkout?: GeneratedWorkout): Promise<string> {
    const { userProfile, userProgress, workoutHistory, preferences, customExercises = [] } = context;

    const percentiles = userProgress.map(p => p.percentileRanking);
    const overallPercentile = calculateOverallPercentile(percentiles);

    // Get available exercises
    const availableWorkouts = getAvailableWorkouts(overallPercentile);
    
    
    const recommendedWorkoutType = workoutTypeOverride || this.selectWorkoutType(analysis);
    
    // Use all available exercises for general fitness - maximum flexibility
    let filteredWorkouts = [...availableWorkouts];
    
    // If user excludes bodyweight, respect that preference
    if (preferences.excludeBodyweight) {
      filteredWorkouts = filteredWorkouts.filter(w => w.equipment && !w.equipment.includes('bodyweight'));
    }
    
    // Balance exercise types for general fitness
    filteredWorkouts = filteredWorkouts.sort(() => Math.random() - 0.5); // Randomize for variety

    const strengthLevel = getStrengthLevelName(overallPercentile);
    
    // Build the analysis section
    let analysisSection = '';
    if (analysis.autoFocus) {
      analysisSection = `
TRAINING ANALYSIS (Auto-Generated):
${analysis.autoFocus.reasoning}
${analysis.autoFocus.muscleGroupGaps.length > 0 ? `Priority gaps: ${analysis.autoFocus.muscleGroupGaps.join(', ')}` : 'No significant training gaps'}
Recent exercises (avoid overuse): ${analysis.recentExerciseIds.join(', ') || 'None'}`;
    } else if (analysis.splitWeaknesses) {
      analysisSection = `
TRAINING ANALYSIS (${recommendedWorkoutType.toUpperCase()} Split):
Exercise progression over 21 days: ${analysis.splitWeaknesses.progressionAnalysis.length > 0 ? analysis.splitWeaknesses.progressionAnalysis.join(', ') : 'No recent data'}
${analysis.splitWeaknesses.progressionIssues.length > 0 ? `Issues requiring attention: ${analysis.splitWeaknesses.progressionIssues.join(', ')}` : 'All exercises progressing well'}
${analysis.splitWeaknesses.weakerAreas.length > 0 ? `Focus areas: ${analysis.splitWeaknesses.weakerAreas.join(', ')}` : 'No specific weak areas identified'}
Recent exercises (avoid overuse): ${analysis.recentExerciseIds.join(', ') || 'None'}`;
    }

    // Add previous workout information for variation if regenerating
    let previousWorkoutSection = '';
    if (previousWorkout) {
      previousWorkoutSection = `
PREVIOUS WORKOUT (for variation reference) usually this means they want to do something different or are unhappy with the last workout, so we need to make sure we don't repeat the same exercises at least part of the time:
Title: ${previousWorkout.title}
Exercises used: ${previousWorkout.exercises.map(ex => ex.id).join(', ')}
IMPORTANT: Create a different workout with variation - use different exercises where possible, different rep ranges, or different training focus while maintaining the same workout type.`;
    }

    // Get equipment summary from available exercises
    const equipmentTypes = [...new Set(filteredWorkouts.flatMap(w => w.equipment))];
    const equipmentSummary = equipmentTypes.length > 0 ? equipmentTypes.join(', ') : 'Various equipment types';

    return `    
You are an experienced personal trainer and fitness coach specializing in comprehensive strength and conditioning programs.

CLIENT PROFILE:
- Gender: ${userProfile.gender}
- Fitness Level: ${strengthLevel} (${overallPercentile}th percentile)
- Available Equipment: ${equipmentSummary}
- Training Style: General fitness and strength development
- Weight Unit Preference: ${userProfile.weightUnitPreference || 'lbs'} (ALWAYS use this unit for all weight suggestions)
${analysisSection}
${previousWorkoutSection}

TODAY'S TRAINING FOCUS: "${recommendedWorkoutType}"
Create a well-rounded workout that balances strength, conditioning, and functional movement patterns.

ALL AVAILABLE EXERCISES (use ONLY these IDs):
${filteredWorkouts.map(w => `${w.id}: ${w.name} (${w.primaryMuscles.join(', ')}) - ${w.category} - Equipment: ${w.equipment.join(', ')}`).join('\n')}
${customExercises.length > 0 ? `\nUSER'S CUSTOM EXERCISES (prefer these when relevant):\n${customExercises.map(e => `${e.id}: ${e.name} (custom)`).join('\n')}` : ''}

GENERAL FITNESS INSTRUCTIONS:
1. Create a balanced workout targeting multiple muscle groups
2. Design a ${recommendedWorkoutType.toLowerCase()} workout with appropriate progression
3. Mix compound and isolation movements as needed
4. Structure: Warm-up → Compound movements → Targeted work → Conditioning/Core
5. Volume: 3-4 sets for most exercises
6. Rep ranges: Strength (4-8), Hypertrophy (8-12), Endurance (12-20)
7. Focus on proper movement patterns and progressive overload
8. Include variety to keep workouts engaging
9. Given an exact number for sets and reps, do not use a range
10. Include between 4 and 8 exercises for the workout
11. Balance muscle groups and movement patterns
12. CRITICAL: For estimatedDuration, calculate as exercises.length * 11 (e.g., 5 exercises = 55, 7 exercises = 77)

${customRequest ? `SPECIAL FITNESS REQUEST: ${customRequest}` : ''}

The time is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

CRITICAL: Return ONLY the JSON object below. No markdown, no code blocks, no explanations, no other text. Start with { and end with }:

{
"title":"A fitness workout title based on the time and focus eg. 'Tuesday Total Body' or 'Morning Strength Session' or 'Lunch Break Burner' or 'Weekend Warrior Workout'",
"description":"[2-3 sentence description emphasizing balanced fitness, strength development, and overall health benefits]",
"exercises":[{"id":"squat","sets":3,"reps":"10"}, {"id":"bench-press","sets":3,"reps":"8"}, {"id":"exercise-id","sets":3,"reps":"12"}, {"id":"exercise-id","sets":3,"reps":"10"}],
"estimatedDuration": 55,
"difficulty":"${strengthLevel}"}`;
  }

  private selectWorkoutType(analysis: WorkoutAnalysis): string {
    // If we have auto-focus analysis, use its recommendation
    if (analysis.autoFocus) {
      return analysis.autoFocus.recommendedSplit;
    }

    // General fitness workout types
    const genericSplits = [
      'full-body',
      'upper-body',
      'lower-body',
      'push',
      'pull', 
      'legs'
    ];

    return genericSplits[Math.floor(Math.random() * genericSplits.length)];
  }
} 