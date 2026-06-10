/**
 * Training Advancement System
 *
 * Determines user's training level based on:
 * 1. Strength percentiles from workout history (high confidence)
 * 2. Self-reported training years (medium confidence)
 * 3. Default to beginner (low confidence - safest)
 *
 * This level then controls programming strictness for fatigue management.
 */

import {
  GeneratedWorkout,
  TrainingAdvancement,
  TrainingAdvancementResult,
  UserProfile
} from '@/types';
import {
  calculateStrengthPercentile,
  MALE_STANDARDS,
  FEMALE_STANDARDS
} from '@/lib/data/strengthStandards';
import { analyticsService } from '@/lib/services/analytics';
import { getWorkoutById } from './workouts';

// ===== TRAINING ADVANCEMENT DETERMINATION =====

/**
 * Determine user's training advancement level
 * Uses percentile data when available, falls back to training years
 */
export function determineTrainingAdvancement(
  workoutHistory: GeneratedWorkout[],
  userProfile: UserProfile | null
): TrainingAdvancementResult {

  // 1. Try percentile-based assessment (HIGH confidence - actual performance data)
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

  // 2. Fall back to training years (MEDIUM confidence - self-reported)
  if (userProfile?.trainingYears !== undefined) {
    return {
      level: yearsToAdvancement(userProfile.trainingYears),
      source: 'training_years',
      confidence: 'medium',
      trainingYears: userProfile.trainingYears,
    };
  }

  // 3. Default to beginner (LOW confidence - safest assumption)
  return {
    level: 'beginner',
    source: 'default',
    confidence: 'low',
  };
}

/**
 * Calculate strength percentiles from workout history
 */
function calculatePercentiles(
  workoutHistory: GeneratedWorkout[],
  userProfile: UserProfile
): number[] {
  const gender = userProfile.gender || 'male';
  const bodyWeight = userProfile.weight.value;
  const standards = gender === 'male' ? MALE_STANDARDS : FEMALE_STANDARDS;
  const percentiles: number[] = [];

  // Check last 20 workouts for exercises with standards
  for (const workout of workoutHistory.slice(-20)) {
    for (const ex of workout.exercises) {
      if (standards[ex.id]) {
        const bestSet = ex.completedSets?.reduce((best, current) =>
          (current.weight > best.weight) ? current : best,
          { weight: 0, reps: 0 }
        );
        if (bestSet && bestSet.weight > 0) {
          const percentile = calculateStrengthPercentile(
            bestSet.weight,
            bodyWeight,
            gender,
            ex.id
          );
          percentiles.push(percentile);
        }
      }
    }
  }

  return percentiles;
}

/**
 * Convert strength percentile to training advancement level
 *
 * Research basis:
 * - <40th percentile: Still building foundational strength (beginner)
 * - 40-70th percentile: Significant strength, needs structured programming (intermediate)
 * - >70th percentile: High absolute loads, recovery demands are real (advanced)
 */
function percentileToAdvancement(percentile: number): TrainingAdvancement {
  if (percentile < 40) return 'beginner';
  if (percentile < 70) return 'intermediate';
  return 'advanced';
}

/**
 * Convert self-reported training years to advancement level
 *
 * General guidelines:
 * - <1 year: Still learning movement patterns, building base (beginner)
 * - 1-3 years: Past newbie gains, needs progressive programming (intermediate)
 * - 3+ years: Experienced, knows their body, can handle/needs varied intensity (advanced)
 */
function yearsToAdvancement(years: number): TrainingAdvancement {
  if (years < 1) return 'beginner';
  if (years < 3) return 'intermediate';
  return 'advanced';
}

// ===== PROGRAMMING RULES BY ADVANCEMENT LEVEL =====

export interface ProgrammingConfig {
  // Fatigue management
  allowHeavySquatAndDeadliftSameDay: boolean;
  allowHeavyLightSameDay: boolean;
  maxSetsPerMusclePerSession: number;
  minRestDaysBetweenHeavySamePattern: number;

  // Frequency recommendations
  suggestedFrequency: {
    squat: number;
    bench: number;
    deadlift: number;
  };

  // Intensity thresholds
  heavyThreshold: number;  // % of 1RM considered "heavy"

  // Volume landmarks (sets per muscle per week)
  volumeRange: {
    min: number;
    max: number;
  };
}

/**
 * Programming rules based on training advancement
 *
 * Research basis:
 * - Beginners: Low absolute loads = fast recovery, can handle frequency
 * - Intermediate: Building significant strength, needs balance
 * - Advanced: High absolute loads, recovery is limiting factor
 *
 * Sources:
 * - Stronger By Science: Training Frequency
 * - RP Strength: Volume Landmarks
 * - Schoenfeld et al.: Dose-response meta-analyses
 */
