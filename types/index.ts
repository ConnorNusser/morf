// ===== CORE TYPES =====

// User demographics
export type Gender = 'male' | 'female' | 'other' | 'prefer-not-to-say';

// Units
export type HeightUnit = 'feet' | 'cm';
export type WeightUnit = 'lbs' | 'kg';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Theme progression levels
export type ThemeLevel = 'beginner' | 'beginner_dark' | 'intermediate' | 'advanced' | 'elite' | 'god' | 'share_warm' | 'share_cool' | 'christmas_theme_2025';

// ===== EXERCISE TYPES =====

// Exercise categories
export type WorkoutCategory = 'compound' | 'isolation' | 'cardio' | 'flexibility';

export type WorkoutSplit = 'push' | 'pull' | 'legs' | 'full-body' | 'upper-body' | 'lower-body' | 'calisthenics';

// Muscle groups
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'core' | 'full-body';

// Equipment types
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'smith-machine' | 'bodyweight' | 'cable' | 'kettlebell';

// Tracking type - determines how exercise sets are logged
// 'reps' = weight + reps (default for most exercises)
// 'timed' = duration only (planks, wall sits, dead hangs)
// 'cardio' = duration + distance (rowing, running, cycling)
export type TrackingType = 'reps' | 'timed' | 'cardio';

// Equipment filter mode
export type EquipmentFilterMode = 'all' | 'bodyweight-only' | 'custom';

// Equipment filter settings
export interface EquipmentFilter {
  mode: EquipmentFilterMode;
  // Only used when mode is 'custom' - which equipment types to include
  includedEquipment: Equipment[];
}

// Main lift exercises
export type MainLiftType = 'squat-barbell' | 'bench-press-barbell' | 'deadlift-barbell' | 'overhead-press-barbell';

// Featured secondary lifts that appear on main dashboard (all lifts with strength standards)
export type FeaturedSecondaryLiftType =
  | 'bench-press-dumbbells'
  | 'bicep-curl-dumbbells'
  | 'bicep-curl-barbell'
  | 'leg-press-machine'
  | 'row-barbell'
  | 'incline-bench-press-barbell'
  | 'lat-pulldown-cables'
  | 'leg-extension-machine'
  | 'romanian-deadlift-barbell'
  | 'incline-bench-press-dumbbells'
  | 'shoulder-press-dumbbells'
  | 'front-squat-barbell'
  | 'hip-thrust-barbell'
  | 'lateral-raise-dumbbells'
  | 'row-cables'
  | 'hack-squat-machine'
  | 'preacher-curl-dumbbells'
  | 'overhead-press-machine'
  // Additional arm exercises
  | 'tricep-pushdown-cables'
  | 'hammer-curl-dumbbells'
  | 'bicep-curl-cables'
  | 'tricep-extension-dumbbells'
  | 'skull-crushers-dumbbells'
  | 'overhead-tricep-extension-cables'
  // Additional shoulder exercises
  | 'rear-delt-fly-dumbbells'
  | 'rear-delt-fly-cables'
  | 'arnold-press-dumbbells'
  | 'lateral-raise-cables';

// All featured lifts (main + secondary)
export type FeaturedLiftType = MainLiftType | FeaturedSecondaryLiftType;

// Main Lift Constants - Use these instead of hardcoded strings
export const MAIN_LIFTS = {
  SQUAT: 'squat-barbell' as const,
  BENCH_PRESS: 'bench-press-barbell' as const,
  DEADLIFT: 'deadlift-barbell' as const,
  OVERHEAD_PRESS: 'overhead-press-barbell' as const,
} as const;

