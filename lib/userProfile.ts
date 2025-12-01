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
  beginner_dark: {
    displayName: 'Beginner Dark',
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
  share_warm: {
    displayName: 'Dream Land',
    requiredPercentile: -1, // Special value for shareable themes
    description: '🍭 Share to unlock (1 share needed)',
  },
  share_cool: {
    displayName: 'Anime Night',
    requiredPercentile: -1, // Special value for shareable themes
    description: '🌙 Share to unlock (3 shares needed)',
  },
};

// Get theme display name
export const getThemeDisplayName = (level: ThemeLevel): string => {
  return THEME_CONFIG[level]?.displayName ?? 'Unknown';
};

// Get theme unlock requirement
export const getThemeRequirement = (level: ThemeLevel): string => {
  return THEME_CONFIG[level]?.description ?? '';
};

// Get required percentile for theme level
export const getThemeRequiredPercentile = (level: ThemeLevel): number => {
  return THEME_CONFIG[level]?.requiredPercentile ?? 0;
};

// Check if theme is unlocked based on user's percentile or share status
export const isThemeUnlocked = (level: ThemeLevel, userPercentile: number, shareCount: number = 0): boolean => {
  // For shareable themes, check share count milestones
  if (level === 'share_warm') {
    return shareCount >= 1; // Bauhaus unlocks at 1 share
  }
  if (level === 'share_cool') {
    return shareCount >= 3; // Uncle Iroh unlocks at 3 shares
  }
  // For fitness themes, check percentile
  return userPercentile >= getThemeRequiredPercentile(level);
};

// Get theme level order for progression
export const getThemeOrder = (level: ThemeLevel): number => {
  const order: Record<ThemeLevel, number> = {
    beginner: 1,
    beginner_dark: 1,  // Same level as beginner (just dark variant)
    intermediate: 2,
    advanced: 3,
    elite: 4,
    god: 5,
    share_warm: 6,  // Shareable themes come after fitness themes
    share_cool: 7,
  };
  return order[level];
};