export const PROGRAMMING_RULES: Record<TrainingAdvancement, ProgrammingConfig> = {
  beginner: {
    // Loose rules - low absolute loads, fast recovery
    allowHeavySquatAndDeadliftSameDay: true,  // Fine at low weights
    allowHeavyLightSameDay: true,
    maxSetsPerMusclePerSession: 12,
    minRestDaysBetweenHeavySamePattern: 1,
    suggestedFrequency: {
      squat: 3,    // More practice, technique acquisition
      bench: 3,
      deadlift: 2,
    },
    heavyThreshold: 0.85,  // 85%+ is "heavy"
    volumeRange: {
      min: 10,
      max: 20,
    },
  },

  intermediate: {
    // Moderate rules - flag concerns but don't block
    allowHeavySquatAndDeadliftSameDay: false,  // Flag this combination
    allowHeavyLightSameDay: true,              // Heavy squat + light RDL is fine
    maxSetsPerMusclePerSession: 10,
    minRestDaysBetweenHeavySamePattern: 1,
    suggestedFrequency: {
      squat: 2,
      bench: 3,    // Upper body recovers faster
      deadlift: 1.5,
    },
    heavyThreshold: 0.80,  // 80%+ is "heavy"
    volumeRange: {
      min: 12,
      max: 22,
    },
  },

  advanced: {
    // Strict rules - high absolute loads require more recovery
    allowHeavySquatAndDeadliftSameDay: false,
    allowHeavyLightSameDay: true,
    maxSetsPerMusclePerSession: 8,
    minRestDaysBetweenHeavySamePattern: 2,
    suggestedFrequency: {
      squat: 2,
      bench: 2,
      deadlift: 1,
    },
    heavyThreshold: 0.75,  // 75%+ is "heavy" for advanced (higher absolute loads)
    volumeRange: {
      min: 12,
      max: 20,  // Lower ceiling - harder to recover from
    },
  },
};

/**
 * Get programming config for a user
 */
export function getProgrammingConfig(
  workoutHistory: GeneratedWorkout[],
  userProfile: UserProfile | null
): { config: ProgrammingConfig; advancement: TrainingAdvancementResult } {
  const advancement = determineTrainingAdvancement(workoutHistory, userProfile);
  const config = PROGRAMMING_RULES[advancement.level];
  return { config, advancement };
}

// ===== MOVEMENT PATTERN DEFINITIONS =====

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_push'
  | 'vertical_pull'
  | 'carry'
  | 'isolation';

/**
 * Map exercises to their primary movement pattern
 * This enables fatigue tracking at the pattern level
 */
export const EXERCISE_MOVEMENT_PATTERNS: Record<string, MovementPattern> = {
  // Squat pattern
  'squat-barbell': 'squat',
  'front-squat-barbell': 'squat',
  'goblet-squat-dumbbell': 'squat',
  'leg-press-machine': 'squat',
  'hack-squat-machine': 'squat',
  'bulgarian-split-squat-dumbbells': 'squat',

  // Hinge pattern
  'deadlift-barbell': 'hinge',
  'deadlift-conventional-barbell': 'hinge',
  'deadlift-sumo-barbell': 'hinge',
  'romanian-deadlift-barbell': 'hinge',
  'romanian-deadlift-dumbbells': 'hinge',
  'good-morning-barbell': 'hinge',
  'hip-thrust-barbell': 'hinge',
  'kettlebell-swing': 'hinge',

  // Horizontal push
  'bench-press-barbell': 'horizontal_push',
  'bench-press-dumbbells': 'horizontal_push',
  'incline-bench-press-barbell': 'horizontal_push',
  'incline-bench-press-dumbbells': 'horizontal_push',
  'decline-bench-press-barbell': 'horizontal_push',
  'chest-fly-dumbbells': 'horizontal_push',
  'chest-fly-cables': 'horizontal_push',
  'push-up-bodyweight': 'horizontal_push',
  'dip-bodyweight': 'horizontal_push',

  // Horizontal pull
  'row-barbell': 'horizontal_pull',
  'row-dumbbells': 'horizontal_pull',
  'cable-row-cables': 'horizontal_pull',
  'seated-row-cables': 'horizontal_pull',
  't-bar-row-barbell': 'horizontal_pull',
  'pendlay-row-barbell': 'horizontal_pull',
  'chest-supported-row-dumbbells': 'horizontal_pull',

  // Vertical push
  'overhead-press-barbell': 'vertical_push',
  'overhead-press-dumbbells': 'vertical_push',
  'arnold-press-dumbbells': 'vertical_push',
  'push-press-barbell': 'vertical_push',
  'lateral-raise-dumbbells': 'vertical_push',

  // Vertical pull
  'pull-up-bodyweight': 'vertical_pull',
  'chin-up-bodyweight': 'vertical_pull',
  'lat-pulldown-cables': 'vertical_pull',
  'lat-pulldown-machine': 'vertical_pull',

  // Carry
  'farmers-walk-dumbbells': 'carry',
  'suitcase-carry-dumbbell': 'carry',

  // Isolation (less systemic fatigue)
  'bicep-curl-dumbbells': 'isolation',
  'bicep-curl-barbell': 'isolation',
  'tricep-pushdown-cables': 'isolation',
  'tricep-extension-dumbbells': 'isolation',
  'leg-curl-machine': 'isolation',
  'leg-extension-machine': 'isolation',
  'calf-raise-machine': 'isolation',
  'face-pull-cables': 'isolation',
  'rear-delt-fly-dumbbells': 'isolation',
};

