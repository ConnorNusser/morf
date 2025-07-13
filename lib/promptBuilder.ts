import { WorkoutContext, WorkoutSplit } from '@/types';
import { getStrengthLevelName } from './strengthStandards';
import { analyzeAutoWorkoutFocus, analyzeSelectedSplitWeaknesses, calculateOverallPercentile } from './utils';
import { getAvailableWorkouts, getWorkoutById } from './workouts';
import workouts from './workouts.json';
import { POWERLIFTING_WORKOUT_TEMPLATES, PRIMARY_POWERLIFTING_LIFTS } from './workoutTemplates';

export interface WorkoutAnalysis {
  recentExerciseIds: string[];
  overallPercentile: number;
  strengthLevel: string;
  // For auto-generated workouts
  autoFocus?: {
    recommendedSplit: WorkoutSplit;
    reasoning: string;
    muscleGroupGaps: string[];
  };
  // For user-selected splits
  splitWeaknesses?: {
    weakerAreas: string[];
    progressionAnalysis: string[];
    progressionIssues: string[];
  };
}

interface RecentAnalysis {
  name: string;
  primaryMuscles: string[];
  count: number;
}

export class PromptBuilder {
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

  async buildPrompt(context: WorkoutContext, analysis: WorkoutAnalysis, customRequest?: string, workoutTypeOverride?: WorkoutSplit): Promise<string> {
    const { userProfile, userProgress, availableEquipment, workoutHistory, preferences } = context;

    let workoutExamples;
    
    const percentiles = userProgress.map(p => p.percentileRanking);
    const overallPercentile = calculateOverallPercentile(percentiles);
    const availableWorkouts = getAvailableWorkouts(overallPercentile);
    
    const recommendedWorkoutType = workoutTypeOverride || this.selectWorkoutType(analysis, userProgress);
    
    let template = POWERLIFTING_WORKOUT_TEMPLATES[recommendedWorkoutType as keyof typeof POWERLIFTING_WORKOUT_TEMPLATES];

    let filteredWorkouts = availableWorkouts.filter(workout => {
      const equipmentMatch = workout.equipment && workout.equipment.some(eq => availableEquipment && availableEquipment.includes(eq));
      const muscleMatch = workout.primaryMuscles && workout.primaryMuscles.some(muscle => template.primaryMuscles && template.primaryMuscles.includes(muscle));      
      return equipmentMatch && muscleMatch;
    });
    
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

    const strengthLevel = getStrengthLevelName(overallPercentile);

    if (workoutTypeOverride) {
      workoutExamples = workouts.filter((w: any) => w.split === workoutTypeOverride);
    }

    let recentAnalysis: Record<string, RecentAnalysis> = { };
    for (const lift of analysis.recentExerciseIds) {
      const liftData = getWorkoutById(lift);
      if (liftData && recentAnalysis[lift]) {
        recentAnalysis[lift].count++;
      } else if (liftData) {
        recentAnalysis[lift] = {
          name: liftData?.name,
          primaryMuscles: liftData?.primaryMuscles,
          count: 1,
        };
      }
    }

    // Build the analysis section based on whether it's auto-generated or user-selected
    let analysisSection = '';
    if (analysis.autoFocus) {
      analysisSection = `
POWERLIFTING FOCUS ANALYSIS (Auto-Generated):
${analysis.autoFocus.reasoning}
${analysis.autoFocus.muscleGroupGaps.length > 0 ? `Priority gaps: ${analysis.autoFocus.muscleGroupGaps.join(', ')}` : 'No significant training gaps'}
Recent exercises (avoid overuse): ${analysis.recentExerciseIds.join(', ') || 'None'}`;
    } else if (analysis.splitWeaknesses) {
      analysisSection = `
POWERLIFTING FOCUS ANALYSIS (${recommendedWorkoutType.toUpperCase()} Split):
Exercise progression over 21 days: ${analysis.splitWeaknesses.progressionAnalysis.length > 0 ? analysis.splitWeaknesses.progressionAnalysis.join(', ') : 'No recent data'}
${analysis.splitWeaknesses.progressionIssues.length > 0 ? `Issues requiring attention: ${analysis.splitWeaknesses.progressionIssues.join(', ')}` : 'All exercises progressing well'}
${analysis.splitWeaknesses.weakerAreas.length > 0 ? `Focus areas: ${analysis.splitWeaknesses.weakerAreas.join(', ')}` : 'No specific weak areas identified'}
Recent exercises (avoid overuse): ${analysis.recentExerciseIds.join(', ') || 'None'}`;
    }

    return `    
You are an expert powerlifting coach with competition experience designing training programs.

CLIENT PROFILE:
- Gender: ${userProfile.gender}
- Powerlifting Strength Level: ${strengthLevel} (${overallPercentile}th percentile)
- Training frequency: Based on recent history
${analysisSection}

${workoutTypeOverride ? `EXAMPLES OF ${workoutTypeOverride.toUpperCase()} WORKOUTS: ${workoutExamples?.map((w: any) => `${w.name} - ${w.notes || 'No description'}, ${w.exercises.map((e: any) => {
  const exerciseData = getWorkoutById(e.id);
  return `${e.id}: ${exerciseData?.name || e.id}`;
}).join(', ')}`).join('\n')}` : ''}

TODAY'S POWERLIFTING FOCUS: "${recommendedWorkoutType}"
${template.description}
Powerlifting emphasis: ${template.powerliftingFocus}

MANDATORY: ALWAYS include at least ONE of these primary powerlifting lifts:
${availablePrimaryLifts.map(w => `${w.id}: ${w.name}`).join('\n')}

REQUIRED LIFTS for this session (must include at least one):
${requiredLifts.map(w => `${w.id}: ${w.name} - ${template?.powerliftingFocus || 'Strength training'}`).join('\n')}

ALL AVAILABLE EXERCISES (use ONLY these IDs):
${filteredWorkouts.map(w => `${w.id}: ${w.name} (${w.primaryMuscles.join(', ')}) - ${w.category}`).join('\n')}

POWERLIFTING COACH INSTRUCTIONS:
1. MANDATORY: Include at least 1 primary powerlifting lift (squat, bench-press, deadlift, or overhead-press)
2. Design a ${recommendedWorkoutType.toLowerCase()} workout targeting: ${template?.focusAreas?.join(', ') || 'full body'}
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

CRITICAL: Return ONLY the JSON object below. No markdown, no code blocks, no explanations, no other text. Start with { and end with }:

{
"title":"A workout title based on the time of day, day of the week and the type of body workout eg. 'Tuesday Legs' or 'Friday Push' or 'Saturday is for the boys benching' or 'Monday is for the girls' or 'Weekend Warriors hate legs'",
"description":"[2-3 sentence description emphasizing powerlifting benefits and competition lift carryover]",
"exercises":[{"id":"squat","sets":3,"reps":"4"}, {"id":"leg-press","sets":4,"reps":"8"}, {"id":"exercise-id","sets":3,"reps":"4"}, {"id":"exercise-id","sets":3,"reps":"4"}],
"estimatedDuration": 96,
"difficulty":"${strengthLevel}"}`;
  }
}

export const promptBuilder = new PromptBuilder(); 