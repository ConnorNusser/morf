import { GeneratedWorkout } from '@/types';
import { PRIMARY_POWERLIFTING_LIFTS } from './workoutTemplates';

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  feedback: string[];
  criticalIssues: string[];
  suggestions: string[];
}

export class WorkoutValidator {
  validate(workout: GeneratedWorkout, getWorkoutById: (id: string) => any): ValidationResult {
    const feedback: string[] = [];
    const criticalIssues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for primary powerlifting lift inclusion (CRITICAL)
    const hasPrimaryLift = workout.exercises.some(ex => 
      PRIMARY_POWERLIFTING_LIFTS.includes(ex.id)
    );
    
    if (!hasPrimaryLift) {
      criticalIssues.push('Missing primary powerlifting lift (squat, bench, deadlift, or overhead press)');
      score -= 40;
    }

    // Check exercise count - increased minimum for comprehensive powerlifting workouts
    if (workout.exercises.length < 4) {
      criticalIssues.push('Too few exercises (minimum 4 for comprehensive powerlifting workout)');
      score -= 25;
    } else if (workout.exercises.length > 7) {
      feedback.push('High exercise count - ensure adequate recovery between sessions');
      score -= 10;
    }

    // Check for balance between compound and isolation
    const exerciseDetails = workout.exercises.map(ex => ({
      exercise: ex,
      details: getWorkoutById(ex.id)
    })).filter(item => item.details);

    const compoundCount = exerciseDetails.filter(item => 
      item.details.category === 'compound'
    ).length;
    
    const isolationCount = exerciseDetails.filter(item => 
      item.details.category === 'isolation'
    ).length;

    if (compoundCount === 0) {
      criticalIssues.push('No compound movements - powerlifting requires compound exercises');
      score -= 30;
    }

    if (compoundCount < isolationCount && workout.exercises.length > 4) {
      feedback.push('Consider prioritizing compound movements over isolation for powerlifting');
      score -= 10;
    }

    // Check rep ranges for powerlifting appropriateness
    const inappropriateReps = workout.exercises.filter(ex => {
      const details = getWorkoutById(ex.id);
      if (!details) return false;
      
      const isPrimaryLift = PRIMARY_POWERLIFTING_LIFTS.includes(ex.id);
      const repsStr = ex.reps.toString();
      const hasHighReps = repsStr.includes('15') || repsStr.includes('20') || repsStr.includes('25');
      
      return isPrimaryLift && hasHighReps;
    });

    if (inappropriateReps.length > 0) {
      feedback.push('Primary lifts should focus on strength rep ranges (1-8 reps) for powerlifting');
      score -= 15;
    }

    // Check for muscle group balance
    const muscleGroups = new Set();
    exerciseDetails.forEach(item => {
      item.details.primaryMuscles.forEach((muscle: string) => muscleGroups.add(muscle));
    });

    if (muscleGroups.size < 2 && workout.exercises.length > 4) {
      feedback.push('Consider adding variety in muscle groups targeted');
      score -= 10;
    }

    // Check for appropriate progression structure
    const primaryLifts = exerciseDetails.filter(item => 
      PRIMARY_POWERLIFTING_LIFTS.includes(item.exercise.id)
    );
    
    const primaryLiftIndex = workout.exercises.findIndex(ex => 
      PRIMARY_POWERLIFTING_LIFTS.includes(ex.id)
    );

    if (primaryLifts.length > 0 && primaryLiftIndex > 2) {
      suggestions.push('Consider placing primary powerlifting lifts earlier in the workout when energy is highest');
      score -= 5;
    }

    // Duration check
    if (workout.estimatedDuration < 30) {
      feedback.push('Short duration may not allow for proper warm-up and powerlifting work');
      score -= 10;
    } else if (workout.estimatedDuration > 90) {
      feedback.push('Long duration may lead to fatigue affecting lift quality');
      score -= 5;
    }

    // Volume check - adjusted for 4+ exercises
    const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets, 0);
    if (totalSets < 10) {
      feedback.push('Low total volume for comprehensive powerlifting development');
      score -= 10;
    } else if (totalSets > 25) {
      feedback.push('High volume may impact recovery for powerlifting');
      score -= 5;
    }

    // Powerlifting-specific suggestions
    if (score > 70) {
      const hasDeadlift = workout.exercises.some(ex => ex.id.includes('deadlift'));
      const hasSquat = workout.exercises.some(ex => ex.id.includes('squat'));
      const hasBench = workout.exercises.some(ex => ex.id.includes('bench'));
      
      if (!hasDeadlift && !hasSquat && !hasBench) {
        suggestions.push('Consider including at least one of the big 3 powerlifting movements');
      }
    }

    const isValid = criticalIssues.length === 0 && score >= 60;

    return {
      isValid,
      score: Math.max(0, score),
      feedback,
      criticalIssues,
      suggestions
    };
  }

  generateFeedbackPrompt(
    originalWorkout: GeneratedWorkout, 
    validationResult: ValidationResult,
    originalPrompt: string
  ): string {
    const { criticalIssues, feedback, suggestions } = validationResult;
    
    return `WORKOUT VALIDATION FEEDBACK - Please regenerate the workout addressing these issues:

ORIGINAL WORKOUT HAD THESE PROBLEMS:
${criticalIssues.map(issue => `❌ CRITICAL: ${issue}`).join('\n')}
${feedback.map(issue => `⚠️  ISSUE: ${issue}`).join('\n')}

IMPROVEMENTS NEEDED:
${suggestions.map(suggestion => `💡 ${suggestion}`).join('\n')}

ORIGINAL PROMPT WAS:
${originalPrompt}

PLEASE REGENERATE with these specific corrections:
1. MUST include at least one primary powerlifting lift (squat, bench-press, deadlift, overhead-press)
2. MUST include at least 4 exercises for comprehensive powerlifting workout
3. Focus on powerlifting-appropriate rep ranges and progression
4. Prioritize compound movements that support competition lifts
5. Ensure proper workout structure and volume for powerlifting

Return the corrected workout in the same JSON format.`;
  }
}

export const workoutValidator = new WorkoutValidator(); 