/**
 * Get movement pattern for an exercise
 * Returns 'isolation' as default for unknown exercises (safest assumption)
 */
export function getMovementPattern(exerciseId: string): MovementPattern {
  return EXERCISE_MOVEMENT_PATTERNS[exerciseId] || 'isolation';
}

/**
 * Patterns that conflict when both are heavy on same day
 */
export const HEAVY_PATTERN_CONFLICTS: [MovementPattern, MovementPattern][] = [
  ['squat', 'hinge'],  // Both tax lower back, glutes, legs
];

/**
 * Check if two movement patterns conflict when both heavy
 */
export function patternsConflict(pattern1: MovementPattern, pattern2: MovementPattern): boolean {
  return HEAVY_PATTERN_CONFLICTS.some(
    ([a, b]) => (pattern1 === a && pattern2 === b) || (pattern1 === b && pattern2 === a)
  );
}


// ===== ROUTINE VALIDATION =====
//
// Validates CONVERTED routines (real exercise IDs), not raw AI output. This fixes two
// problems found in the output audit:
//   1. Coverage: the old validator re-derived IDs from names via regex slugs, so any lift
//      not in the hand-maintained movement map defaulted to 'isolation' and was invisible
//      to fatigue checks (56-82% coverage). We now resolve muscles/patterns from the real
//      exercise DB.
//   2. False positives: the old check flagged ANY squat+hinge co-occurrence as a same-day
//      conflict — but PHUL/PHAT intentionally pair heavy squat + heavy deadlift on a single
//      dedicated lower/power day. We now only warn when that heavy pairing repeats across
//      MORE THAN ONE day per week (genuinely insufficient recovery).
//
// Results are observability-only (logged, not enforced) — consistent with the decision not
// to build a repair loop.

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

/**
 * Classify a lift as a squat- or hinge-pattern movement for the same-day fatigue check.
 * Uses the curated movement map first, then falls back to name keywords from the exercise DB
 * so coverage isn't limited to hand-listed IDs.
 */
function classifyLowerPattern(exerciseId: string, exerciseName?: string): 'squat' | 'hinge' | null {
  const mapped = EXERCISE_MOVEMENT_PATTERNS[exerciseId];
  if (mapped === 'squat' || mapped === 'hinge') return mapped;
  const name = (exerciseName || getWorkoutById(exerciseId)?.name || exerciseId).toLowerCase();
  if (/(romanian|rdl|deadlift|good\s*morning|hip\s*thrust|swing|back\s*extension|hyperextension)/.test(name)) return 'hinge';
  if (/(squat|leg\s*press|hack|lunge|split\s*squat|step.?up)/.test(name)) return 'squat';
  return null;
}

/**
 * Validate converted routines against programming rules. Logs results for monitoring AI
 * output quality; returns warnings for callers that want to surface them.
 *
 * NOTE: a per-session/per-week muscle-volume check was deliberately NOT included. The
 * exercise DB labels primary muscles with coarse regions ("legs", "back", "arms") that span
 * several sub-muscles, so summing sets per label flags every normal leg/back day (a 14-set
 * leg day is really ~5 quad / 5 ham / 4 glute). Re-scoring the audit programs showed such a
 * check firing on 12/16 by-design programs — noise, not signal. Meaningful volume validation
 * needs a finer muscle taxonomy than this DB provides (logged as future work).
 */
export function validateRoutines(
  routines: ValidatableRoutine[],
  advancementLevel: TrainingAdvancement
): ProgramValidationResult {
  const config = PROGRAMMING_RULES[advancementLevel];
  const warnings: string[] = [];

  // Program-level: heavy squat + heavy deadlift is fine on ONE dedicated day; warn if repeated
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
