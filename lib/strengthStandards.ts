import { Gender, MainLiftType, StrengthStandard } from '@/types';

// Strength standards based on body weight ratios
// Data from real powerlifting competition analysis (809,986 entries)
// Source: van den Hoek et al. 2024 - "Normative data for the squat, bench press and deadlift"
// Aligned with app theme levels
export { StrengthStandard };

// Realistic strength standards as multipliers of body weight
// Based on drug-tested, unequipped powerlifting competition data
export const MALE_STANDARDS: Record<string, StrengthStandard> = {
  'squat-barbell': {
    beginner: 0.75,      // 10th percentile
    intermediate: 1.25,   // 25th percentile
    advanced: 1.5,       // 50th percentile
    elite: 2.2,          // 75th percentile
    god: 2.8,            // 90th percentile (from study)
  },
  'bench-press-barbell': {
    beginner: 0.671,       // 10th percentile
    intermediate: 0.75,   // 25th percentile
    advanced: 1.201,       // 50th percentile
    elite: 1.532,          // 75th percentile
    god: 2.169,           // 90th percentile (from study)
  },
  'deadlift-barbell': {
    beginner: 1.069,       // 10th percentile
    intermediate: 1.415,   // 25th percentile
    advanced: 1.832,       // 50th percentile
    elite: 2.504,          // 75th percentile
    god: 3.227,           // 90th percentile (from study)
  },
  'overhead-press-barbell': {
    beginner: 0.414,       // 10th percentile
    intermediate: 0.580,   // 25th percentile
    advanced: 0.783,       // 50th percentile
    elite: 1.018,          // 75th percentile
    god: 1.463,            // 90th percentile (estimated)
  },
  'bench-press-dumbbells': {
    beginner: 0.225,       // 10th percentile
    intermediate: 0.348,   // 25th percentile
    advanced: 0.507,       // 50th percentile
    elite: .695,          // 75th percentile
    god: .904,            // 90th percentile (estimated)
  },
  'bicep-curl-dumbbells': {
    beginner: 0.091,       // 10th percentile
    intermediate: 0.175,   // 25th percentile
    advanced: 0.292,       // 50th percentile
    elite: 0.439,          // 75th percentile
    god: 0.699,            // 90th percentile (estimated)
  },
  'bicep-curl-barbell': {
    beginner: 0.108,       // 10th percentile
    intermediate: 0.213,   // 25th percentile
    advanced: 0.362,       // 50th percentile
    elite: 0.550,          // 75th percentile
    god: .884,            // 90th percentile (estimated)
  },
  'leg-press-machine': {
    beginner: 1.0,       // 10th percentile
    intermediate: 1.75,   // 25th percentile
    advanced: 2.75,       // 50th percentile
    elite: 4.0,          // 75th percentile
    god: 5.25,           // 90th percentile (estimated)
  },
  'row-barbell': {
    beginner: 0.5,       // 10th percentile
    intermediate: .75,   // 25th percentile
    advanced: 1.0,       // 50th percentile
    elite: 1.50,          // 75th percentile
    god: 1.75,            // 90th percentile (estimated)
  },
  'incline-bench-press-barbell': {
    beginner: 0.5,       // 10th percentile
    intermediate: 0.75,   // 25th percentile
    advanced: 1.0,       // 50th percentile
    elite: 1.50,          // 75th percentile
    god: 1.75,           // 90th percentile (from study)
  },
  'lat-pulldown-cables': {
    beginner: 0.5,       // 10th percentile
    intermediate: 0.75,   // 25th percentile
    advanced: 1.0,       // 50th percentile
    elite: 1.50,          // 75th percentile
    god: 1.75,           // 90th percentile (from study)
  },
  'leg-extension-machine': {
    beginner: 0.5,       // 10th percentile
    intermediate: 0.75,   // 25th percentile
    advanced: 1.25,       // 50th percentile
    elite: 1.75,          // 75th percentile
    god: 2.50,           // 90th percentile (from study)
  },
  'romanian-deadlift-barbell': {
    beginner: 0.75,       // 10th percentile
    intermediate: 1.00,   // 25th percentile
    advanced: 1.50,       // 50th percentile
    elite: 2.00,          // 75th percentile
    god: 2.75,           // 90th percentile (from study)
  },
  'incline-bench-press-dumbbells': {
    beginner: 0.25,       // 10th percentile
    intermediate: 0.35,   // 25th percentile
    advanced: 0.50,       // 50th percentile
    elite: 0.65,          // 75th percentile
    god: 0.85,           // 90th percentile (from study)
  },
  'shoulder-press-dumbbells': {
    beginner: 0.15,       // 10th percentile
    intermediate: 0.25,   // 25th percentile
    advanced: 0.40,       // 50th percentile
    elite: 0.60,          // 75th percentile
    god: 0.75,           // 90th percentile (from study)
  },
  'front-squat-barbell': {
    beginner: 0.75,       // 10th percentile
    intermediate: 1.0,   // 25th percentile
    advanced: 1.25,       // 50th percentile
    elite: 1.75,          // 75th percentile
    god: 2.25,           // 90th percentile (from study)
  },
  'hip-thrust-barbell': {
    beginner: 0.5,       // 10th percentile
    intermediate: 1.0,   // 25th percentile
    advanced: 1.75,       // 50th percentile
    elite: 2.50,          // 75th percentile
    god: 3.50,           // 90th percentile (from study)
  },
  'lateral-raise-dumbbells': {
    beginner: 0.05,       // 10th percentile
    intermediate: 0.10,   // 25th percentile
    advanced: 0.20,       // 50th percentile
    elite: 0.30,          // 75th percentile
    god: 0.45,           // 90th percentile (from study)
  },
  'row-cables': {
    beginner: 0.50,       // 10th percentile
    intermediate: 0.75,   // 25th percentile
    advanced: 1.00,       // 50th percentile
    elite: 1.50,          // 75th percentile
    god: 2.00,            // 90th percentile (estimated)
  },
  'hack-squat-machine': {
    beginner: 0.75,       // 10th percentile
    intermediate: 1.25,   // 25th percentile
    advanced: 2.00,       // 50th percentile
    elite: 2.75,          // 75th percentile
    god: 4.00,            // 90th percentile (estimated)
  },
  'preacher-curl-dumbbells': {
    beginner: 0.20,       // 10th percentile
    intermediate: 0.35,   // 25th percentile
    advanced: 0.60,       // 50th percentile
    elite: 0.85,          // 75th percentile
    god: 1.10,           // 90th percentile (from study)
  },
  'overhead-press-machine': {
    beginner: 0.25,       // 10th percentile
    intermediate: 0.5,   // 25th percentile
    advanced: 1.00,       // 50th percentile
    elite: 1.50,          // 75th percentile
    god: 2.00,           // 90th percentile (from study)
  }
};

