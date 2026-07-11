// Determines training level (percentile > training years > beginner default), which controls programming strictness for fatigue management.

import {
  LoggedWorkout,
  TrainingAdvancement,
  TrainingAdvancementResult,
  UserProfile,
  convertWeight
} from '@/types';
import {
  calculateStrengthPercentile,
  MALE_STANDARDS,
  FEMALE_STANDARDS,
  OneRMCalculator, e1rmLbs} from '@/lib/data/strengthStandards';
import { analyticsService } from '@/lib/services/analytics';
import { bestCompletedSet, completedWorkingSets } from './setStats';
import { getCatalogExercise } from './exerciseCatalog';

export function determineTrainingAdvancement(
  workoutHistory: LoggedWorkout[],
  userProfile: UserProfile | null
): TrainingAdvancementResult {

  // Percentile-based assessment (high confidence: actual performance data)
  if (userProfile?.weight?.value && workoutHistory.length > 0) {
    const percentiles = calculatePercentiles(workoutHistory, userProfile);

    // Need at least 3 data points for confidence
    if (percentiles.length >= 3) {
      const avgPercentile = percentiles.reduce((a, b) => a + b, 0) / percentiles.length;
      return {
        level: percentileToAdvancement(avgPercentile),
        source: 'percentile',
        confidence: 'high',
        percentile: Math.round(avgPercentile),
      };
    }
  }

  // Fall back to self-reported training years (medium confidence)
  if (userProfile?.trainingYears !== undefined) {
    return {
      level: yearsToAdvancement(userProfile.trainingYears),
      source: 'training_years',
      confidence: 'medium',
      trainingYears: userProfile.trainingYears,
    };
  }

  // Default to beginner (low confidence, safest assumption)
  return {
    level: 'beginner',
    source: 'default',
    confidence: 'low',
  };
}

function calculatePercentiles(
  workoutHistory: LoggedWorkout[],
  userProfile: UserProfile
): number[] {
  const gender = userProfile.gender || 'male';
  // Standards compare an estimated 1RM against bodyweight as a ratio, so both must
  // be in the same unit — normalize to lbs (matching every other percentile caller).
  const bodyWeightLbs = convertWeight(userProfile.weight.value, userProfile.weight.unit, 'lbs');
  const standards = gender === 'male' ? MALE_STANDARDS : FEMALE_STANDARDS;
  const percentiles: number[] = [];

  for (const workout of workoutHistory.slice(-20)) {
    for (const ex of workout.exercises) {
      if (standards[ex.id]) {
        const bestSet = bestCompletedSet(completedWorkingSets(ex.completedSets), 'e1rm');
        if (bestSet) {
          const estimated1RMLbs = e1rmLbs(bestSet.weight, bestSet.reps, bestSet.unit);
          const percentile = calculateStrengthPercentile(
            estimated1RMLbs,
            bodyWeightLbs,
            gender,
            ex.id,
            userProfile.age
          );
          percentiles.push(percentile);
        }
      }
    }
  }

  return percentiles;
}

// Thresholds: <40th still building base; 40-70th needs structured programming; >70th high loads with real recovery demands.
function percentileToAdvancement(percentile: number): TrainingAdvancement {
  if (percentile < 40) return 'beginner';
  if (percentile < 70) return 'intermediate';
  return 'advanced';
}

function yearsToAdvancement(years: number): TrainingAdvancement {
  if (years < 1) return 'beginner';
  if (years < 3) return 'intermediate';
  return 'advanced';
}

export interface ProgrammingConfig {
  allowHeavySquatAndDeadliftSameDay: boolean;
  maxSetsPerMusclePerSession: number;
  suggestedFrequency: {
    squat: number;
    bench: number;
    deadlift: number;
  };
}