// Featured Secondary Lift Constants
export const FEATURED_SECONDARY_LIFTS = {
  BENCH_PRESS_DUMBBELLS: 'bench-press-dumbbells' as const,
  BICEP_CURL_DUMBBELLS: 'bicep-curl-dumbbells' as const,
  BICEP_CURL_BARBELL: 'bicep-curl-barbell' as const,
  LEG_PRESS_MACHINE: 'leg-press-machine' as const,
  ROW_BARBELL: 'row-barbell' as const,
  INCLINE_BENCH_PRESS_BARBELL: 'incline-bench-press-barbell' as const,
  LAT_PULLDOWN_CABLES: 'lat-pulldown-cables' as const,
  LEG_EXTENSION_MACHINE: 'leg-extension-machine' as const,
  ROMANIAN_DEADLIFT_BARBELL: 'romanian-deadlift-barbell' as const,
  INCLINE_BENCH_PRESS_DUMBBELLS: 'incline-bench-press-dumbbells' as const,
  SHOULDER_PRESS_DUMBBELLS: 'shoulder-press-dumbbells' as const,
  FRONT_SQUAT_BARBELL: 'front-squat-barbell' as const,
  HIP_THRUST_BARBELL: 'hip-thrust-barbell' as const,
  LATERAL_RAISE_DUMBBELLS: 'lateral-raise-dumbbells' as const,
  ROW_CABLES: 'row-cables' as const,
  HACK_SQUAT_MACHINE: 'hack-squat-machine' as const,
  PREACHER_CURL_DUMBBELLS: 'preacher-curl-dumbbells' as const,
  OVERHEAD_PRESS_MACHINE: 'overhead-press-machine' as const,
  // Additional arm exercises
  TRICEP_PUSHDOWN_CABLES: 'tricep-pushdown-cables' as const,
  HAMMER_CURL_DUMBBELLS: 'hammer-curl-dumbbells' as const,
  BICEP_CURL_CABLES: 'bicep-curl-cables' as const,
  TRICEP_EXTENSION_DUMBBELLS: 'tricep-extension-dumbbells' as const,
  SKULL_CRUSHERS_DUMBBELLS: 'skull-crushers-dumbbells' as const,
  OVERHEAD_TRICEP_EXTENSION_CABLES: 'overhead-tricep-extension-cables' as const,
  // Additional shoulder exercises
  REAR_DELT_FLY_DUMBBELLS: 'rear-delt-fly-dumbbells' as const,
  REAR_DELT_FLY_CABLES: 'rear-delt-fly-cables' as const,
  ARNOLD_PRESS_DUMBBELLS: 'arnold-press-dumbbells' as const,
  LATERAL_RAISE_CABLES: 'lateral-raise-cables' as const,
} as const;

// Array of all main lifts for iteration
export const ALL_MAIN_LIFTS: MainLiftType[] = Object.values(MAIN_LIFTS);

// Array of all featured secondary lifts for iteration
export const ALL_FEATURED_SECONDARY_LIFTS: FeaturedSecondaryLiftType[] = Object.values(FEATURED_SECONDARY_LIFTS);

// Array of all featured lifts (main + secondary) for iteration
export const ALL_FEATURED_LIFTS: FeaturedLiftType[] = [...ALL_MAIN_LIFTS, ...ALL_FEATURED_SECONDARY_LIFTS];

// Helper to check if an exercise ID is a main lift
export const isMainLift = (exerciseId: string): exerciseId is MainLiftType => {
  return ALL_MAIN_LIFTS.includes(exerciseId as MainLiftType);
};

// Helper to check if an exercise ID is a featured secondary lift
export const isFeaturedSecondaryLift = (exerciseId: string): exerciseId is FeaturedSecondaryLiftType => {
  return ALL_FEATURED_SECONDARY_LIFTS.includes(exerciseId as FeaturedSecondaryLiftType);
};

// Helper to check if an exercise ID is any featured lift (main or secondary)
export const isFeaturedLift = (exerciseId: string): exerciseId is FeaturedLiftType => {
  return isMainLift(exerciseId) || isFeaturedSecondaryLift(exerciseId);
};

// ===== USER PROFILE TYPES =====

