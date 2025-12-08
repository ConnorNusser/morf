import { MuscleGroup } from '@/types';
import { ALL_WORKOUTS } from './workouts';

// PPL category definitions
export type PPLCategory = 'push' | 'pull' | 'legs';

export const MUSCLE_TO_PPL: Record<MuscleGroup, PPLCategory> = {
  chest: 'push',
  shoulders: 'push',
  back: 'pull',
  arms: 'pull',
  legs: 'legs',
  glutes: 'legs',
  core: 'push',
  'full-body': 'push',
};

export const PPL_COLORS: Record<PPLCategory, string> = {
  push: '#FF6B6B',
  pull: '#4ECDC4',
  legs: '#9B59B6',
};

export const PPL_LABELS: Record<PPLCategory, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
};

export interface PPLBreakdown {
  counts: Record<PPLCategory, number>;
  total: number;
}

export function calculatePPLBreakdown(exercises: { name: string }[]): PPLBreakdown {
  const counts: Record<PPLCategory, number> = { push: 0, pull: 0, legs: 0 };

  exercises.forEach(ex => {
    const exerciseData = ALL_WORKOUTS.find(
      w => w.name.toLowerCase() === ex.name.toLowerCase()
    );
    if (exerciseData && exerciseData.primaryMuscles.length > 0) {
      const primaryMuscle = exerciseData.primaryMuscles[0];
      const pplCategory = MUSCLE_TO_PPL[primaryMuscle];
      if (pplCategory) {
        counts[pplCategory]++;
      }
    }
  });

  const total = counts.push + counts.pull + counts.legs;
  return { counts, total };
}
