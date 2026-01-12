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

export interface RoutineValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  details: {
    hasSquatAndHingeSameDay: boolean;
    maxSetsPerMuscleExceeded: boolean;
    movementPatternBalance: Record<MovementPattern, number>;
  };
}

/**
 * Validate a generated routine against programming rules
 * Logs validation results for monitoring AI output quality
 */
export function validateGeneratedRoutine(
  routineDay: { exercises: { exerciseId: string; sets: number }[] },
  advancementLevel: TrainingAdvancement,
  dayName?: string
): RoutineValidationResult {
  const config = PROGRAMMING_RULES[advancementLevel];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Track movement patterns in this day
  const patternCounts: Record<MovementPattern, number> = {
    squat: 0,
    hinge: 0,
    horizontal_push: 0,
    horizontal_pull: 0,
    vertical_push: 0,
    vertical_pull: 0,
    carry: 0,
    isolation: 0,
  };

  // Track sets per muscle-ish (using movement pattern as proxy)
  const setsPerPattern: Record<MovementPattern, number> = { ...patternCounts };

  for (const exercise of routineDay.exercises) {
    const pattern = getMovementPattern(exercise.exerciseId);
    patternCounts[pattern]++;
    setsPerPattern[pattern] += exercise.sets || 3; // Default to 3 if not specified
  }

  // Check 1: Squat + Hinge same day
  const hasSquatAndHinge = patternCounts.squat > 0 && patternCounts.hinge > 0;
  if (hasSquatAndHinge && !config.allowHeavySquatAndDeadliftSameDay) {
    warnings.push(`Squat and hinge patterns on same day (${dayName || 'routine'}) - may cause excessive fatigue for ${advancementLevel} level`);
  }

  // Check 2: Sets per muscle per session
  const maxSetsExceeded = Object.entries(setsPerPattern).some(
    ([pattern, sets]) => pattern !== 'isolation' && sets > config.maxSetsPerMusclePerSession
  );
  if (maxSetsExceeded) {
    const exceeding = Object.entries(setsPerPattern)
      .filter(([pattern, sets]) => pattern !== 'isolation' && sets > config.maxSetsPerMusclePerSession)
      .map(([pattern, sets]) => `${pattern}: ${sets} sets`);
    warnings.push(`Exceeds recommended ${config.maxSetsPerMusclePerSession} sets/muscle/session: ${exceeding.join(', ')}`);
  }

  // Check 3: Push/Pull balance (warning only)
  const totalPush = setsPerPattern.horizontal_push + setsPerPattern.vertical_push;
  const totalPull = setsPerPattern.horizontal_pull + setsPerPattern.vertical_pull;
  if (totalPush > 0 && totalPull > 0) {
    const ratio = totalPush / totalPull;
    if (ratio > 1.5) {
      warnings.push(`Push-heavy session (${totalPush} push sets vs ${totalPull} pull sets)`);
    }
  }

  const isValid = errors.length === 0;

  // Log validation result (fire-and-forget to keep function sync)
  const logContext = {
    dayName: dayName || 'Routine',
    advancementLevel,
    isValid,
    warningCount: warnings.length,
    errorCount: errors.length,
    warnings,
    errors,
    patternBalance: patternCounts,
  };

  if (isValid && warnings.length === 0) {
    analyticsService.logInfo('ai', 'routine_validation_passed', `${dayName || 'Routine'} valid for ${advancementLevel}`, logContext);
  } else if (isValid && warnings.length > 0) {
    analyticsService.logWarn('ai', 'routine_validation_warnings', `${dayName || 'Routine'} valid with ${warnings.length} warnings`, logContext);
  } else {
    analyticsService.logErr('ai', 'routine_validation_failed', `${dayName || 'Routine'} invalid for ${advancementLevel}`, logContext);
  }

  return {
    isValid,
    warnings,
    errors,
    details: {
      hasSquatAndHingeSameDay: hasSquatAndHinge,
      maxSetsPerMuscleExceeded: maxSetsExceeded,
      movementPatternBalance: patternCounts,
    },
  };
}

/**
 * Validate an entire generated program
 */
export function validateGeneratedProgram(
  program: { routines: { name: string; exercises: { name: string; sets: number }[] }[] },
  advancementLevel: TrainingAdvancement
): { isValid: boolean; dayResults: RoutineValidationResult[] } {
  const dayResults = program.routines.map((day) => {
    // Map exercise names to IDs for validation (simplified - uses lowercase with dashes)
    const exercises = day.exercises.map(ex => ({
      exerciseId: ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      sets: ex.sets,
    }));
    return validateGeneratedRoutine({ exercises }, advancementLevel, day.name);
  });

  const isValid = dayResults.every(r => r.isValid);
  const totalWarnings = dayResults.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalErrors = dayResults.reduce((sum, r) => sum + r.errors.length, 0);

  // Log program-level summary (fire-and-forget)
  const logContext = {
    advancementLevel,
    isValid,
    dayCount: dayResults.length,
    totalWarnings,
    totalErrors,
    routineNames: program.routines.map(r => r.name),
  };

  if (isValid) {
    analyticsService.logInfo('ai', 'program_validation_complete',
      `Program valid: ${dayResults.length} days, ${totalWarnings} warnings`, logContext);
  } else {
    analyticsService.logErr('ai', 'program_validation_failed',
      `Program invalid: ${totalErrors} errors, ${totalWarnings} warnings`, logContext);
  }

  return { isValid, dayResults };
}