export interface UserProfile {
  height: {
    value: number;
    unit: HeightUnit;
  };
  weight: {
    value: number;
    unit: WeightUnit;
  };
  gender: Gender;
  age?: number;
  trainingYears?: number;  // Self-reported years of consistent strength training
  lifts: UserLift[];
  secondaryLifts: UserLift[];
  weightUnitPreference: WeightUnit;
  equipmentFilter?: EquipmentFilter;
  username?: string;
}

// ===== TRAINING ADVANCEMENT TYPES =====

export type TrainingAdvancement = 'beginner' | 'intermediate' | 'advanced';

export interface TrainingAdvancementResult {
  level: TrainingAdvancement;
  source: 'percentile' | 'training_years' | 'default';
  confidence: 'high' | 'medium' | 'low';
  percentile?: number;
  trainingYears?: number;
}

// ===== WORKOUT TYPES =====

export interface Workout {
  id: string;
  name: string;
  category: WorkoutCategory;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment[];
  description: string;
  isMainLift: boolean;
  themeLevel: ThemeLevel;
  trackingType?: TrackingType; // How sets are logged: 'reps' (default), 'timed', or 'cardio'
}

export interface UserProgress {
  workoutId: string;
  personalRecord: number; // in lbs
  lastUpdated: Date;
  percentileRanking: number; // 0-100 (calculated from real standards)
  strengthLevel: string; // 'E-', 'D', 'C+', 'B', 'A-', 'S', 'S++', etc.
}

// ===== WORKOUT SESSION TYPES =====

export interface WorkoutSetCompletion {
  setNumber: number;
  weight: number;
  reps: number;
  unit: WeightUnit;
  completed: boolean;
  restStartTime?: Date;
  // For timed/cardio exercises
  duration?: number;  // Duration in seconds (for 'timed' and 'cardio' tracking types)
  distance?: number;  // Distance in meters (for 'cardio' tracking type)
}

export interface WorkoutExerciseSession extends ExerciseSet {
  completedSets: WorkoutSetCompletion[];
  isCompleted: boolean;
}

export interface ActiveWorkoutSession {
  id: string;
  workoutId: string;
  title: string;
  exercises: WorkoutExerciseSession[];
  startTime: Date;
  // i can probably remove this and just use the exercises array
  currentExerciseIndex: number;
  // i can probably remove this and just use the exercises array
  currentSetIndex: number;
  isCompleted: boolean;
  totalRestTime: number; // in seconds
}

export const convertActiveWorkoutSessionToGeneratedWorkout = (activeWorkoutSession: ActiveWorkoutSession): GeneratedWorkout => {
  return {
    id: activeWorkoutSession.id,
    title: activeWorkoutSession.title,
    exercises: activeWorkoutSession.exercises,
    description: '',
    estimatedDuration: 0,
    difficulty: '',
    createdAt: new Date(),
  };
};

// ===== AI WORKOUT TYPES =====

// Minimal exercise structure - just what AI provides
export interface ExerciseSet {
  id: string;
  sets: number;
  reps: string;
}

// ===== ROUTINE TYPES =====

// Intensity modifier affects what percentage of working weight to use
export type IntensityModifier = 'heavy' | 'moderate' | 'light';

// A single set in a routine exercise
export interface RoutineSet {
  reps: number;
  isWarmup?: boolean;  // Warmup sets use lower percentage (~50-60%)
}

// A single exercise in a routine (just structure, weights calculated dynamically)
export interface RoutineExercise {
  exerciseId: string;
  exerciseName?: string;  // Stored at creation time for display (avoids lookups, supports custom exercises)
  sets: RoutineSet[];  // Array of individual sets
  intensityModifier?: IntensityModifier;
  notes?: string;
}

// Common workout split types
export type SplitType =
  | 'push'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'lower'
  | 'full_body'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'custom';

