import { WeightUnit, TrackingType } from "@/types";

const convertWeightToLbs = (weight: number, unit: WeightUnit): number => {
  if (unit === 'kg') {
    return Math.round(weight * 2.20462);
  }
  return weight;
};

const convertWeightToKg = (weight: number, unit: WeightUnit): number => {
  if (unit === 'lbs') {
    return Math.round(weight / 2.20462);
  }
  return weight;
};

// Synchronous version when you already have the user preference
export const convertWeightForPreference = (weight: number, fromUnit: 'lbs' | 'kg', userPreference: 'lbs' | 'kg'): number => {
  if (userPreference === 'kg') {
    return convertWeightToKg(weight, fromUnit);
  }
  return convertWeightToLbs(weight, fromUnit);
};

export const getPercentileSuffix = (percentile: number): string => {
  const mod100 = percentile % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return 'th';
  }

  const lastDigit = percentile % 10;
  switch (lastDigit) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// Calculate overall percentile from individual lift percentiles
export const calculateOverallPercentile = (liftPercentiles: number[]): number => {
  if (liftPercentiles.length === 0) return 0;
  const filteredPercentiles = liftPercentiles.filter(percentile => percentile > 0);
  if (filteredPercentiles.length === 0) return 0;
  const sum = filteredPercentiles.reduce((acc, percentile) => acc + percentile, 0);
  return Math.round(sum / filteredPercentiles.length);
};

// Format volume with unit conversion (volume is stored in lbs)
export const formatVolume = (volumeLbs: number, unit: WeightUnit): string => {
  const volume = unit === 'kg' ? volumeLbs / 2.205 : volumeLbs;
  const formatted = volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : Math.round(volume).toLocaleString();
  return `${formatted} ${unit}`;
};

// Format volume number only (no unit suffix)
export const formatVolumeNumber = (volumeLbs: number, unit: WeightUnit): string => {
  const volume = unit === 'kg' ? volumeLbs / 2.205 : volumeLbs;
  return volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : Math.round(volume).toLocaleString();
};

export { convertWeightToKg, convertWeightToLbs };

// ===== SET FORMATTING UTILITIES =====

/**
 * Format duration in seconds to MM:SS or H:MM:SS format
 */
export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format distance in meters to km or m
 */