// Rules loosen for beginners (fast recovery) and tighten for advanced (recovery is limiting).
// Sources: Stronger By Science (frequency), RP Strength (volume landmarks), Schoenfeld et al. (dose-response).
export const PROGRAMMING_RULES: Record<TrainingAdvancement, ProgrammingConfig> = {
  beginner: {
    allowHeavySquatAndDeadliftSameDay: true,
    maxSetsPerMusclePerSession: 12,
    suggestedFrequency: {
      squat: 3,
      bench: 3,
      deadlift: 2,
    },
  },

  intermediate: {
    allowHeavySquatAndDeadliftSameDay: false,
    maxSetsPerMusclePerSession: 10,
    suggestedFrequency: {
      squat: 2,
      bench: 3,
      deadlift: 1.5,
    },
  },

  advanced: {
    allowHeavySquatAndDeadliftSameDay: false,
    maxSetsPerMusclePerSession: 8,
    suggestedFrequency: {
      squat: 2,
      bench: 2,
      deadlift: 1,
    },
  },
};

// Validates CONVERTED routines (real exercise IDs), not raw AI output, so muscles/patterns
// resolve from the real exercise DB rather than regex slugs (which left lifts uncovered by
// fatigue checks). Only warns when heavy squat+hinge pairing repeats on MORE THAN ONE day/week
// — a single dedicated lower/power day (PHUL/PHAT) is by design. Results are logged, not enforced.

export interface ProgramValidationResult {
  isValid: boolean;
  warnings: string[];
}

interface ValidatableExercise {
  exerciseId: string;
  exerciseName?: string;
  sets: { reps: number }[];
}
interface ValidatableRoutine {
  name: string;
  exercises: ValidatableExercise[];
}

/** A routine exercise is "heavy" when its programmed reps sit in the strength range. */
function isHeavyRoutineExercise(ex: ValidatableExercise): boolean {
  const reps = ex.sets?.[0]?.reps ?? 99;
  return reps <= 6;
}

// Classify a lift as squat/hinge for the same-day fatigue check. Matches keywords against the
// display name, catalog name, or id; separators may be spaces or hyphens. null = not a lower squat/hinge.
function classifyLowerPattern(exerciseId: string, exerciseName?: string): 'squat' | 'hinge' | null {
  const name = (exerciseName || getCatalogExercise(exerciseId)?.name || exerciseId).toLowerCase();
  if (/(romanian|rdl|deadlift|good[-\s]*morning|hip[-\s]*thrust|swing|back[-\s]*extension|hyperextension)/.test(name)) return 'hinge';
  if (/(squat|leg[-\s]*press|hack|lunge|split[-\s]*squat|step.?up)/.test(name)) return 'squat';
  return null;
}

// A per-muscle volume check is deliberately omitted: the DB's coarse muscle labels ("legs",
// "back") span sub-muscles, so per-label set sums flag every normal day (fired on 12/16 by-design
// audit programs). Meaningful volume validation needs a finer taxonomy than this DB provides.
export function validateRoutines(
  routines: ValidatableRoutine[],
  advancementLevel: TrainingAdvancement
): ProgramValidationResult {
  const config = PROGRAMMING_RULES[advancementLevel];
  const warnings: string[] = [];

  // Heavy squat + heavy deadlift is fine on ONE dedicated day; warn only if repeated.
  if (!config.allowHeavySquatAndDeadliftSameDay) {
    let heavyLowerDays = 0;
    for (const day of routines) {
      const heavySquat = day.exercises.some(e => isHeavyRoutineExercise(e) && classifyLowerPattern(e.exerciseId, e.exerciseName) === 'squat');
      const heavyHinge = day.exercises.some(e => isHeavyRoutineExercise(e) && classifyLowerPattern(e.exerciseId, e.exerciseName) === 'hinge');
      if (heavySquat && heavyHinge) heavyLowerDays++;
    }
    if (heavyLowerDays > 1) {
      warnings.push(`Heavy squat + heavy deadlift paired on ${heavyLowerDays} days/week — limit to one dedicated lower/power day for ${advancementLevel} lifters.`);
    }
  }

  const isValid = warnings.length === 0;
  const logContext = { advancementLevel, dayCount: routines.length, warnings };
  if (isValid) {
    analyticsService.logInfo('ai', 'program_validation_complete', `Program valid: ${routines.length} days`, logContext);
  } else {
    analyticsService.logWarn('ai', 'program_validation_warnings', `Program has ${warnings.length} warning(s)`, logContext);
  }

  return { isValid, warnings };
}
