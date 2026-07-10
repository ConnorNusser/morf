import {
  Gender,
  HeightUnit,
  ThemeLevel,
  UserProfile,
  WeightUnit,
  convertHeight,
  convertWeight,
  formatHeight
} from '@/types';

export {
  Gender,
  HeightUnit, ThemeLevel,
  UserProfile, WeightUnit, convertHeight,
  convertWeight,
  formatHeight
};

export interface OverallStats {
  overallPercentile: number;
  strengthLevel: string;
  improvementTrend: 'improving' | 'stable' | 'declining';
}

export const THEME_CONFIG: Record<ThemeLevel, {
  displayName: string;
  requiredPercentile: number;
  description: string;
}> = {
  beginner: {
    displayName: 'E Tier',
    requiredPercentile: 0,
    description: 'Available to everyone',
  },
  beginner_dark: {
    displayName: 'E Tier Dark',
    requiredPercentile: 0,
    description: 'Available to everyone',
  },
  intermediate: {
    displayName: 'C Tier',
    requiredPercentile: 25,
    description: 'Requires 25th percentile',
  },
  advanced: {
    displayName: 'B Tier',
    requiredPercentile: 50,
    description: 'Requires 50th percentile',
  },
  elite: {
    displayName: 'A Tier',
    requiredPercentile: 75,
    description: 'Requires 75th percentile',
  },
  god: {
    displayName: 'S Tier',
    requiredPercentile: 90,
    description: 'Requires 90th percentile',
  },
  share_warm: {
    displayName: 'Rose',
    requiredPercentile: -1, // -1 marks shareable themes
    description: 'Share Morf once to unlock',
  },
  share_cool: {
    displayName: 'Cyber',
    requiredPercentile: -1,
    description: 'Share Morf 3 times to unlock',
  },
  winter_2026: {
    displayName: 'Winter 2026',
    requiredPercentile: -2, // -2 marks seasonal themes
    description: 'Seasonal · Dec 1 – Mar 20',
  },
};

export const getThemeDisplayName = (level: ThemeLevel): string => {
  return THEME_CONFIG[level]?.displayName ?? 'Unknown';
};

export const getThemeRequirement = (level: ThemeLevel): string => {
  return THEME_CONFIG[level]?.description ?? '';
};

export const getThemeRequiredPercentile = (level: ThemeLevel): number => {
  return THEME_CONFIG[level]?.requiredPercentile ?? 0;
};

export const isThemeUnlocked = (level: ThemeLevel, userPercentile: number, shareCount: number = 0): boolean => {
  if (level === 'share_warm') {
    return shareCount >= 1;
  }
  if (level === 'share_cool') {
    return shareCount >= 3;
  }
  if (level === 'winter_2026') {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();
    // Available Dec 1 - Mar 20
    return month === 11 || month === 0 || month === 1 || (month === 2 && day <= 20);
  }
  return userPercentile >= getThemeRequiredPercentile(level);
};
