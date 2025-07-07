import { Gender, MainLiftType, StrengthStandard } from '@/types';

// Strength standards based on body weight ratios
// Data from real powerlifting competition analysis (809,986 entries)
// Source: van den Hoek et al. 2024 - "Normative data for the squat, bench press and deadlift"
// Aligned with app theme levels
export { StrengthStandard };

// Realistic strength standards as multipliers of body weight
// Based on drug-tested, unequipped powerlifting competition data
export const MALE_STANDARDS: Record<string, StrengthStandard> = {
  squat: {
    beginner: 0.75,      // 10th percentile
    intermediate: 1.2,   // 25th percentile
    advanced: 1.7,       // 50th percentile
    elite: 2.2,          // 75th percentile
    god: 2.8,            // 90th percentile (from study)
  },
  'bench-press': {
    beginner: 0.5,       // 10th percentile
    intermediate: 0.8,   // 25th percentile
    advanced: 1.2,       // 50th percentile
    elite: 1.5,          // 75th percentile
    god: 1.95,           // 90th percentile (from study)
  },
  deadlift: {
    beginner: 1.0,       // 10th percentile
    intermediate: 1.5,   // 25th percentile
    advanced: 2.0,       // 50th percentile
    elite: 2.5,          // 75th percentile
    god: 3.25,           // 90th percentile (from study)
  },
  'overhead-press': {
    beginner: 0.4,       // 10th percentile
    intermediate: 0.6,   // 25th percentile
    advanced: 0.8,       // 50th percentile
    elite: 1.0,          // 75th percentile
    god: 1.3,            // 90th percentile (estimated)
  }
};

export const FEMALE_STANDARDS: Record<string, StrengthStandard> = {
  squat: {
    beginner: 0.5,       // 10th percentile
    intermediate: 0.9,   // 25th percentile
    advanced: 1.3,       // 50th percentile
    elite: 1.7,          // 75th percentile
    god: 2.26,           // 90th percentile (from study)
  },
  'bench-press': {
    beginner: 0.3,       // 10th percentile
    intermediate: 0.5,   // 25th percentile
    advanced: 0.8,       // 50th percentile
    elite: 1.0,          // 75th percentile
    god: 1.35,           // 90th percentile (from study)
  },
  deadlift: {
    beginner: 0.7,       // 10th percentile
    intermediate: 1.1,   // 25th percentile
    advanced: 1.5,       // 50th percentile
    elite: 2.0,          // 75th percentile
    god: 2.66,           // 90th percentile (from study)
  },
  'overhead-press': {
    beginner: 0.25,      // 10th percentile
    intermediate: 0.4,   // 25th percentile
    advanced: 0.6,       // 50th percentile
    elite: 0.8,          // 75th percentile
    god: 1.0,            // 90th percentile (estimated)
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
  console.log('exercise', exercise);
  const standards = gender === 'male' ? MALE_STANDARDS[exercise] : FEMALE_STANDARDS[exercise];
  
  // If no standards exist for this exercise (e.g., secondary lifts), return a default percentile
  if (!standards) {
    console.log('No standards found for exercise:', exercise, 'returning default percentile');
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

// Helper function to get strength level name using theme levels
export function getStrengthLevelName(percentile: number): string {
  if (percentile >= 90) return 'God';
  if (percentile >= 75) return 'Elite';
  if (percentile >= 50) return 'Advanced';
  if (percentile >= 25) return 'Intermediate';
  if (percentile >= 10) return 'Beginner';
  return 'Untrained';
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