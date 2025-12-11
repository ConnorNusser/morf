import { useTheme } from '@/contexts/ThemeContext';
import { calculateAveragePrediction } from '@/lib/data/predictionModels';
import { convertWeightForPreference } from '@/lib/utils/utils';
import { UserProgress } from '@/types';
import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface InteractiveProgressChartProps {
  data: UserProgress[];
  selectedMetric: 'oneRM' | 'volume';
  weightUnit: 'lbs' | 'kg';
  predictionValue?: number; // If not provided, will be calculated internally
  showPrediction?: boolean; // Enable/disable prediction point (default: true)
  title?: string;
  description?: string;
  showTimePeriodSelector?: boolean;
}

interface DataPoint {
  x: number;
  y: number;
  value: number;
  date: Date;
  isHistorical: boolean;
  isPrediction: boolean;
}

type TimePeriod = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export default function InteractiveProgressChart({
  data,
  selectedMetric,
  weightUnit,
  predictionValue,
  showPrediction = true,
  title = "One Rep Max Progression",
  description = "Tap points to see exact values",
  showTimePeriodSelector = true
}: InteractiveProgressChartProps) {
  const { currentTheme } = useTheme();
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);
  const [blinkAnim] = useState(new Animated.Value(1));
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ALL');

  // Filter data based on time period
  const getFilteredData = () => {
    if (timePeriod === 'ALL') return data;

    const now = new Date();
    const cutoff = new Date();

    switch (timePeriod) {
      case '1M':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        cutoff.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        cutoff.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
    }

    return data.filter(d => new Date(d.lastUpdated) >= cutoff);
  };

  const filteredData = getFilteredData();

  // Deduplicate: keep only the highest record per day
  const deduplicateByDay = (records: UserProgress[]): UserProgress[] => {
    const byDay = new Map<string, UserProgress>();

    for (const record of records) {
      const date = new Date(record.lastUpdated);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      const existing = byDay.get(dayKey);
      if (!existing || record.personalRecord > existing.personalRecord) {
        byDay.set(dayKey, record);
      }
    }

    // Return sorted by date
    return Array.from(byDay.values()).sort(
      (a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
    );
  };

  const dedupedData = deduplicateByDay(filteredData);

  // Calculate prediction if not provided and showPrediction is true
  const effectivePrediction = showPrediction
    ? (predictionValue ?? calculateAveragePrediction(dedupedData))
    : undefined;

  // Blinking animation for prediction point
  useEffect(() => {
    if (effectivePrediction) {
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
  }, [effectivePrediction, blinkAnim]);

  // Clear selected point when time period changes
  useEffect(() => {
    setSelectedPoint(null);
  }, [timePeriod]);

  if (data.length === 0) return null;
  if (dedupedData.length === 0) {
    // Show message if no data in selected period
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: currentTheme.colors.text }]}>{title}</Text>
        </View>
        {showTimePeriodSelector && (
          <View style={styles.timePeriodSelector}>
            {(['1M', '3M', '6M', '1Y', 'ALL'] as TimePeriod[]).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.timePeriodButton,
                  timePeriod === period && { backgroundColor: currentTheme.colors.primary + '20' }
                ]}
                onPress={() => setTimePeriod(period)}
              >
                <Text style={[
                  styles.timePeriodText,
                  { color: timePeriod === period ? currentTheme.colors.primary : currentTheme.colors.text + '60' }
                ]}>
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={styles.noDataContainer}>
          <Text style={[styles.noDataText, { color: currentTheme.colors.text + '60' }]}>
            No data in this time period
          </Text>
        </View>
      </View>
    );
  }

  // Convert and round values to nearest 5s (using deduplicated data)
  const values = selectedMetric === 'oneRM'
    ? dedupedData.map(d => Math.round(convertWeightForPreference(d.personalRecord, 'lbs', weightUnit) / 5) * 5)
    : dedupedData.map((d, i) => {
        const baseVolume = convertWeightForPreference(d.personalRecord * 0.8 * 15, 'lbs', weightUnit);
        return Math.round((baseVolume + (i * 100)) / 5) * 5;
      });

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Add prediction to values if available
  const extendedValues = effectivePrediction ? [...values, Math.round(convertWeightForPreference(effectivePrediction, 'lbs', weightUnit) / 5) * 5] : values;
  const extendedMaxValue = Math.max(...extendedValues);
  const extendedMinValue = Math.min(...extendedValues);

  // Add 10% padding to the range so points don't sit on edges
  const rawRange = extendedMaxValue - extendedMinValue || 1;
  const padding = rawRange * 0.1;
  const paddedMin = extendedMinValue - padding;
  const paddedMax = extendedMaxValue + padding;
  const range = paddedMax - paddedMin;

  const chartWidth = screenWidth - 80;
  const chartHeight = 200;
  const chartAreaWidth = chartWidth - 40; // Area after y-axis

  // Calculate time range for x-axis (from period start to today)
  const now = new Date();
  const getTimeRangeStart = (): Date => {
    if (timePeriod === 'ALL' && dedupedData.length > 0) {
      // For ALL, start from first data point
      return new Date(dedupedData[0].lastUpdated);
    }
    const start = new Date();
    switch (timePeriod) {
      case '1M':
        start.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        start.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        start.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return new Date(dedupedData[0]?.lastUpdated || now);
    }
    return start;
  };

  const timeRangeStart = getTimeRangeStart();
  const timeRangeEnd = now;
  const totalTimeMs = timeRangeEnd.getTime() - timeRangeStart.getTime();

  // Calculate data points positioned within the full time range (using deduplicated data)
  const dataPoints: DataPoint[] = values.map((value, index) => {
    const pointDate = new Date(dedupedData[index].lastUpdated);
    const timeOffset = pointDate.getTime() - timeRangeStart.getTime();
    const x = totalTimeMs > 0 ? (timeOffset / totalTimeMs) * chartAreaWidth : 0;
    const y = chartHeight - ((value - paddedMin) / range) * chartHeight;
    return {
      x: Math.max(0, Math.min(x, chartAreaWidth)), // Clamp to chart bounds
      y,
      value,
      date: pointDate,
      isHistorical: true,
      isPrediction: false
    };
  });

  // Add prediction point if available
  if (effectivePrediction) {
    const convertedPrediction = Math.round(convertWeightForPreference(effectivePrediction, 'lbs', weightUnit) / 5) * 5;
    const predictionX = chartAreaWidth;
    const predictionY = chartHeight - ((convertedPrediction - paddedMin) / range) * chartHeight;
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

  // Format date based on time span
  const formatDateForSpan = (date: Date, spanDays: number) => {
    if (spanDays <= 31) {
      // Within a month: show "Jan 15"
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (spanDays <= 365) {
      // Within a year: show "Jan 15"
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      // Over a year: show "Jan '24"
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  };

  // Get x-axis labels - show multiple dates across the time range
  const getXAxisLabels = () => {
    // Calculate time span in days for formatting
    const spanDays = Math.ceil(totalTimeMs / (1000 * 60 * 60 * 24));

    // Determine number of labels based on time span (3-5 labels)
    const numLabels = spanDays <= 31 ? 3 : spanDays <= 180 ? 4 : 5;
    const labels = [];

    for (let i = 0; i < numLabels; i++) {
      const ratio = i / (numLabels - 1);
      const dateMs = timeRangeStart.getTime() + (totalTimeMs * ratio);
      const date = new Date(dateMs);
      const position = ratio * chartAreaWidth;

      labels.push({
        position,
        text: formatDateForSpan(date, spanDays),
        color: currentTheme.colors.text + '60',
        align: i === 0 ? 'left' : i === numLabels - 1 ? 'right' : 'center'
      });
    }

    return labels;
  };

  const xAxisLabels = getXAxisLabels();

  // Get current 1RM (most recent value from deduplicated data)
  const current1RM = dedupedData.length > 0
    ? Math.round(convertWeightForPreference(dedupedData[dedupedData.length - 1].personalRecord, 'lbs', weightUnit) / 5) * 5
    : null;

  return (
    <TouchableWithoutFeedback onPress={handleBackgroundPress}>
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <View style={styles.chartTitleRow}>
            <Text style={[styles.chartTitle, { color: currentTheme.colors.text }]}>
              {title}
            </Text>
            {selectedMetric === 'oneRM' && current1RM && (
              <View style={[styles.current1RMBadge, { backgroundColor: currentTheme.colors.primary + '15' }]}>
                <Text style={[styles.current1RMText, { color: currentTheme.colors.primary }]}>
                  {current1RM} {weightUnit}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.chartDescription, { color: currentTheme.colors.text + '70' }]}>
            {description}
          </Text>
        </View>

        {/* Time Period Selector */}
        {showTimePeriodSelector && (
          <View style={styles.timePeriodSelector}>
            {(['1M', '3M', '6M', '1Y', 'ALL'] as TimePeriod[]).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.timePeriodButton,
                  timePeriod === period && { backgroundColor: currentTheme.colors.primary + '20' }
                ]}
                onPress={() => setTimePeriod(period)}
              >
                <Text style={[
                  styles.timePeriodText,
                  { color: timePeriod === period ? currentTheme.colors.primary : currentTheme.colors.text + '60' }
                ]}>
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
          {/* Y-axis labels */}
          <View style={styles.yAxisLabels}>
            <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
              {Math.round(extendedMaxValue / 5) * 5}
            </Text>
            <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
              {Math.round(((extendedMaxValue + extendedMinValue) / 2) / 5) * 5}
            </Text>
            <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
              {Math.round(extendedMinValue / 5) * 5}
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
                {
                  left: label.position + 40,
                  transform: [{ translateX: label.align === 'right' ? -40 : label.align === 'center' ? -20 : 0 }]
                }
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
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
  },
  current1RMBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  current1RMText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
  },
  chartDescription: {
    fontSize: 12,
    fontFamily: 'Raleway_400Regular',
  },
  timePeriodSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  timePeriodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timePeriodText: {
    fontSize: 12,
    fontFamily: 'Raleway_600SemiBold',
  },
  noDataContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
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