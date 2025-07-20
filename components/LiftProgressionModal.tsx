import { useTheme } from '@/contexts/ThemeContext';
import { OneRMCalculator } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { getPercentileSuffix } from '@/lib/utils';
import { MainLiftType, UserLift, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface LiftProgressionModalProps {
  visible: boolean;
  onClose: () => void;
  liftId: MainLiftType;
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
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('6M');
  const [selectedMetric, setSelectedMetric] = useState<'oneRM' | 'volume'>('oneRM');
  const [predictions, setPredictions] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadLiftData();
    }
  }, [visible, liftId]);

  const loadLiftData = async () => {
    try {
      setIsLoading(true);
      const data = await userService.getAllLiftsById(liftId);
      const rawData = await userService.getRawLiftsById(liftId);
      setLiftData(data || []);
      setOriginalLiftData(rawData || []);
      
      if (data && data.length > 0) {
        calculatePredictions(data);
      }
    } catch (error) {
      console.error('Error loading lift data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Asymptotic regression model for strength predictions
  const asymptoticRegression = (data: UserProgress[], targetDays: number): number => {
    if (data.length < 3) return data[data.length - 1]?.personalRecord || 0;
    
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
    if (data.length < 2) return data[data.length - 1]?.personalRecord || 0;
    
    const alpha = 0.3; // Smoothing factor
    let smoothedValue = data[0].personalRecord;
    
    for (let i = 1; i < data.length; i++) {
      smoothedValue = alpha * data[i].personalRecord + (1 - alpha) * smoothedValue;
    }
    
    // Project forward with trend
    const trend = (data[data.length - 1].personalRecord - smoothedValue) / data.length;
    return smoothedValue + (trend * targetDays / 7); // Weekly trend
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

  const renderChart = () => {
    const data = getFilteredData();
    if (data.length === 0) return null;

    // Round values to nearest 5s
    const values = selectedMetric === 'oneRM' 
      ? data.map(d => Math.round(d.personalRecord / 5) * 5)
      : data.map((d, i) => {
          const baseVolume = d.personalRecord * 0.8 * 15;
          return Math.round((baseVolume + (i * 100)) / 5) * 5;
        });

    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    const chartWidth = screenWidth - 80;
    const chartHeight = 200;

    // Add predictions to chart
    const currentValue = values[values.length - 1];
    const avgPrediction = Math.round(predictionModels.reduce((sum, model) => {
      return sum + (predictions[`${model.name}_90`] || currentValue);
    }, 0) / predictionModels.length / 5) * 5;

    const extendedValues = [...values, avgPrediction];
    const extendedMaxValue = Math.max(...extendedValues);
    const extendedRange = extendedMaxValue - minValue || 1;

    // Calculate points for lines
    const chartPoints = values.map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * (chartWidth - 40);
      const y = chartHeight - ((value - minValue) / extendedRange) * chartHeight;
      return { x, y, value };
    });

    // Add prediction point
    if (avgPrediction > 0) {
      const predictionX = chartWidth - 40;
      const predictionY = chartHeight - ((avgPrediction - minValue) / extendedRange) * chartHeight;
      chartPoints.push({ x: predictionX, y: predictionY, value: avgPrediction });
    }

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: currentTheme.colors.text }]}>
            {selectedMetric === 'oneRM' ? 'One Rep Max' : 'Training Volume'} Progression
          </Text>
          <Text style={[styles.chartDescription, { color: currentTheme.colors.text + '70' }]}>
            Historical data with 3-month prediction
          </Text>
        </View>

        <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
          {/* Y-axis labels with rounded values */}
          <View style={styles.yAxisLabels}>
            <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
              {Math.round(extendedMaxValue / 5) * 5}
            </Text>
            <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
              {Math.round(((extendedMaxValue + minValue) / 2) / 5) * 5}
            </Text>
            <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
              {Math.round(minValue / 5) * 5}
            </Text>
          </View>

          {/* More grid lines for better readability */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <View
              key={ratio}
              style={[
                styles.gridLine,
                {
                  top: chartHeight * ratio,
                  width: chartWidth - 40,
                  left: 40,
                  backgroundColor: currentTheme.colors.border + (ratio === 0.5 ? '40' : '20'),
                }
              ]}
            />
          ))}
          
          {/* Chart area */}
          <View style={[styles.chartLine, { left: 40 }]}>
            {/* Connecting lines */}
            {chartPoints.map((point, index) => {
              if (index === 0) return null;
              
              const prevPoint = chartPoints[index - 1];
              const distance = Math.sqrt(
                Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
              );
              const angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * 180 / Math.PI;
              
              return (
                <View
                  key={`line-${index}`}
                  style={[
                    styles.chartLineSegment,
                    {
                      left: prevPoint.x,
                      top: prevPoint.y,
                      width: distance,
                      transform: [{ rotate: `${angle}deg` }],
                      backgroundColor: index === chartPoints.length - 1 ? '#FFA500' : currentTheme.colors.primary,
                    }
                  ]}
                />
              );
            })}
            
            {/* Data points */}
            {chartPoints.map((point, index) => {
              const isHistorical = index < values.length;
              const isPrediction = index === chartPoints.length - 1 && avgPrediction > 0;
              
              return (
                <View
                  key={`point-${index}`}
                  style={[
                    styles.chartPoint,
                    isPrediction && styles.predictionPoint,
                    {
                      left: point.x - 3,
                      top: point.y - 3,
                      backgroundColor: isPrediction ? '#FFA500' : currentTheme.colors.primary,
                      borderColor: isPrediction ? currentTheme.colors.background : 'transparent',
                      borderWidth: isPrediction ? 2 : 0,
                    }
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.xAxisLabels}>
          <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
            Start
          </Text>
          <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
            Now
          </Text>
          {avgPrediction > 0 && (
            <Text style={[styles.axisLabel, { color: '#FFA500' }]}>
              3M Pred
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderCurrentStats = () => {
    if (liftData.length === 0) return null;
    
    const currentData = liftData[liftData.length - 1];
    
    // Calculate 3-month prediction average
    const avg3MonthPrediction = Object.keys(predictions).length > 0 
      ? Math.round(predictionModels.reduce((sum, model) => {
          return sum + (predictions[`${model.name}_90`] || currentData.personalRecord);
        }, 0) / predictionModels.length)
      : 0;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.mainStat}>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80' }]}>
            Current 1RM
          </Text>
          <Text style={[styles.currentValue, { color: currentTheme.colors.text }]}>
            {currentData.personalRecord} lbs
          </Text>
          {avg3MonthPrediction > 0 && (
            <View style={styles.predictionContainer}>
              <Text style={[styles.predictionLabel, { color: currentTheme.colors.text + '70' }]}>
                3-month prediction
              </Text>
              <Text style={[styles.predictionText, { color: currentTheme.colors.primary }]}>
                {avg3MonthPrediction} lbs
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
        <Text style={[styles.sectionDescription, { color: currentTheme.colors.text + '70' }]}>
          All recorded sessions with actual weight and reps
        </Text>
        
        <View style={[styles.historyCard, { backgroundColor: currentTheme.colors.surface }]}>
          {/* TODO: reverse the order of the lifts */}
          {originalLiftData.reverse().map((lift, index) => {
            const estimatedOneRM = OneRMCalculator.estimate(lift.weight, lift.reps);
            const isMaxAttempt = lift.reps === 1;
            
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
                    {lift.weight % 1 === 0 ? lift.weight : lift.weight.toFixed(1)} × {lift.reps}
                  </Text>
                  <Text style={[styles.historyEstimate, { color: currentTheme.colors.text + '60' }]}>
                    {isMaxAttempt ? '1RM attempt' : `~${estimatedOneRM.toFixed(1)} lbs 1RM`}
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
          const gain3M = prediction3M - currentValue;
          const gain1Y = prediction1Y - currentValue;
          
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
                    {Math.round(prediction3M / 5) * 5} lbs
                  </Text>
                  <Text style={[styles.predictionGain, { color: '#10B981' }]}>
                    +{Math.round(gain3M / 5) * 5} lbs
                  </Text>
                </View>
                
                <View style={styles.predictionTimeframe}>
                  <Text style={[styles.predictionLabel, { color: currentTheme.colors.text + '80' }]}>
                    1 Year
                  </Text>
                  <Text style={[styles.predictionValue, { color: currentTheme.colors.primary }]}>
                    {Math.round(prediction1Y / 5) * 5} lbs
                  </Text>
                  <Text style={[styles.predictionGain, { color: '#10B981' }]}>
                    +{Math.round(gain1Y / 5) * 5} lbs
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

  const renderMetricSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={[styles.selectorTitle, { color: currentTheme.colors.text }]}>
        Metric Type
      </Text>
      <View style={styles.metricContainer}>
        <TouchableOpacity
          style={[
            styles.metricButton,
            selectedMetric === 'oneRM' && {
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.primary,
            }
          ]}
          onPress={() => setSelectedMetric('oneRM')}
        >
          <Text style={[
            styles.metricLabel,
            {
              color: selectedMetric === 'oneRM'
                ? currentTheme.colors.text
                : currentTheme.colors.text + '70'
            }
          ]}>
            One Rep Max
          </Text>
          <Text style={[
            styles.metricDescription,
            {
              color: selectedMetric === 'oneRM'
                ? currentTheme.colors.text + '80'
                : currentTheme.colors.text + '50'
            }
          ]}>
            Maximum weight for single repetition
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.metricButton,
            selectedMetric === 'volume' && {
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.primary,
            }
          ]}
          onPress={() => setSelectedMetric('volume')}
        >
          <Text style={[
            styles.metricLabel,
            {
              color: selectedMetric === 'volume'
                ? currentTheme.colors.text
                : currentTheme.colors.text + '70'
            }
          ]}>
            Training Volume
          </Text>
          <Text style={[
            styles.metricDescription,
            {
              color: selectedMetric === 'volume'
                ? currentTheme.colors.text + '80'
                : currentTheme.colors.text + '50'
            }
          ]}>
            Total weight lifted over time
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
              
              {/* Chart */}
              {renderChart()}
              
              {/* Timeframe Selector */}
              {renderTimeframeSelector()}
              
              {/* Predictions */}
              {renderPredictions()}
              
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
  chartContainer: {
    paddingVertical: 20,
  },
  chartHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 4,
  },
  chartDescription: {
    fontSize: 12,
    fontFamily: 'Raleway_400Regular',
  },
  chart: {
    position: 'relative',
    marginVertical: 16,
  },
  yAxisLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 35,
    justifyContent: 'space-between',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 40,
    marginTop: 8,
  },
  axisLabel: {
    fontSize: 10,
    fontFamily: 'Raleway_400Regular',
  },
  gridLine: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
  },
  chartLine: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
  },
  chartPoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  predictionPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLineSegment: {
    position: 'absolute',
    height: 2,
    transformOrigin: '0 50%',
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