export const SPLIT_TYPE_LABELS: Record<SplitType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  upper: 'Upper',
  lower: 'Lower',
  full_body: 'Full Body',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  cardio: 'Cardio',
  custom: 'Custom',
};

// The routine itself - stores structure only, no weights
export interface Routine {
  id: string;
  name: string;
  description?: string;
  splitType?: SplitType;
  exercises: RoutineExercise[];
  createdAt: Date;
  lastUsed?: Date;
  isActive?: boolean;  // Active routines show in "Up Next", inactive are archived
}

// Calculated set with weight
export interface CalculatedSet extends RoutineSet {
  targetWeight: number;
}

// Calculated values when displaying/using a routine
export interface CalculatedRoutineExercise extends Omit<RoutineExercise, 'sets'> {
  exerciseName: string;
  sets: CalculatedSet[];  // Sets with calculated weights
  workingWeight: number;  // The main working weight (for display)
  lastPerformed?: {
    weight: number;
    reps: number;
    date: Date;
    completed: boolean;  // Did they hit all sets at target?
  };
  progression: 'increase' | 'maintain' | 'decrease';
  unit: WeightUnit;
  estimated1RM?: number;
}

// Full calculated routine ready for display
export interface CalculatedRoutine extends Omit<Routine, 'exercises'> {
  exercises: CalculatedRoutineExercise[];
}

// Simplified workout using existing types
export interface GeneratedWorkout {
  id: string;
  title: string;
  description: string;
  exercises: WorkoutExerciseSession[];
  estimatedDuration: number;
  difficulty: string;
  createdAt: Date;
  // day of week for routines
  dayOfWeek?: DayOfWeek;
}

export interface WorkoutContext {
  userProfile: UserProfile;
  userProgress: UserProgress[];
  availableEquipment: Equipment[];
  workoutHistory: GeneratedWorkout[];
  customExercises?: CustomExercise[];
  preferences: {
    duration?: number;
    focusAreas?: MuscleGroup[];
    excludeBodyweight?: boolean;
  };
}

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

// ===== STORAGE TYPES =====

export interface UserPreferences {
  preferredEquipment: string[];
  workoutDuration: number; // minutes
  excludeBodyweight: boolean;
  favoriteExercises: string[];
  notifications: boolean;
}

// Custom user-created exercise (same structure as Workout but user-created)
export interface CustomExercise extends Workout {
  isCustom: true;       // Override to always be true
  createdAt: Date;      // When the user created this exercise
}

// Workout template (saved workout notes for reuse)
export interface WorkoutTemplate {
  id: string;
  name: string;
  noteText: string;  // The workout note format (e.g., "Bench Press 135x10, 145x8")
  createdAt: Date;
  lastUsed?: Date;
}

// Lift Display Filters for "Your Lifts" section
export interface LiftDisplayFilters {
  hiddenLiftIds: string[]; // Exercise IDs to hide from the main dashboard
}

export interface ExerciseMax {
  id: string;
  maxWeight: number;
  unit: WeightUnit;
  reps: number; // what rep max this represents (1RM, 5RM, etc.)
  calculatedOneRM: number; // calculated 1 rep max
  lastUpdated: Date;
}

// ===== USER SERVICE TYPES =====

export interface UserLift {
  // the id of the parent active workout session
  parentId: string;
  id: MainLiftType | string;
  weight: number;
  reps: number;
  unit: WeightUnit;
  dateRecorded: Date;
}

// ===== EXERCISE HISTORY TYPES =====

// Single history entry for an exercise
export interface ExerciseHistoryEntry {
  weight: number;
  reps: number;
  date: Date;
  unit: WeightUnit;
}

// Exercise with computed max stats (used in history views)
export interface ExerciseWithMax {
  id: string;
  name: string;
  maxWeight: number;
  maxReps: number;
  estimated1RM: number;
  isCustom: boolean;
  lastUsed?: Date;
  history: ExerciseHistoryEntry[];
}

