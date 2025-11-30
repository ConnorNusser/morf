// ===== CORE TYPES =====

// User demographics
export type Gender = 'male' | 'female' | 'other' | 'prefer-not-to-say';

// Units
export type HeightUnit = 'feet' | 'cm';
export type WeightUnit = 'lbs' | 'kg';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Theme progression levels
export type ThemeLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite' | 'god' | 'share_warm' | 'share_cool';

// ===== EXERCISE TYPES =====

// Exercise categories
export type WorkoutCategory = 'compound' | 'isolation' | 'cardio' | 'flexibility';

export type WorkoutSplit = 'push' | 'pull' | 'legs' | 'full-body' | 'upper-body' | 'lower-body' | 'calisthenics';

// Muscle groups
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'core' | 'full-body';

// Equipment types
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable' | 'kettlebell';

// Main lift exercises
export type MainLiftType = 'squat' | 'bench-press' | 'deadlift' | 'overhead-press';

// Featured secondary lifts that appear on main dashboard (all lifts with strength standards)
export type FeaturedSecondaryLiftType = 
  | 'dumbbell-bench-press'
  | 'dumbbell-curl'
  | 'barbell-curl'
  | 'leg-press'
  | 'barbell-row'
  | 'incline-bench-press'
  | 'lat-pulldown'
  | 'leg-extension'
  | 'romanian-deadlift'
  | 'incline-dumbbell-chest-press'
  | 'dumbbell-shoulder-press'
  | 'front-squat'
  | 'barbell-hip-thrust'
  | 'lateral-raise'
  | 'seated-cable-row'
  | 'hack-squat'
  | 'preacher-curl'
  | 'machine-shoulder-press';

// All featured lifts (main + secondary)
export type FeaturedLiftType = MainLiftType | FeaturedSecondaryLiftType;

// Main Lift Constants - Use these instead of hardcoded strings
export const MAIN_LIFTS = {
  SQUAT: 'squat' as const,
  BENCH_PRESS: 'bench-press' as const,
  DEADLIFT: 'deadlift' as const,
  OVERHEAD_PRESS: 'overhead-press' as const,
} as const;

// Featured Secondary Lift Constants
export const FEATURED_SECONDARY_LIFTS = {
  DUMBBELL_BENCH_PRESS: 'dumbbell-bench-press' as const,
  DUMBBELL_CURL: 'dumbbell-curl' as const,
  BARBELL_CURL: 'barbell-curl' as const,
  LEG_PRESS: 'leg-press' as const,
  BARBELL_ROW: 'barbell-row' as const,
  INCLINE_BENCH_PRESS: 'incline-bench-press' as const,
  LAT_PULLDOWN: 'lat-pulldown' as const,
  LEG_EXTENSION: 'leg-extension' as const,
  ROMANIAN_DEADLIFT: 'romanian-deadlift' as const,
  INCLINE_DUMBBELL_CHEST_PRESS: 'incline-dumbbell-chest-press' as const,
  DUMBBELL_SHOULDER_PRESS: 'dumbbell-shoulder-press' as const,
  FRONT_SQUAT: 'front-squat' as const,
  BARBELL_HIP_THRUST: 'barbell-hip-thrust' as const,
  LATERAL_RAISE: 'lateral-raise' as const,
  SEATED_CABLE_ROW: 'seated-cable-row' as const,
  HACK_SQUAT: 'hack-squat' as const,
  PREACHER_CURL: 'preacher-curl' as const,
  MACHINE_SHOULDER_PRESS: 'machine-shoulder-press' as const,
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
  lifts: UserLift[];
  secondaryLifts: UserLift[];
  weightUnitPreference: WeightUnit;
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
}

export interface UserProgress {
  workoutId: string;
  personalRecord: number; // in lbs
  lastUpdated: Date;
  percentileRanking: number; // 0-100 (calculated from real standards)
  strengthLevel: string; // 'Beginner', 'Novice', 'Intermediate', etc.
}

// ===== WORKOUT SESSION TYPES =====

export interface WorkoutSetCompletion {
  setNumber: number;
  weight: number;
  reps: number;
  unit: WeightUnit;
  completed: boolean;
  restStartTime?: Date;
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
export interface Routine {
  id: string;
  name: string;
  description: string;
  exercises: GeneratedWorkout[];
  createdAt: Date;
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

// Custom user-created exercise
export interface CustomExercise {
  id: string;           // 'custom_' + uuid
  name: string;
  muscleGroup?: MuscleGroup;
  isCustom: true;
  createdAt: Date;
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

// ===== STRENGTH STANDARDS TYPES =====

export interface StrengthStandard {
  beginner: number;    // ~10th percentile
  intermediate: number; // ~25th percentile
  advanced: number;    // ~50th percentile
  elite: number;       // ~75th percentile
  god: number;         // ~90th percentile
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