export const formatDistance = (meters: number): string => {
  if (!meters || meters <= 0) return '';

  if (meters >= 1000) {
    const km = meters / 1000;
    // Use 1 decimal for clean numbers, 2 for others
    return km % 1 === 0 ? `${km}km` : `${km.toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
};

/**
 * Set data for formatting
 */
export interface SetFormatData {
  weight?: number;
  reps?: number;
  unit?: WeightUnit;
  duration?: number;  // seconds
  distance?: number;  // meters
}

/**
 * Options for formatting a set
 */
export interface FormatSetOptions {
  trackingType?: TrackingType;
  showUnit?: boolean;  // Whether to show weight unit (default: true)
  compact?: boolean;   // Use × instead of ' x ' (default: false)
}

/**
 * Universal set formatter that handles all tracking types
 *
 * Examples:
 * - Reps: "135 lbs × 8" or "135×8" (compact)
 * - Bodyweight: "8 reps" (when weight is 0)
 * - Timed: "1:30"
 * - Cardio: "20:00 · 5.0km" or "20:00" (duration only)
 */
export const formatSet = (
  set: SetFormatData,
  options: FormatSetOptions = {}
): string => {
  const {
    trackingType = 'reps',
    showUnit = true,
    compact = false
  } = options;

  // Cardio: duration + optional distance
  if (trackingType === 'cardio') {
    const parts: string[] = [];
    if (set.duration && set.duration > 0) {
      parts.push(formatDuration(set.duration));
    }
    if (set.distance && set.distance > 0) {
      parts.push(formatDistance(set.distance));
    }
    return parts.length > 0 ? parts.join(' · ') : '—';
  }

  // Timed: duration only
  if (trackingType === 'timed') {
    return set.duration && set.duration > 0 ? formatDuration(set.duration) : '—';
  }

  // Reps-based (default)
  const weight = set.weight ?? 0;
  const reps = set.reps ?? 0;
  const unit = set.unit ?? 'lbs';

  // Bodyweight or zero weight: show reps only
  if (weight === 0) {
    return `${reps} reps`;
  }

  // Standard weight × reps format
  if (compact) {
    return `${weight}×${reps}`;
  }

  if (showUnit) {
    return `${weight} ${unit} × ${reps}`;
  }

  return `${weight} × ${reps}`;
};

/**
 * Format a set for compact display (used in feed, cards)
 * Always uses compact format: "135×8", "20:00", "1:30 · 5km"
 */
export const formatSetCompact = (
  set: SetFormatData,
  trackingType: TrackingType = 'reps'
): string => {
  return formatSet(set, { trackingType, compact: true, showUnit: false });
};

/**
 * Format best set string for syncing to database/feed
 * Used by userSyncService when creating workout summaries
 */
export const formatBestSet = (
  set: SetFormatData,
  trackingType: TrackingType = 'reps'
): string => {
  return formatSetCompact(set, trackingType);
};

// ===== WORKOUT STATS UTILITIES =====

/**
 * Aggregated workout statistics including cardio data
 */
export interface WorkoutStats {
  totalSets: number;
  totalVolumeLbs: number;
  totalDistanceMeters: number;
  totalCardioDurationSeconds: number;
  hasWeightedExercises: boolean;
  hasCardioExercises: boolean;
}

/**
 * Exercise set data for stats calculation
 */
export interface ExerciseSetForStats {
  weight?: number;
  reps?: number;
  unit?: WeightUnit;
  duration?: number;
  distance?: number;
  completed?: boolean;
}

/**
 * Exercise data for stats calculation
 */
export interface ExerciseForStats {
  id: string;
  completedSets?: ExerciseSetForStats[];
  trackingType?: TrackingType;
}

/**
 * Calculate aggregated workout stats from exercises
 *
 * @param exercises - Array of exercises with completed sets
 * @param getTrackingType - Optional function to look up tracking type for an exercise ID
 */
export const calculateWorkoutStats = (
  exercises: ExerciseForStats[],
  getTrackingType?: (exerciseId: string) => TrackingType | undefined
): WorkoutStats => {
  let totalSets = 0;
  let totalVolumeLbs = 0;
  let totalDistanceMeters = 0;
  let totalCardioDurationSeconds = 0;
  let hasWeightedExercises = false;
  let hasCardioExercises = false;

  for (const exercise of exercises) {
    const sets = exercise.completedSets || [];
    const trackingType = exercise.trackingType || getTrackingType?.(exercise.id) || 'reps';

    for (const set of sets) {
      // Only count completed sets (or sets without completed flag)
      if (set.completed === false) continue;

      totalSets++;

      if (trackingType === 'cardio') {
        hasCardioExercises = true;
        totalCardioDurationSeconds += set.duration || 0;
        totalDistanceMeters += set.distance || 0;
      } else if (trackingType === 'timed') {
        // Timed exercises don't contribute to volume but count as sets
        // Optionally track timed duration separately in the future
      } else {
        // Reps-based exercise
        const weight = set.weight || 0;
        const reps = set.reps || 0;
        if (weight > 0) {
          hasWeightedExercises = true;
          // Convert to lbs if necessary
          const weightLbs = set.unit === 'kg' ? weight * 2.20462 : weight;
          totalVolumeLbs += weightLbs * reps;
        }
      }
    }
  }

  return {
    totalSets,
    totalVolumeLbs: Math.round(totalVolumeLbs),
    totalDistanceMeters: Math.round(totalDistanceMeters),
    totalCardioDurationSeconds: Math.round(totalCardioDurationSeconds),
    hasWeightedExercises,
    hasCardioExercises,
  };
};

/**
 * Options for formatting workout stats line
 */
export interface FormatStatsLineOptions {
  unit?: WeightUnit;
  showSetCount?: boolean;
  includeExerciseCount?: number; // If provided, prefix with "N exercises · "
}

/**
 * Format workout stats into a single line for display
 *
 * Examples:
 * - Weights-only: "8 sets · 45.2k lbs"
 * - Cardio-only: "45:00 · 8.5km"
 * - Mixed: "8 sets · 45.2k lbs · 5km · 20:00 cardio"
 */
export const formatWorkoutStatsLine = (
  stats: WorkoutStats,
  options: FormatStatsLineOptions = {}
): string => {
  const { unit = 'lbs', showSetCount = true, includeExerciseCount } = options;
  const parts: string[] = [];

  // Optionally prefix with exercise count
  if (includeExerciseCount !== undefined && includeExerciseCount > 0) {
    parts.push(`${includeExerciseCount} exercises`);
  }

  // Cardio-only workout
  if (stats.hasCardioExercises && !stats.hasWeightedExercises) {
    if (stats.totalCardioDurationSeconds > 0) {
      parts.push(formatDuration(stats.totalCardioDurationSeconds));
    }
    if (stats.totalDistanceMeters > 0) {
      parts.push(formatDistance(stats.totalDistanceMeters));
    }
    return parts.length > 0 ? parts.join(' · ') : '—';
  }

  // Weights-only or mixed workout
  if (showSetCount && stats.totalSets > 0) {
    parts.push(`${stats.totalSets} sets`);
  }

  if (stats.hasWeightedExercises && stats.totalVolumeLbs > 0) {
    parts.push(formatVolume(stats.totalVolumeLbs, unit));
  }

  // Add cardio stats if mixed workout
  if (stats.hasCardioExercises) {
    if (stats.totalDistanceMeters > 0) {
      parts.push(formatDistance(stats.totalDistanceMeters));
    }
    if (stats.totalCardioDurationSeconds > 0) {
      parts.push(`${formatDuration(stats.totalCardioDurationSeconds)} cardio`);
    }
  }

  return parts.length > 0 ? parts.join(' · ') : '—';
};

/**
 * Format aggregate stats for weekly/monthly totals
 *
 * Example: "125k lbs · 25km · 2h cardio"
 */
export const formatAggregateStats = (
  stats: WorkoutStats,
  options: { unit?: WeightUnit } = {}
): string => {
  const { unit = 'lbs' } = options;
  const parts: string[] = [];

  if (stats.hasWeightedExercises && stats.totalVolumeLbs > 0) {
    parts.push(formatVolume(stats.totalVolumeLbs, unit));
  }

  if (stats.hasCardioExercises) {
    if (stats.totalDistanceMeters > 0) {
      parts.push(formatDistance(stats.totalDistanceMeters));
    }
    if (stats.totalCardioDurationSeconds > 0) {
      // For aggregates, format as hours if > 1 hour
      const hours = stats.totalCardioDurationSeconds / 3600;
      if (hours >= 1) {
        parts.push(`${hours.toFixed(1)}h cardio`);
      } else {
        parts.push(`${formatDuration(stats.totalCardioDurationSeconds)} cardio`);
      }
    }
  }

  return parts.length > 0 ? parts.join(' · ') : '—';
};

/**
 * Combine multiple WorkoutStats into aggregate totals
 */
export const combineWorkoutStats = (statsList: WorkoutStats[]): WorkoutStats => {
  return statsList.reduce(
    (acc, stats) => ({
      totalSets: acc.totalSets + stats.totalSets,
      totalVolumeLbs: acc.totalVolumeLbs + stats.totalVolumeLbs,
      totalDistanceMeters: acc.totalDistanceMeters + stats.totalDistanceMeters,
      totalCardioDurationSeconds: acc.totalCardioDurationSeconds + stats.totalCardioDurationSeconds,
      hasWeightedExercises: acc.hasWeightedExercises || stats.hasWeightedExercises,
      hasCardioExercises: acc.hasCardioExercises || stats.hasCardioExercises,
    }),
    {
      totalSets: 0,
      totalVolumeLbs: 0,
      totalDistanceMeters: 0,
      totalCardioDurationSeconds: 0,
      hasWeightedExercises: false,
      hasCardioExercises: false,
    }
  );
};
