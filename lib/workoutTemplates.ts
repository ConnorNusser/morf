import { MuscleGroup } from '@/types';

// Workout classifications with muscle group focus for powerlifting
export const POWERLIFTING_WORKOUT_TEMPLATES = {
  'Push (Chest, Shoulders, Triceps)': {
    primaryMuscles: ['chest', 'shoulders', 'arms'] as MuscleGroup[],
    description: 'Upper body pushing movements for powerlifting strength',
    focusAreas: ['chest', 'shoulders'] as MuscleGroup[],
    requiredPrimaryLifts: ['bench-press', 'overhead-press'],
    powerliftingFocus: 'Bench press technique and overhead pressing strength'
  },
  'Pull (Back, Biceps)': {
    primaryMuscles: ['back', 'arms'] as MuscleGroup[],
    description: 'Upper body pulling movements supporting deadlift strength',
    focusAreas: ['back'] as MuscleGroup[],
    requiredPrimaryLifts: ['deadlift'],
    powerliftingFocus: 'Deadlift support and posterior chain development'
  },
  'Legs (Quads, Glutes, Hamstrings)': {
    primaryMuscles: ['legs', 'glutes'] as MuscleGroup[],
    description: 'Lower body powerlifting foundation - squat and deadlift support',
    focusAreas: ['legs', 'glutes'] as MuscleGroup[],
    requiredPrimaryLifts: ['squat', 'deadlift'],
    powerliftingFocus: 'Squat technique and posterior chain for deadlifts'
  },
  'Upper Body': {
    primaryMuscles: ['chest', 'back', 'shoulders', 'arms'] as MuscleGroup[],
    description: 'Complete upper body powerlifting development',
    focusAreas: ['chest', 'back', 'shoulders'] as MuscleGroup[],
    requiredPrimaryLifts: ['bench-press', 'overhead-press'],
    powerliftingFocus: 'Balanced pressing and pulling for powerlifting'
  },
  'Full Body': {
    primaryMuscles: ['chest', 'back', 'legs', 'shoulders', 'glutes', 'core'] as MuscleGroup[],
    description: 'Comprehensive powerlifting workout hitting all major lifts',
    focusAreas: ['legs', 'chest', 'back'] as MuscleGroup[],
    requiredPrimaryLifts: ['squat', 'bench-press', 'deadlift'],
    powerliftingFocus: 'All three main powerlifts with supporting movements'
  },
  'Powerlifting Specific': {
    primaryMuscles: ['chest', 'back', 'legs', 'glutes'] as MuscleGroup[],
    description: 'Competition-focused powerlifting session',
    focusAreas: ['legs', 'chest', 'back'] as MuscleGroup[],
    requiredPrimaryLifts: ['squat', 'bench-press', 'deadlift'],
    powerliftingFocus: 'Competition lift practice and strength development'
  }
};

// Primary powerlifting exercises that should always be included
export const PRIMARY_POWERLIFTING_LIFTS = [
  'squat',
  'bench-press', 
  'deadlift',
  'overhead-press'
];

// Powerlifting-specific exercise prioritization
export const POWERLIFTING_EXERCISE_PRIORITY = {
  // Primary competition lifts (highest priority)
  primary: ['squat', 'bench-press', 'deadlift'],
  
  // Important accessory lifts
  secondary: [
    'overhead-press', 'front-squat', 'romanian-deadlift', 
    'incline-bench-press', 'pause-bench-press', 'deficit-deadlift',
    'box-squat'
  ],
  
  // Supporting movements
  accessory: [
    'barbell-rows', 'pull-ups', 'dips', 'close-grip-bench-press',
    'bulgarian-split-squat', 'hip-thrust', 'face-pulls'
  ]
};

export type PowerliftingWorkoutTemplate = typeof POWERLIFTING_WORKOUT_TEMPLATES[keyof typeof POWERLIFTING_WORKOUT_TEMPLATES]; 