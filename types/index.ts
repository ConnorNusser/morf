// ===== CORE TYPES =====

// User demographics
export type Gender = 'male' | 'female' | 'other' | 'prefer-not-to-say';

// Units
export type HeightUnit = 'feet' | 'cm';
export type WeightUnit = 'lbs' | 'kg';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Theme progression levels
export type ThemeLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite' | 'god';

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

// Main Lift Constants - Use these instead of hardcoded strings
export const MAIN_LIFTS = {
  SQUAT: 'squat' as const,
  BENCH_PRESS: 'bench-press' as const,
  DEADLIFT: 'deadlift' as const,
  OVERHEAD_PRESS: 'overhead-press' as const,
} as const;

// Array of all main lifts for iteration
export const ALL_MAIN_LIFTS: MainLiftType[] = Object.values(MAIN_LIFTS);

// Helper to check if an exercise ID is a main lift
export const isMainLift = (exerciseId: string): exerciseId is MainLiftType => {
  return ALL_MAIN_LIFTS.includes(exerciseId as MainLiftType);
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
  currentExerciseIndex: number;
  currentSetIndex: number;
  isCompleted: boolean;
  totalRestTime: number; // in seconds
}

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
  workoutFilters?: WorkoutFilters;
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

export interface WorkoutFilters {
  excludedWorkoutIds: string[];
  workoutType?: 'powerlifting' | 'bodyweight' | 'generic';
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