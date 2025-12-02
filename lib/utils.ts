import { WeightUnit } from "@/types";

const convertWeightToLbs = (weight: number, unit: WeightUnit): number => {
  if (unit === 'kg') {
    return Math.round(weight * 2.20462);
  }
  return weight;
};

const convertWeightToKg = (weight: number, unit: WeightUnit): number => {
  if (unit === 'lbs') {
    return Math.round(weight / 2.20462);
  }
  return weight;
};

// Synchronous version when you already have the user preference
export const convertWeightForPreference = (weight: number, fromUnit: 'lbs' | 'kg', userPreference: 'lbs' | 'kg'): number => {
  if (userPreference === 'kg') {
    return convertWeightToKg(weight, fromUnit);
  }
  return convertWeightToLbs(weight, fromUnit);
};

export const getPercentileSuffix = (percentile: number): string => {
  const mod100 = percentile % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return 'th';
  }

  const lastDigit = percentile % 10;
  switch (lastDigit) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// Calculate overall percentile from individual lift percentiles
export const calculateOverallPercentile = (liftPercentiles: number[]): number => {
  if (liftPercentiles.length === 0) return 0;
  const filteredPercentiles = liftPercentiles.filter(percentile => percentile > 0);
  if (filteredPercentiles.length === 0) return 0;
  const sum = filteredPercentiles.reduce((acc, percentile) => acc + percentile, 0);
  return Math.round(sum / filteredPercentiles.length);
};

export { convertWeightToKg, convertWeightToLbs };
