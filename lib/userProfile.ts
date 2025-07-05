import {
  Gender,
  HeightUnit,
  ThemeLevel,
  UserProfile,
  WeightUnit,
  convertHeight,
  convertWeight,
  formatHeight,
  formatWeight
} from '@/types';

export {
  Gender,
  HeightUnit, ThemeLevel,
  UserProfile, WeightUnit, convertHeight,
  convertWeight,
  formatHeight,
  formatWeight
};

export interface OverallStats {
  overallPercentile: number;
  strengthLevel: string;
  improvementTrend: 'improving' | 'stable' | 'declining';
}

// Theme level configuration
export const THEME_CONFIG: Record<ThemeLevel, {
  displayName: string;
  requiredPercentile: number;
  description: string;
}> = {
  beginner: {
    displayName: 'Beginner',
    requiredPercentile: 0,
    description: 'Available to everyone',
  },
  intermediate: {
    displayName: 'Intermediate', 
    requiredPercentile: 25,
    description: 'Requires 25th percentile',
  },
  advanced: {
    displayName: 'Advanced',
    requiredPercentile: 50, 
    description: 'Requires 50th percentile',
  },
  elite: {
    displayName: 'Elite',
    requiredPercentile: 75,
    description: 'Requires 75th percentile',
  },
  god: {
    displayName: 'God',
    requiredPercentile: 90,
    description: 'Requires 90th percentile',
  },
};

// Get theme display name
export const getThemeDisplayName = (level: ThemeLevel): string => {
  return THEME_CONFIG[level].displayName;
};

// Get theme unlock requirement
export const getThemeRequirement = (level: ThemeLevel): string => {
  return THEME_CONFIG[level].description;
};

// Get required percentile for theme level
export const getThemeRequiredPercentile = (level: ThemeLevel): number => {
  return THEME_CONFIG[level].requiredPercentile;
};

// Check if theme is unlocked based on user's percentile
export const isThemeUnlocked = (level: ThemeLevel, userPercentile: number): boolean => {
  return userPercentile >= getThemeRequiredPercentile(level);
};

// Get theme level order for progression
export const getThemeOrder = (level: ThemeLevel): number => {
  const order: Record<ThemeLevel, number> = {
    beginner: 1,
    intermediate: 2, 
    advanced: 3,
    elite: 4,
    god: 5,
  };
  return order[level];
};