// ===== STRENGTH STANDARDS TYPES =====

export interface StrengthStandard {
  beginner: number;    // ~10th percentile
  intermediate: number; // ~25th percentile
  advanced: number;    // ~50th percentile
  elite: number;       // ~75th percentile
  god: number;         // ~90th percentile
}

// ===== SOCIAL TYPES =====

// User profile data stored in Supabase
export interface RemoteUserData {
  height?: {
    value: number;
    unit: HeightUnit;
  };
  weight?: {
    value: number;
    unit: WeightUnit;
  };
  gender?: Gender;
  instagram_username?: string;
  tiktok_username?: string;
  discord_username?: string;
}

// Remote user from Supabase
export interface RemoteUser {
  id: string;
  device_id: string;
  username: string;
  user_data?: RemoteUserData;
  country_code?: string;
  profile_picture_url?: string;
  created_at?: Date;
  updated_at?: Date;
}

// Friend relationship
export interface Friend {
  id: string;
  user: RemoteUser;
  created_at: Date;
}

// Leaderboard entry for comparing lifts
export interface LeaderboardEntry {
  user: RemoteUser;
  exercise_id: string;
  estimated_1rm: number;
  weight: number;
  reps: number;
  recorded_at: Date;
  rank?: number;
  strength_tier?: string; // e.g., "S+", "A-", "B"
}

// Muscle group percentiles
export interface MuscleGroupPercentiles {
  chest: number;
  back: number;
  shoulders: number;
  arms: number;
  legs: number;
  glutes: number;
}

// Top contribution for overall strength
export interface TopContribution {
  exercise_id: string;
  name: string;
  percentile: number;
  weight?: number; // 1RM in lbs
}

// User percentile data for overall strength leaderboard
export interface UserPercentileData {
  user_id: string;
  overall_percentile: number;
  strength_level: string;
  muscle_groups: MuscleGroupPercentiles;
  top_contributions: TopContribution[];
  updated_at?: Date;
}

// Overall leaderboard entry
export interface OverallLeaderboardEntry {
  user: RemoteUser;
  overall_percentile: number;
  strength_level: string;
  muscle_groups: MuscleGroupPercentiles;
  top_contributions: TopContribution[];
  rank?: number;
}

// Notification types
export type NotificationType = 'friend_pr' | 'friend_workout';

export interface NotificationData {
  exercise_id?: string;
  exercise_name?: string;
  weight?: number;
  previous_pr?: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  from_user: RemoteUser;
  data: NotificationData;
  read: boolean;
  created_at: Date;
}

// ===== UTILITY FUNCTIONS =====

// Convert height between units
export const convertHeight = (value: number, fromUnit: HeightUnit, toUnit: HeightUnit): number => {
  if (fromUnit === toUnit) return value;
  
  if (fromUnit === 'feet' && toUnit === 'cm') {
    return Math.round(value * 30.48);
  }
  
  if (fromUnit === 'cm' && toUnit === 'feet') {
    return Math.round((value / 30.48) * 10) / 10;
  }
  
  return value;
};

// Convert weight between units
export const convertWeight = (value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number => {
  if (fromUnit === toUnit) return value;
  
  if (fromUnit === 'lbs' && toUnit === 'kg') {
    return Math.round((value * 0.453592) * 10) / 10;
  }
  
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return Math.round((value / 0.453592) * 10) / 10;
  }
  
  return value;
};

// Format height for display
export const formatHeight = (height: UserProfile['height']): string => {
  if (height.unit === 'feet') {
    const feet = Math.floor(height.value);
    const inches = Math.round((height.value - feet) * 12);
    return `${feet}'${inches}"`;
  }
  return `${height.value} cm`;
};

// Format weight for display
export const formatWeight = (weight: UserProfile['weight']): string => {
  return `${weight.value} ${weight.unit}`;
}; 