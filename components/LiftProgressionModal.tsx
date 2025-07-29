import InteractiveProgressChart from '@/components/InteractiveProgressChart';
import ProgressionIndicator from '@/components/ProgressionIndicator';
import { useTheme } from '@/contexts/ThemeContext';
import { FEMALE_STANDARDS, MALE_STANDARDS, OneRMCalculator } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { convertWeightForPreference, getPercentileSuffix } from '@/lib/utils';
import { FeaturedLiftType, UserLift, UserProfile, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LiftProgressionModalProps {
  visible: boolean;
  onClose: () => void;
  liftId: FeaturedLiftType;
  workoutName: string;
}

interface PredictionModel {
  name: string;
  description: string;
  predict: (data: UserProgress[], days: number) => number;
}

export default function LiftProgressionModal({ visible, onClose, liftId, workoutName }: LiftProgressionModalProps) {
  const { currentTheme } = useTheme();
  const [liftData, setLiftData] = useState<UserProgress[]>([]);
  const [originalLiftData, setOriginalLiftData] = useState<UserLift[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('ALL');
  const [selectedMetric, setSelectedMetric] = useState<'oneRM' | 'volume'>('oneRM');
  const [predictions, setPredictions] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [topLift, setTopLift] = useState<UserProgress | null>(null);

  useEffect(() => {
    if (visible) {
      loadLiftData();
    }
  }, [visible, liftId]);

  const loadLiftData = async () => {
    try {
      setIsLoading(true);
      const [data, rawData, profile, allFeaturedLifts] = await Promise.all([
        userService.getAllLiftsForFeaturedExercise(liftId),
        userService.getRawLiftsForFeaturedExercise(liftId),
        userService.getUserProfileOrDefault(),
        userService.getAllFeaturedLifts()
      ]);
      
      // Use the same data source as the home screen for consistency
      const topLift = allFeaturedLifts.find(lift => lift.workoutId === liftId) || null;
      
      setLiftData(data || []);
      setOriginalLiftData(rawData || []);
      setWeightUnit(profile.weightUnitPreference || 'lbs');
      setUserProfile(profile);
      setTopLift(topLift);
      
      if (data && data.length > 0) {
        calculatePredictions(data);
      }
    } catch (error) {
      console.error('Error loading lift data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate next rank target
  const getNextRankInfo = () => {
    if (!userProfile || liftData.length === 0) return null;

    const strengthGender = userProfile.gender === 'female' ? 'female' : 'male';
    const standards = strengthGender === 'male' ? MALE_STANDARDS[liftId] : FEMALE_STANDARDS[liftId];
    
    if (!standards) return null;

    const currentData = liftData[liftData.length - 1];
    const currentPercentile = currentData.percentileRanking;

    // Convert body weight to lbs for calculation
    const bodyWeightLbs = convertWeightForPreference(userProfile.weight.value, userProfile.weight.unit, 'lbs');
    const currentOneRMInDisplayUnits = convertWeightForPreference(topLift?.personalRecord || 0, 'lbs', weightUnit);

    // Define targets in order
    const targets = [
      { name: 'Advanced', multiplier: standards.advanced, threshold: 50 },
      { name: 'Elite', multiplier: standards.elite, threshold: 75 },
      { name: 'God', multiplier: standards.god, threshold: 90 },
    ];

    // Find the next unachieved target
    for (const target of targets) {
      if (currentPercentile < target.threshold) {
        const targetWeightLbs = bodyWeightLbs * target.multiplier;
        const targetInDisplayUnits = convertWeightForPreference(targetWeightLbs, 'lbs', weightUnit);
        
        // Round to 2 decimal places for better display
        const roundedTarget = Math.round(targetInDisplayUnits * 100) / 100;
        const roundedCurrent = Math.round(currentOneRMInDisplayUnits * 100) / 100;
        
        const deficit = Math.max(0, roundedTarget - roundedCurrent);
        
        if (deficit > 0) {
          return {
            level: target.name,
            deficit: Math.round(deficit * 100) / 100,
          };
        }
      }
    }
    
    return null; // Already at God tier
  };

  // Asymptotic regression model for strength predictions
  const asymptoticRegression = (data: UserProgress[], targetDays: number): number => {
    if (data.length === 0) return 0;
    if (data.length < 3) {
      // Use simple linear extrapolation for insufficient data
      const currentValue = data[data.length - 1].personalRecord;
      if (data.length === 1) return currentValue; // No progression data
      const firstValue = data[0].personalRecord;
      const timeSpan = data.length;
      const growthRate = (currentValue - firstValue) / timeSpan;
      return Math.max(currentValue, currentValue + (growthRate * targetDays / 7));
    }
    
    const values = data.map(d => d.personalRecord);
    const lastValue = values[values.length - 1];
    const firstValue = values[0];
    const growthRate = Math.log(lastValue / firstValue) / data.length;
    
    // Asymptotic approach - assumes growth slows as we approach genetic potential
    const geneticPotential = lastValue * 1.3; // Assume 30% more potential
    const currentProgress = (lastValue - firstValue) / (geneticPotential - firstValue);
    const remainingPotential = geneticPotential - lastValue;
    
    // Exponential decay model for remaining growth
    const futureGrowth = remainingPotential * (1 - Math.exp(-growthRate * targetDays / 30));
    return lastValue + futureGrowth;
  };



  // Exponential smoothing model
  const exponentialSmoothing = (data: UserProgress[], targetDays: number): number => {
    if (data.length === 0) return 0;
    if (data.length === 1) return data[0].personalRecord; // No trend data
    
    const alpha = 0.3; // Smoothing factor
    let smoothedValue = data[0].personalRecord;
    
    for (let i = 1; i < data.length; i++) {
      smoothedValue = alpha * data[i].personalRecord + (1 - alpha) * smoothedValue;
    }
    
    // Project forward with trend
    const trend = (data[data.length - 1].personalRecord - smoothedValue) / data.length;
    return Math.max(data[data.length - 1].personalRecord, smoothedValue + (trend * targetDays / 7)); // Weekly trend
  };

  const predictionModels: PredictionModel[] = [
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

  const calculatePredictions = (data: UserProgress[]) => {
    if (data.length === 0) return;
    
    const newPredictions: { [key: string]: number } = {};
    const timeframes = [30, 90, 180, 365]; // 1M, 3M, 6M, 1Y
    
    predictionModels.forEach(model => {
      timeframes.forEach(days => {
        const key = `${model.name}_${days}`;
        newPredictions[key] = model.predict(data, days);
      });
    });
    
    setPredictions(newPredictions);
  };

  const getFilteredData = () => {
    if (!liftData.length) return [];
    
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (selectedTimeframe) {
      case '1M':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return liftData;
    }
    
    return liftData.filter(d => new Date(d.lastUpdated) >= cutoffDate);
  };

  // Calculate average prediction for chart
  const getAveragePrediction = () => {
    if (Object.keys(predictions).length === 0 || liftData.length === 0) return undefined;
    
    const currentData = liftData[liftData.length - 1];
    return Math.round(predictionModels.reduce((sum, model) => {
      return sum + (predictions[`${model.name}_90`] || currentData.personalRecord);
    }, 0) / predictionModels.length);
  };

  const renderCurrentStats = () => {
    if (liftData.length === 0) return null;
    
    const currentData = liftData[liftData.length - 1];
    const nextRank = getNextRankInfo();
    
    // Calculate 3-month prediction average
    const avg3MonthPrediction = Object.keys(predictions).length > 0 
      ? Math.round(predictionModels.reduce((sum, model) => {
          return sum + (predictions[`${model.name}_90`] || topLift?.personalRecord || 0);
        }, 0) / predictionModels.length)
      : 0;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.mainStat}>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80' }]}>
            Current 1RM
          </Text>
          <Text style={[styles.currentValue, { color: currentTheme.colors.text }]}>
            {Math.round(convertWeightForPreference(topLift?.personalRecord || 0, 'lbs', weightUnit) * 100) / 100} {weightUnit}
          </Text>
          {nextRank && (
            <Text style={[styles.nextRankSubtitle, { color: currentTheme.colors.primary }]}>
              {nextRank.deficit} {weightUnit} to {nextRank.level}
            </Text>
          )}
          {avg3MonthPrediction > 0 && (
            <View style={styles.predictionContainer}>
              <Text style={[styles.predictionLabel, { color: currentTheme.colors.text + '70' }]}>
                3-month prediction
              </Text>
              <Text style={[styles.predictionText, { color: currentTheme.colors.primary }]}>
                {Math.round(convertWeightForPreference(avg3MonthPrediction, 'lbs', weightUnit) * 100) / 100} {weightUnit}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Text style={[styles.quickStatValue, { color: currentTheme.colors.text }]}>
              {liftData.length}
            </Text>
            <Text style={[styles.quickStatLabel, { color: currentTheme.colors.text + '70' }]}>
              Sessions
            </Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={[styles.quickStatValue, { color: currentTheme.colors.text }]}>
              {currentData.percentileRanking}{getPercentileSuffix(currentData.percentileRanking)}
            </Text>
            <Text style={[styles.quickStatLabel, { color: currentTheme.colors.text + '70' }]}>
              Percentile
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderLiftHistory = () => {
    if (originalLiftData.length === 0) return null;

    return (
      <View style={styles.historyContainer}>
        <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
          Lift History
        </Text>
        
        <View style={[styles.historyCard, { backgroundColor: currentTheme.colors.surface }]}>
          {/* TODO: reverse the order of the lifts */}
          {originalLiftData.slice().reverse().map((lift, index) => {
            const estimatedOneRM = OneRMCalculator.estimate(lift.weight, lift.reps);
            const isMaxAttempt = lift.reps === 1;
            const convertedWeight = Math.round(convertWeightForPreference(lift.weight, 'lbs', weightUnit) * 100) / 100;
            const convertedEstimate = Math.round(convertWeightForPreference(estimatedOneRM, 'lbs', weightUnit) * 100) / 100;
            
            return (
              <View key={index} style={[
                styles.historyItem,
                index < originalLiftData.length - 1 && { borderBottomColor: currentTheme.colors.border + '30', borderBottomWidth: StyleSheet.hairlineWidth }
              ]}>
                <View style={styles.historyDate}>
                  <Text style={[styles.historyDateText, { color: currentTheme.colors.text }]}>
                    {new Date(lift.dateRecorded).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: new Date(lift.dateRecorded).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                    })}
                  </Text>
                </View>
                <View style={styles.historyValue}>
                  <Text style={[styles.historyValueText, { color: currentTheme.colors.primary }]}>
                    {convertedWeight} × {lift.reps}
                  </Text>
                  <Text style={[styles.historyEstimate, { color: currentTheme.colors.text + '60' }]}>
                    {isMaxAttempt ? '1RM attempt' : `~${convertedEstimate} ${weightUnit} 1RM`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderPredictions = () => {
    if (Object.keys(predictions).length === 0) return null;

    return (
      <View style={styles.predictionsContainer}>
        <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
          AI Strength Predictions
        </Text>
        <Text style={[styles.sectionDescription, { color: currentTheme.colors.text + '70' }]}>
          Multiple models predict your future performance
        </Text>
        
        {predictionModels.map((model, index) => {
          const prediction3M = predictions[`${model.name}_90`] || 0;
          const prediction1Y = predictions[`${model.name}_365`] || 0;
          const currentValue = liftData[liftData.length - 1]?.personalRecord || 0;
          
          const convertedPrediction3M = Math.round(convertWeightForPreference(prediction3M, 'lbs', weightUnit) * 100) / 100;
          const convertedPrediction1Y = Math.round(convertWeightForPreference(prediction1Y, 'lbs', weightUnit) * 100) / 100;
          const convertedCurrent = Math.round(convertWeightForPreference(currentValue, 'lbs', weightUnit) * 100) / 100;
          const gain3M = Math.round((convertedPrediction3M - convertedCurrent) * 100) / 100;
          const gain1Y = Math.round((convertedPrediction1Y - convertedCurrent) * 100) / 100;
          
          return (
            <View key={index} style={[styles.predictionCard, { backgroundColor: currentTheme.colors.surface }]}>
              <View style={styles.predictionHeader}>
                <Text style={[styles.predictionTitle, { color: currentTheme.colors.text }]}>
                  {model.name}
                </Text>
                <Text style={[styles.predictionDescription, { color: currentTheme.colors.text + '70' }]}>
                  {model.description}
                </Text>
              </View>
              
              <View style={styles.predictionValues}>
                <View style={styles.predictionTimeframe}>
                  <Text style={[styles.predictionLabel, { color: currentTheme.colors.text + '80' }]}>
                    3 Months
                  </Text>
                  <Text style={[styles.predictionValue, { color: currentTheme.colors.primary }]}>
                    {convertedPrediction3M} {weightUnit}
                  </Text>
                  <Text style={[styles.predictionGain, { color: '#10B981' }]}>
                    +{gain3M} {weightUnit}
                  </Text>
                </View>
                
                <View style={styles.predictionTimeframe}>
                  <Text style={[styles.predictionLabel, { color: currentTheme.colors.text + '80' }]}>
                    1 Year
                  </Text>
                  <Text style={[styles.predictionValue, { color: currentTheme.colors.primary }]}>
                    {convertedPrediction1Y} {weightUnit}
                  </Text>
                  <Text style={[styles.predictionGain, { color: '#10B981' }]}>
                    +{gain1Y} {weightUnit}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderTimeframeSelector = () => {
    // Determine which timeframes to show based on data availability
    const getAvailableTimeframes = () => {
      if (liftData.length === 0) return ['ALL'];
      
      const now = new Date();
      const firstDate = new Date(liftData[0].lastUpdated);
      const daysSinceFirst = (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
      
      const timeframes: Array<'1M' | '3M' | '6M' | '1Y' | 'ALL'> = ['ALL'];
      
      if (daysSinceFirst >= 30) timeframes.unshift('1M');
      if (daysSinceFirst >= 90) timeframes.unshift('3M');
      if (daysSinceFirst >= 180) timeframes.unshift('6M');
      if (daysSinceFirst >= 365) timeframes.unshift('1Y');
      
      return timeframes;
    };

    const availableTimeframes = getAvailableTimeframes();

    return (
      <View style={styles.selectorContainer}>
        <Text style={[styles.selectorTitle, { color: currentTheme.colors.text }]}>
          Time Period
        </Text>
        <View style={styles.timeframeContainer}>
          {availableTimeframes.map((timeframe) => (
            <TouchableOpacity
              key={timeframe}
              style={[
                styles.timeframeButton,
                selectedTimeframe === timeframe && {
                  backgroundColor: currentTheme.colors.primary + '20',
                  borderColor: currentTheme.colors.primary,
                }
              ]}
              onPress={() => setSelectedTimeframe(timeframe as typeof selectedTimeframe)}
            >
              <Text style={[
                styles.timeframeText,
                {
                  color: selectedTimeframe === timeframe
                    ? currentTheme.colors.primary
                    : currentTheme.colors.text + '70'
                }
              ]}>
                {timeframe}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: currentTheme.colors.text }]}>
              Loading progression data...
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
            {workoutName} Progression
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {liftData.length > 0 ? (
            <>
              {/* Current Stats */}
              {renderCurrentStats()}
              
              {/* Interactive Chart */}
              <InteractiveProgressChart
                data={getFilteredData()}
                selectedMetric={selectedMetric}
                weightUnit={weightUnit}
                predictionValue={getAveragePrediction()}
                title={selectedMetric === 'oneRM' ? 'One Rep Max' : 'Training Volume' + ' Progression'}
                description="Tap points to see exact values"
              />
              
              {/* Timeframe Selector */}
              {renderTimeframeSelector()}
              
              {/* Predictions */}
              {renderPredictions()}
              
              {/* Progression Indicator */}
              {userProfile && liftData.length > 0 && (
                <ProgressionIndicator
                  currentOneRM={topLift?.personalRecord || 0}
                  bodyWeight={convertWeightForPreference(userProfile.weight.value, userProfile.weight.unit, 'lbs')}
                  gender={userProfile.gender}
                  age={userProfile.age || 28}
                  liftId={liftId}
                  weightUnit={weightUnit}
                />
              )}
              
              {/* Lift History */}
              {renderLiftHistory()}
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="barbell-outline" size={64} color={currentTheme.colors.text + '40'} />
              <Text style={[styles.noDataTitle, { color: currentTheme.colors.text }]}>
                No Data Available
              </Text>
              <Text style={[styles.noDataText, { color: currentTheme.colors.text + '70' }]}>
                Start recording your {workoutName.toLowerCase()} sessions to see progression analysis and predictions.
              </Text>
            </View>
          )}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Raleway_500Medium',
  },
  statsContainer: {
    paddingVertical: 24,
  },
  mainStat: {
    alignItems: 'center',
    marginBottom: 32,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Raleway_400Regular',
    marginBottom: 8,
  },
  currentValue: {
    fontSize: 48,
    fontWeight: '300',
    fontFamily: 'Raleway_300Light',
    marginBottom: 4,
  },
  nextRankSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 8,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changePercent: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
  },
  changeLabel: {
    fontSize: 16,
    fontFamily: 'Raleway_400Regular',
  },
  predictionContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  predictionText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickStat: {
    alignItems: 'center',
    flex: 1,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    fontFamily: 'Raleway_400Regular',
  },
  selectorContainer: {
    paddingVertical: 16,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 12,
  },
  timeframeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  timeframeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Raleway_500Medium',
  },
  metricContainer: {
    gap: 8,
  },
  metricButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 4,
  },
  metricDescription: {
    fontSize: 12,
    fontFamily: 'Raleway_400Regular',
    lineHeight: 16,
  },
  predictionsContainer: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: 'Raleway_400Regular',
    marginBottom: 16,
  },
  predictionCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  predictionHeader: {
    marginBottom: 12,
  },
  predictionTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 4,
  },
  predictionDescription: {
    fontSize: 12,
    fontFamily: 'Raleway_400Regular',
    lineHeight: 16,
  },
  predictionValues: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  predictionTimeframe: {
    alignItems: 'center',
    flex: 1,
  },
  predictionLabel: {
    fontSize: 12,
    fontFamily: 'Raleway_400Regular',
    marginBottom: 4,
  },
  predictionValue: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 2,
  },
  predictionGain: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Raleway_500Medium',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    fontFamily: 'Raleway_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  historyContainer: {
    paddingVertical: 16,
  },
  historyCard: {
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyDate: {
    flex: 1,
  },
  historyDateText: {
    fontSize: 14,
    fontFamily: 'Raleway_500Medium',
  },
  historyValue: {
    alignItems: 'flex-end',
  },
  historyValueText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
  },
  historyEstimate: {
    fontSize: 10,
    fontFamily: 'Raleway_400Regular',
  },
}); 