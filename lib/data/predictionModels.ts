import { UserProgress } from '@/types';

export interface PredictionModel {
  name: string;
  description: string;
  predict: (data: UserProgress[], days: number) => number;
}

/**
 * Asymptotic regression model - accounts for diminishing returns
 * as you approach genetic potential
 */
export const asymptoticRegression = (data: UserProgress[], targetDays: number): number => {
  if (data.length === 0) return 0;
  if (data.length < 3) {
    // Use simple linear extrapolation for insufficient data
    const currentValue = data[data.length - 1].personalRecord;
    if (data.length === 1) return currentValue;
    const firstValue = data[0].personalRecord;
    const timeSpan = data.length;
    const growthRate = (currentValue - firstValue) / timeSpan;
    return Math.max(currentValue, currentValue + (growthRate * targetDays / 7));
  }

  const values = data.map(d => d.personalRecord);
  const lastValue = values[values.length - 1];
  const firstValue = values[0];

  // Estimate asymptotic maximum (genetic potential estimate)
  const currentMax = Math.max(...values);
  const asymptoticMax = currentMax * 1.15; // Assume 15% potential growth remaining

  // Calculate growth rate parameter
  const totalGrowth = lastValue - firstValue;
  const remainingPotential = asymptoticMax - lastValue;
  const growthRate = totalGrowth / (data.length * 7); // Weekly growth rate

  // Asymptotic prediction
  const predictedGrowth = remainingPotential * (1 - Math.exp(-growthRate * targetDays / 30));
  return Math.max(lastValue, lastValue + predictedGrowth);
};

/**
 * Exponential smoothing model - weighted recent performance with trend analysis
 */
export const exponentialSmoothing = (data: UserProgress[], targetDays: number): number => {
  if (data.length === 0) return 0;
  if (data.length === 1) return data[0].personalRecord;

  const alpha = 0.3; // Smoothing factor
  let smoothedValue = data[0].personalRecord;

  for (let i = 1; i < data.length; i++) {
    smoothedValue = alpha * data[i].personalRecord + (1 - alpha) * smoothedValue;
  }

  // Project forward with trend
  const trend = (data[data.length - 1].personalRecord - smoothedValue) / data.length;
  return Math.max(data[data.length - 1].personalRecord, smoothedValue + (trend * targetDays / 7));
};

/**
 * Pre-configured prediction models
 */
export const predictionModels: PredictionModel[] = [
  {
    name: 'Asymptotic Regression',
    description: 'Accounts for diminishing returns as you approach genetic potential',
    predict: asymptoticRegression
  },
  {
    name: 'Exponential Smoothing',
    description: 'Weighted recent performance with trend analysis',
    predict: exponentialSmoothing
  }
];

/**
 * Calculate average prediction from all models for a given timeframe
 */
export const calculateAveragePrediction = (data: UserProgress[], targetDays: number = 90): number | undefined => {
  if (data.length < 2) return undefined;

  const predictions = predictionModels.map(model => model.predict(data, targetDays));
  const average = predictions.reduce((sum, val) => sum + val, 0) / predictions.length;

  return Math.round(average);
};

/**
 * Calculate predictions for multiple timeframes
 */
export const calculateAllPredictions = (data: UserProgress[]): Record<string, number> => {
  if (data.length === 0) return {};

  const predictions: Record<string, number> = {};
  const timeframes = [30, 90, 180, 365]; // 1M, 3M, 6M, 1Y

  predictionModels.forEach(model => {
    timeframes.forEach(days => {
      const key = `${model.name}_${days}`;
      predictions[key] = model.predict(data, days);
    });
  });

  return predictions;
};
