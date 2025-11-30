import { GeneratedWorkout, WorkoutAnalysis, WorkoutContext, WorkoutSplit } from '@/types';
import { getStrengthLevelName } from '../strengthStandards';
import { calculateOverallPercentile } from '../utils';
import { getAvailableWorkouts } from '../workouts';
import { PromptStrategy } from './powerlifting';

export class BodyweightPromptStrategy implements PromptStrategy {
  async buildPrompt(context: WorkoutContext, analysis: WorkoutAnalysis, customRequest?: string, workoutTypeOverride?: WorkoutSplit, previousWorkout?: GeneratedWorkout): Promise<string> {
    const { userProfile, userProgress, workoutHistory, customExercises = [] } = context;

    const percentiles = userProgress.map(p => p.percentileRanking);
    const overallPercentile = calculateOverallPercentile(percentiles);

    const availableWorkouts = getAvailableWorkouts(overallPercentile);
    
    const recommendedWorkoutType = workoutTypeOverride || this.selectWorkoutType(analysis);
    
    let filteredWorkouts = availableWorkouts.filter(workout => {
      return workout.equipment && (
        workout.equipment.includes('bodyweight') ||
        workout.equipment.includes('dumbbell') ||
        workout.equipment.includes('kettlebell')
      );
    });
    
    filteredWorkouts = filteredWorkouts.sort((a, b) => {
      const aBodyweight = a.equipment.includes('bodyweight') ? 1 : 0;
      const bBodyweight = b.equipment.includes('bodyweight') ? 1 : 0;
      return bBodyweight - aBodyweight; // Bodyweight exercises first
    });

    const strengthLevel = getStrengthLevelName(overallPercentile);
    
    // Build the analysis section
    let analysisSection = '';
    if (analysis.autoFocus) {
      analysisSection = `
BODYWEIGHT TRAINING ANALYSIS (Auto-Generated):
${analysis.autoFocus.reasoning}
${analysis.autoFocus.muscleGroupGaps.length > 0 ? `Priority gaps: ${analysis.autoFocus.muscleGroupGaps.join(', ')}` : 'No significant training gaps'}
Recent exercises (avoid overuse): ${analysis.recentExerciseIds.join(', ') || 'None'}`;
    } else if (analysis.splitWeaknesses) {
      analysisSection = `
BODYWEIGHT TRAINING ANALYSIS (${recommendedWorkoutType.toUpperCase()} Split):
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

    return `    
You are an expert calisthenics and bodyweight training coach specializing in minimal equipment workouts.

CLIENT PROFILE:
- Gender: ${userProfile.gender}
- Fitness Level: ${strengthLevel} (${overallPercentile}th percentile)
- Training focus: Bodyweight/Calisthenics movements
- Equipment: Minimal (bodyweight, basic dumbbells, resistance bands)
${analysisSection}
${previousWorkoutSection}

TODAY'S BODYWEIGHT FOCUS: "${recommendedWorkoutType}"
Focus on functional movement patterns, progressive overload through variations, and skill development.

ALL AVAILABLE EXERCISES (use ONLY these IDs):
${filteredWorkouts.map(w => `${w.id}: ${w.name} (${w.primaryMuscles.join(', ')}) - ${w.category} - Equipment: ${w.equipment.join(', ')}`).join('\n')}
${customExercises.length > 0 ? `\nUSER'S CUSTOM EXERCISES (prefer these when relevant):\n${customExercises.map(e => `${e.id}: ${e.name} (custom)`).join('\n')}` : ''}

BODYWEIGHT TRAINING INSTRUCTIONS:
1. Prioritize compound movements and functional patterns
2. Design a ${recommendedWorkoutType.toLowerCase()} workout with progressive difficulty
3. Include skill-based movements when appropriate (handstands, muscle-ups, etc.)
4. Structure: Warm-up movements → Compound patterns → Isolation/Skills → Core
5. Volume: 3-4 sets for beginners, 4-6 sets for advanced
6. Rep ranges: Strength (3-8), Hypertrophy (8-15), Endurance (15+)
7. Focus on time under tension and movement quality
8. Include progressions and regressions for scalability
9. Given an exact number for sets and reps, do not use a range
10. Include between 4 and 8 exercises for the workout
11. Balance pushing and pulling movements
12. CRITICAL: For estimatedDuration, calculate as exercises.length * 10 (bodyweight workouts are typically faster)

${customRequest ? `SPECIAL BODYWEIGHT REQUEST: ${customRequest}` : ''}

The time is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

CRITICAL: Return ONLY the JSON object below. No markdown, no code blocks, no explanations, no other text. Start with { and end with }:

{
"title":"A bodyweight workout title based on the time of day and movement focus eg. 'Morning Flow Push' or 'Evening Calisthenics' or 'Lunchtime Bodyweight Blast' or 'Weekend Warrior Moves'",
"description":"[2-3 sentence description emphasizing functional movement, bodyweight progression, and minimal equipment benefits]",
"exercises":[{"id":"push-up","sets":3,"reps":"12"}, {"id":"bodyweight-squat","sets":4,"reps":"15"}, {"id":"exercise-id","sets":3,"reps":"10"}, {"id":"exercise-id","sets":3,"reps":"8"}],
"estimatedDuration": 40,
"difficulty":"${strengthLevel}"}`;
  }

  private selectWorkoutType(analysis: WorkoutAnalysis): string {
    // If we have auto-focus analysis, use its recommendation
    if (analysis.autoFocus) {
      return analysis.autoFocus.recommendedSplit;
    }

    // Bodyweight-focused workout types
    const bodyweightSplits = [
      'push',
      'pull', 
      'legs',
      'full-body',
      'calisthenics',
      'upper-body',
      'lower-body'
    ];

    return bodyweightSplits[Math.floor(Math.random() * bodyweightSplits.length)];
  }
} 