export const FEMALE_STANDARDS: Record<string, StrengthStandard> = {
  'squat-barbell': {
    beginner: 0.5,       // 10th percentile
    intermediate: 0.75,   // 25th percentile
    advanced: 1.25,       // 50th percentile
    elite: 1.50,          // 75th percentile
    god: 2.00,           // 90th percentile (from study)
  },
  'bench-press-barbell': {
    beginner: 0.25,       // 10th percentile
    intermediate: 0.5,   // 25th percentile
    advanced: 0.8,       // 50th percentile
    elite: 1.0,          // 75th percentile
    god: 1.50,           // 90th percentile (from study)
  },
  'deadlift-barbell': {
    beginner: 0.594,       // 10th percentile
    intermediate: .887,   // 25th percentile
    advanced: 1.261,       // 50th percentile
    elite: 1.698,          // 75th percentile
    god: 2.504,           // 90th percentile (from study)
  },
  'overhead-press-barbell': {
    beginner: 0.204,      // 10th percentile
    intermediate: 0.328,   // 25th percentile
    advanced: 0.490,       // 50th percentile
    elite: 0.686,          // 75th percentile
    god: 1.040,            // 90th percentile (estimated)
  },
  'bench-press-dumbbells': {
    beginner: 0.095,       // 10th percentile
    intermediate: 0.183,   // 25th percentile
    advanced: 0.305,       // 50th percentile
    elite: .461,          // 75th percentile
    god: .641,            // 90th percentile (estimated)
  },
  'bicep-curl-dumbbells': {
    beginner: 0.058,       // 10th percentile
    intermediate: 0.116,   // 25th percentile
    advanced: 0.200,       // 50th percentile
    elite: 0.306,          // 75th percentile
    god: 0.494,            // 90th percentile (estimated)
  },
  'bicep-curl-barbell': {
    beginner: 0.108,       // 10th percentile
    intermediate: 0.213,   // 25th percentile
    advanced: 0.362,       // 50th percentile
    elite: 0.550,          // 75th percentile
    god: .884,            // 90th percentile (estimated)
  },
  'leg-press-machine': {
    beginner: 0.5,       // 10th percentile
    intermediate: 1.25,   // 25th percentile
    advanced: 2.0,       // 50th percentile
    elite: 3.25,          // 75th percentile
    god: 4.5,            // 90th percentile (estimated)
  },
  'row-barbell': {
    beginner: 0.25,       // 10th percentile
    intermediate: .4,   // 25th percentile
    advanced: .65,       // 50th percentile
    elite: .9,          // 75th percentile
    god: 1.2,            // 90th percentile (estimated)
  },
  'incline-bench-press-barbell': {
    beginner: 0.2,       // 10th percentile
    intermediate: 0.4,   // 25th percentile
    advanced: 0.65,       // 50th percentile
    elite: 1.00,          // 75th percentile
    god: 1.40,           // 90th percentile (from study)
  },
  'lat-pulldown-cables': {
    beginner: 0.3,       // 10th percentile
    intermediate: 0.45,   // 25th percentile
    advanced: 0.70,       // 50th percentile
    elite: 0.95,          // 75th percentile
    god: 1.30,           // 90th percentile (from study)
  },
  'leg-extension-machine': {
    beginner: 0.25,       // 10th percentile
    intermediate: 0.50,   // 25th percentile
    advanced: 1.00,       // 50th percentile
    elite: 1.25,          // 75th percentile
    god: 2.00,           // 90th percentile (from study)
  },
  'romanian-deadlift-barbell': {
    beginner: 0.50,       // 10th percentile
    intermediate: 0.75,   // 25th percentile
    advanced: 1.00,       // 50th percentile
    elite: 1.50,          // 75th percentile
    god: 1.75,           // 90th percentile (from study)
  },
  'incline-bench-press-dumbbells': {
    beginner: 0.1,       // 10th percentile
    intermediate: 0.2,   // 25th percentile
    advanced: 0.30,       // 50th percentile
    elite: 0.45,          // 75th percentile
    god: 0.60,           // 90th percentile (from study)
  },
  'shoulder-press-dumbbells': {
    beginner: 0.10,       // 10th percentile
    intermediate: 0.15,   // 25th percentile
    advanced: 0.25,       // 50th percentile
    elite: 0.35,          // 75th percentile
    god: 0.50,           // 90th percentile (from study)
  },
  'front-squat-barbell': {
    beginner: 0.50,       // 10th percentile
    intermediate: 0.75,   // 25th percentile
    advanced: 1.0,       // 50th percentile
    elite: 1.25,          // 75th percentile
    god: 1.50,           // 90th percentile (from study)
  },
  'hip-thrust-barbell': {
    beginner: 0.50,       // 10th percentile
    intermediate: 1.00,   // 25th percentile
    advanced: 1.5,       // 50th percentile
    elite: 2.25,          // 75th percentile
    god: 3.00,           // 90th percentile (from study)
  },
  'lateral-raise-dumbbells': {
    beginner: 0.05,       // 10th percentile
    intermediate: 0.10,   // 25th percentile
    advanced: 0.15,       // 50th percentile
    elite: 0.20,          // 75th percentile
    god: 0.30,           // 90th percentile (from study)
  },
  'row-cables': {
    beginner: 0.30,       // 10th percentile
    intermediate: 0.50,   // 25th percentile
    advanced: 0.75,       // 50th percentile
    elite: 1.00,          // 75th percentile
    god: 1.35,            // 90th percentile (estimated)
  },
  'hack-squat-machine': {
    beginner: 0.25,       // 10th percentile
    intermediate: 0.75,   // 25th percentile
    advanced: 1.50,       // 50th percentile
    elite: 2.25,          // 75th percentile
    god: 3.25,            // 90th percentile (estimated)
  },
  'preacher-curl-dumbbells': {
    beginner: 0.10,       // 10th percentile
    intermediate: 0.20,   // 25th percentile
    advanced: 0.40,       // 50th percentile
    elite: 0.60,          // 75th percentile
    god: 0.85,           // 90th percentile (from study)
  },
  'overhead-press-machine': {
    beginner: 0.10,       // 10th percentile
    intermediate: 0.25,   // 25th percentile
    advanced: 0.50,       // 50th percentile
    elite: 0.85,          // 75th percentile
    god: 1.20,           // 90th percentile (from study)
  }
};

