import { useTheme } from '@/contexts/ThemeContext';
import { convertWeightForPreference } from '@/lib/utils';
import { UserProgress } from '@/types';
import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface InteractiveProgressChartProps {
  data: UserProgress[];
  selectedMetric: 'oneRM' | 'volume';
  weightUnit: 'lbs' | 'kg';
  predictionValue?: number;
  title?: string;
  description?: string;
}

interface DataPoint {
  x: number;
  y: number;
  value: number;
  date: Date;
  isHistorical: boolean;
  isPrediction: boolean;
}

export default function InteractiveProgressChart({ 
  data, 
  selectedMetric, 
  weightUnit, 
  predictionValue,
  title = "One Rep Max Progression",
  description = "Tap points to see exact values"
}: InteractiveProgressChartProps) {
  const { currentTheme } = useTheme();
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const [blinkAnim] = useState(new Animated.Value(1));

  // Blinking animation for prediction point
  useEffect(() => {
    if (predictionValue) {
      const blinkAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      blinkAnimation.start();
      
      return () => blinkAnimation.stop();
    }
  }, [predictionValue, blinkAnim]);

  if (data.length === 0) return null;

  // Convert and round values to nearest 5s
  const values = selectedMetric === 'oneRM' 
    ? data.map(d => Math.round(convertWeightForPreference(d.personalRecord, 'lbs', weightUnit) / 5) * 5)
    : data.map((d, i) => {
        const baseVolume = convertWeightForPreference(d.personalRecord * 0.8 * 15, 'lbs', weightUnit);
        return Math.round((baseVolume + (i * 100)) / 5) * 5;
      });

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  
  // Add prediction to values if provided
  const extendedValues = predictionValue ? [...values, Math.round(convertWeightForPreference(predictionValue, 'lbs', weightUnit) / 5) * 5] : values;
  const extendedMaxValue = Math.max(...extendedValues);
  const range = extendedMaxValue - minValue || 1;

  const chartWidth = screenWidth - 80;
  const chartHeight = 200;

  // Calculate data points
  const dataPoints: DataPoint[] = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * (chartWidth - 40);
    const y = chartHeight - ((value - minValue) / range) * chartHeight;
    return {
      x,
      y,
      value,
      date: new Date(data[index].lastUpdated),
      isHistorical: true,
      isPrediction: false
    };
  });

  // Add prediction point if provided
  if (predictionValue) {
    const convertedPrediction = Math.round(convertWeightForPreference(predictionValue, 'lbs', weightUnit) / 5) * 5;
    const predictionX = chartWidth - 40;
    const predictionY = chartHeight - ((convertedPrediction - minValue) / range) * chartHeight;
    dataPoints.push({
      x: predictionX,
      y: predictionY,
      value: convertedPrediction,
      date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 months from now
      isHistorical: false,
      isPrediction: true
    });
  }

  const handlePointPress = (point: DataPoint) => {
    setSelectedPoint(selectedPoint?.x === point.x ? null : point);
  };

  const handleBackgroundPress = () => {
    setSelectedPoint(null);
  };

  // Get x-axis labels based on actual data
  const getXAxisLabels = () => {
    if (dataPoints.length === 0) return [];
    
    const labels = [];
    const firstPoint = dataPoints[0];
    const lastHistoricalPoint = dataPoints.find(p => p.isHistorical && p === dataPoints[dataPoints.findLastIndex(dp => dp.isHistorical)]);
    const predictionPoint = dataPoints.find(p => p.isPrediction);

    // First date
    labels.push({
      position: 0,
      text: firstPoint.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      color: currentTheme.colors.text + '60'
    });

    // Most recent historical date (if different from first)
    if (lastHistoricalPoint && dataPoints.length > 1) {
      labels.push({
        position: (chartWidth - 40) / 2,
        text: lastHistoricalPoint.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        color: currentTheme.colors.text + '60'
      });
    }

    // Prediction date
    if (predictionPoint) {
      labels.push({
        position: chartWidth - 40,
        text: predictionPoint.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        color: '#FFA500'
      });
    }

    return labels;
  };

  const xAxisLabels = getXAxisLabels();

  return (
    <TouchableWithoutFeedback onPress={handleBackgroundPress}>
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: currentTheme.colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.chartDescription, { color: currentTheme.colors.text + '70' }]}>
            {description}
          </Text>
        </View>

        <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
          {/* Y-axis labels */}
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

          {/* Grid lines */}
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
            {dataPoints.map((point, index) => {
              if (index === 0) return null;
              
              const prevPoint = dataPoints[index - 1];
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
                      backgroundColor: point.isPrediction ? '#FFA500' : currentTheme.colors.primary,
                    }
                  ]}
                />
              );
            })}
            
            {/* Interactive data points */}
            {dataPoints.map((point, index) => (
              <TouchableOpacity
                key={`point-${index}`}
                style={[
                  styles.chartPointTouchable,
                  {
                    left: point.x - 12,
                    top: point.y - 12,
                  }
                ]}
                onPress={() => handlePointPress(point)}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={[
                    styles.chartPoint,
                    point.isPrediction && styles.predictionPoint,
                    selectedPoint?.x === point.x && styles.selectedPoint,
                    {
                      backgroundColor: point.isPrediction ? '#FFA500' : currentTheme.colors.primary,
                      borderColor: selectedPoint?.x === point.x ? currentTheme.colors.background : 'transparent',
                      opacity: point.isPrediction ? blinkAnim : 1,
                    }
                  ]}
                />
              </TouchableOpacity>
            ))}

            {/* Value tooltip */}
            {selectedPoint && (
              <View
                style={[
                  styles.tooltip,
                  {
                    left: Math.min(Math.max(selectedPoint.x - 50, 0), chartWidth - 140),
                    top: Math.max(selectedPoint.y - 60, 0),
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  }
                ]}
              >
                <Text style={[styles.tooltipValue, { color: currentTheme.colors.text }]}>
                  {selectedPoint.value} {weightUnit}
                </Text>
                <Text style={[styles.tooltipDate, { color: currentTheme.colors.text + '70' }]}>
                  {selectedPoint.isPrediction 
                    ? '3M Prediction' 
                    : selectedPoint.date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: selectedPoint.date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                      })
                  }
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* X-axis with actual dates */}
        <View style={styles.xAxisLabels}>
          {xAxisLabels.map((label, index) => (
            <View 
              key={index}
              style={[
                styles.xAxisLabel,
                { left: label.position + 40 }
              ]}
            >
              <Text style={[styles.axisLabel, { color: label.color }]}>
                {label.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
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
    position: 'relative',
    height: 20,
    marginTop: 8,
  },
  xAxisLabel: {
    position: 'absolute',
    alignItems: 'center',
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
  chartPointTouchable: {
    position: 'absolute',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  predictionPoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  selectedPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
  },
  chartLineSegment: {
    position: 'absolute',
    height: 2,
    transformOrigin: '0 50%',
  },
  tooltip: {
    position: 'absolute',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltipValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 2,
  },
  tooltipDate: {
    fontSize: 10,
    fontFamily: 'Raleway_400Regular',
  },
}); 