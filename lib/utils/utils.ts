import { WeightUnit, TrackingType, GeneratedWorkout } from "@/types";

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

export const calculateOverallPercentile = (liftPercentiles: number[]): number => {
  if (liftPercentiles.length === 0) return 0;
  const filteredPercentiles = liftPercentiles.filter(percentile => percentile > 0);
  if (filteredPercentiles.length === 0) return 0;
  const sum = filteredPercentiles.reduce((acc, percentile) => acc + percentile, 0);
  return Math.round(sum / filteredPercentiles.length);
};

// Volume is stored in lbs.
export const formatVolume = (volumeLbs: number, unit: WeightUnit): string =>
  `${formatVolumeNumber(volumeLbs, unit)} ${unit}`;

export const formatVolumeNumber = (volumeLbs: number, unit: WeightUnit): string => {
  const volume = unit === 'kg' ? volumeLbs / 2.205 : volumeLbs;
  return volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : Math.round(volume).toLocaleString();
};

// Abbreviate as "1.2k" / "1.2M"; values below 1000 returned verbatim.
export const formatCompact = (value: number, opts: { suffix?: string; millions?: boolean } = {}): string => {
  const suffix = opts.suffix ?? '';
  if (opts.millions && value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M${suffix}`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k${suffix}`;
  return `${value}${suffix}`;
};

/** Local-date key "YYYY-MM-DD" (not UTC) — used as a per-day bucketing key. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Day-key strings → ascending epoch-ms at local midnight.
export function sortedDayTimestamps(keys: Iterable<string>): number[] {
  return [...keys]
    .map(k => {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    })
    .sort((a, b) => a - b);
}

// Local Monday (00:00) of the week containing `date`. Uses setDate (not raw ms
// math) so it stays correct across daylight-saving boundaries.
export function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const fromMonday = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  d.setDate(d.getDate() - fromMonday);
  return d;
}

/** Round a weight to the nearest loadable increment (2.5 kg / 5 lbs). */
export function roundWeight(weight: number, unit: WeightUnit): number {
  const increment = unit === 'kg' ? 2.5 : 5;
  return Math.round(weight / increment) * increment;
}

/** Rounded mean of a numeric array (0 for empty). */
export const roundedAverage = (arr: number[]): number =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

/** Color for an exercise's progression direction; `neutralColor` is used for "maintain". */
export function getProgressionColor(
  progression: 'increase' | 'maintain' | 'decrease',
  neutralColor: string
): string {
  switch (progression) {
    case 'increase': return '#34C759';
    case 'decrease': return '#FF3B30';
    default: return neutralColor;
  }
}

export { convertWeightToLbs };

// Format seconds to MM:SS or H:MM:SS.
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

// Format whole minutes as "1h 30m" / "30m".
export const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

// Compact hours-only form (e.g. "14.7h") to avoid "Xh Ym" ellipsizing in narrow columns.
export const formatHoursCompact = (minutes: number): string => {
  const rounded = Math.round((minutes / 60) * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}h`;
};

// Categorize a workout into a split bucket from its title.
export const getWorkoutCategory = (workout: GeneratedWorkout): string => {
  const title = workout.title.toLowerCase();

  if (title.includes('push') || title.includes('chest') || title.includes('bench')) {
    return 'push';
  } else if (title.includes('pull') || title.includes('back') || title.includes('deadlift')) {
    return 'pull';
  } else if (title.includes('leg') || title.includes('squat') || title.includes('glute')) {
    return 'legs';
  } else if (title.includes('upper') || title.includes('arm')) {
    return 'upper';
  } else if (title.includes('full') || title.includes('total')) {
    return 'full';
  } else {
    return 'other';
  }
};

// Format distance in meters to km or m.
export const formatDistance = (meters: number): string => {
  if (!meters || meters <= 0) return '';

  if (meters >= 1000) {
    const km = meters / 1000;
    return km % 1 === 0 ? `${km}km` : `${km.toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
};

export interface SetFormatData {
  weight?: number;
  reps?: number;
  unit?: WeightUnit;
  duration?: number;  // seconds
  distance?: number;  // meters
}

export interface FormatSetOptions {
  trackingType?: TrackingType;
  showUnit?: boolean;  // default: true
  compact?: boolean;   // × instead of ' x ', default: false
}

// Universal set formatter across all tracking types.
export const formatSet = (
  set: SetFormatData,
  options: FormatSetOptions = {}
): string => {
  const {
    trackingType = 'reps',
    showUnit = true,
    compact = false
  } = options;

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

  if (trackingType === 'timed') {
    return set.duration && set.duration > 0 ? formatDuration(set.duration) : '—';
  }

  const weight = set.weight ?? 0;
  const reps = set.reps ?? 0;
  const unit = set.unit ?? 'lbs';

  if (weight === 0) {
    return `${reps} reps`;
  }

  if (compact) {
    return `${weight}×${reps}`;
  }

  if (showUnit) {
    return `${weight} ${unit} × ${reps}`;
  }

  return `${weight} × ${reps}`;
};

// Best-set string for syncing to database/feed (userSyncService).
export const formatBestSet = (
  set: SetFormatData,
  trackingType: TrackingType = 'reps'
): string => {
  return formatSet(set, { trackingType, compact: true, showUnit: false });
};

export interface WorkoutStats {
  totalSets: number;
  totalVolumeLbs: number;
  totalDistanceMeters: number;
  totalCardioDurationSeconds: number;
  hasWeightedExercises: boolean;
  hasCardioExercises: boolean;
}

export interface ExerciseSetForStats {
  weight?: number;
  reps?: number;
  unit?: WeightUnit;
  duration?: number;
  distance?: number;
  completed?: boolean;
}

export interface ExerciseForStats {
  id: string;
  completedSets?: ExerciseSetForStats[];
  trackingType?: TrackingType;
}

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
      if (set.completed === false) continue;

      totalSets++;

      if (trackingType === 'cardio') {
        hasCardioExercises = true;
        totalCardioDurationSeconds += set.duration || 0;
        totalDistanceMeters += set.distance || 0;
      } else if (trackingType === 'timed') {
        // Timed exercises count as sets but don't contribute to volume.
      } else {
        const weight = set.weight || 0;
        const reps = set.reps || 0;
        if (weight > 0) {
          hasWeightedExercises = true;
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

export interface FormatStatsLineOptions {
  unit?: WeightUnit;
  showSetCount?: boolean;
  includeExerciseCount?: number; // if set, prefix with "N exercises · "
}

export const formatWorkoutStatsLine = (
  stats: WorkoutStats,
  options: FormatStatsLineOptions = {}
): string => {
  const { unit = 'lbs', showSetCount = true, includeExerciseCount } = options;
  const parts: string[] = [];

  if (includeExerciseCount !== undefined && includeExerciseCount > 0) {
    parts.push(`${includeExerciseCount} exercises`);
  }

  if (stats.hasCardioExercises && !stats.hasWeightedExercises) {
    if (stats.totalCardioDurationSeconds > 0) {
      parts.push(formatDuration(stats.totalCardioDurationSeconds));
    }
    if (stats.totalDistanceMeters > 0) {
      parts.push(formatDistance(stats.totalDistanceMeters));
    }
    return parts.length > 0 ? parts.join(' · ') : '—';
  }

  if (showSetCount && stats.totalSets > 0) {
    parts.push(`${stats.totalSets} sets`);
  }

  if (stats.hasWeightedExercises && stats.totalVolumeLbs > 0) {
    parts.push(formatVolume(stats.totalVolumeLbs, unit));
  }

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