// Age adjustment factors (strength typically peaks in 20s-30s)
// Based on research showing strength decline with age
export const AGE_ADJUSTMENT_FACTORS: Record<string, number> = {
  '18-25': 1.0,
  '26-35': 1.0,
  '36-45': 0.95,
  '46-55': 0.90,
  '56-65': 0.85,
  '65+': 0.80
};

export function getAgeCategory(age: number): string {
  if (age >= 18 && age <= 25) return '18-25';
  if (age >= 26 && age <= 35) return '26-35';
  if (age >= 36 && age <= 45) return '36-45';
  if (age >= 46 && age <= 55) return '46-55';
  if (age >= 56 && age <= 65) return '56-65';
  return '65+';
}

export function calculateStrengthPercentile(
  liftWeight: number,
  bodyWeight: number,
  gender: Gender,
  exercise: MainLiftType | string,
  age?: number
): number {
  // Get the appropriate standards based on gender
  const standards = gender === 'male' ? MALE_STANDARDS[exercise] : FEMALE_STANDARDS[exercise];
  
  // If no standards exist for this exercise (e.g., secondary lifts), return a default percentile
  if (!standards) {
    return 50; // Default to 50th percentile for exercises without standards
  }
  
  // Calculate the ratio (lift weight / body weight)
  let ratio = liftWeight / bodyWeight;
  
  // Apply age adjustment if age is provided
  if (age) {
    const ageCategory = getAgeCategory(age);
    const ageFactor = AGE_ADJUSTMENT_FACTORS[ageCategory];
    ratio = ratio / ageFactor; // Adjust for age decline
  }
  
  // Determine percentile based on ratio using realistic distributions
  if (ratio <= standards.beginner) {
    // Below 10th percentile - linear interpolation from 0 to 10
    return Math.max(0, (ratio / standards.beginner) * 10);
  } else if (ratio <= standards.intermediate) {
    // 10th to 25th percentile
    const progress = (ratio - standards.beginner) / (standards.intermediate - standards.beginner);
    return 10 + (progress * 15);
  } else if (ratio <= standards.advanced) {
    // 25th to 50th percentile
    const progress = (ratio - standards.intermediate) / (standards.advanced - standards.intermediate);
    return 25 + (progress * 25);
  } else if (ratio <= standards.elite) {
    // 50th to 75th percentile
    const progress = (ratio - standards.advanced) / (standards.elite - standards.advanced);
    return 50 + (progress * 25);
  } else if (ratio <= standards.god) {
    // 75th to 90th percentile
    const progress = (ratio - standards.elite) / (standards.god - standards.elite);
    return 75 + (progress * 15);
  } else {
    // Above 90th percentile - cap at 99th percentile
    return Math.min(99, 90 + ((ratio - standards.god) / (standards.god * 0.2)) * 9);
  }
}

// Anime-style tier system (E -> S++) with plus/minus modifiers
export type StrengthTierBase = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
export type StrengthTier = 'S++' | 'S+' | 'S' | 'S-' | 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'E+' | 'E' | 'E-';

export interface TierInfo {
  tier: StrengthTier;
  baseTier: StrengthTierBase;
  color: string;
  label: string;
}

// Tier colors - vibrant anime style (base colors for each tier)
export const TIER_COLORS: Record<StrengthTierBase, string> = {
  'S': '#FFD700', // Gold (Legendary)
  'A': '#9932CC', // Purple (Epic)
  'B': '#4169E1', // Royal Blue (Rare)
  'C': '#2E8B57', // Sea Green (Uncommon)
  'D': '#808080', // Gray (Common)
  'E': '#808080', // Gray (Common)
};

// Get the base tier (without +/-/++) for color lookup
export function getBaseTier(tier: StrengthTier): StrengthTierBase {
  return tier.charAt(0) as StrengthTierBase;
}

// Helper function to get strength tier from percentile (with +/- modifiers)
export function getStrengthTier(percentile: number): StrengthTier {
  // S tier: 85-100 (S++: 99-100, S+: 95-98, S: 90-94, S-: 85-89)
  if (percentile >= 99) return 'S++';
  if (percentile >= 95) return 'S+';
  if (percentile >= 90) return 'S';
  if (percentile >= 85) return 'S-';

  // A tier: 70-84 (A+: 80-84, A: 75-79, A-: 70-74)
  if (percentile >= 80) return 'A+';
  if (percentile >= 75) return 'A';
  if (percentile >= 70) return 'A-';

  // B tier: 47-69 (B+: 63-69, B: 55-62, B-: 47-54)
  if (percentile >= 63) return 'B+';
  if (percentile >= 55) return 'B';
  if (percentile >= 47) return 'B-';

  // C tier: 23-46 (C+: 39-46, C: 31-38, C-: 23-30)
  if (percentile >= 39) return 'C+';
  if (percentile >= 31) return 'C';
  if (percentile >= 23) return 'C-';

  // D tier: 6-22 (D+: 17-22, D: 11-16, D-: 6-10)
  if (percentile >= 17) return 'D+';
  if (percentile >= 11) return 'D';
  if (percentile >= 6) return 'D-';

  // E tier: 0-5 (E+: 3-5, E: 1-2, E-: 0)
  if (percentile >= 3) return 'E+';
  if (percentile >= 1) return 'E';
  return 'E-';
}

// Helper function to get full tier info
export function getTierInfo(percentile: number): TierInfo {
  const tier = getStrengthTier(percentile);
  const baseTier = getBaseTier(tier);
  return {
    tier,
    baseTier,
    color: TIER_COLORS[baseTier],
    label: `${tier} Tier`,
  };
}

// Helper function to get tier color
export function getTierColor(tier: StrengthTier): string {
  return TIER_COLORS[getBaseTier(tier)];
}

// Helper function to get strength level name using theme levels (legacy, returns tier)
export function getStrengthLevelName(percentile: number): string {
  return getStrengthTier(percentile);
}


// Mathematical calculations for 1RM estimation
export class OneRMCalculator {
  // Epley formula: 1RM = weight × (1 + reps/30)
  static epley(weight: number, reps: number): number {
    return Math.round(weight * (1 + reps / 30));
  }

  // Brzycki formula: 1RM = weight × (36 / (37 - reps))
  static brzycki(weight: number, reps: number): number {
    if (reps >= 37) return weight; // Formula breaks down at high reps
    return Math.round(weight * (36 / (37 - reps)));
  }

  // Lombardi formula: 1RM = weight × reps^0.1
  static lombardi(weight: number, reps: number): number {
    return Math.round(weight * Math.pow(reps, 0.1));
  }

  // Average of multiple formulas for better accuracy
  static estimate(weight: number, reps: number): number {
    if (reps === 1) return weight;
    if (reps > 15) return weight; // Formulas not reliable for high reps
    
    const epley = this.epley(weight, reps);
    const brzycki = this.brzycki(weight, reps);
    const lombardi = this.lombardi(weight, reps);
    
    return Math.round((epley + brzycki + lombardi) / 3);
  }

  // Calculate percentage of 1RM for given reps
  static getPercentageFor(reps: number): number {
    const percentages: Record<number, number> = {
      1: 100,
      2: 95,
      3: 93,
      4: 90,
      5: 87,
      6: 85,
      7: 83,
      8: 80,
      9: 77,
      10: 75,
      11: 73,
      12: 70,
    };
    
    return percentages[reps] || 70;
  }

  // Calculate weight for given percentage of 1RM
  static getWeightForPercentage(oneRM: number, percentage: number): number {
    return Math.round((oneRM * percentage) / 100);
  }
} 