import { useTheme } from '@/contexts/ThemeContext';
import { userService } from '@/lib/userService';
import { UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MerchShop from './MerchShop';

const { width: screenWidth } = Dimensions.get('window');

interface ExclusiveFeaturesModalProps {
  visible: boolean;
  onClose: () => void;
  userPercentile: number;
}

export default function ExclusiveFeaturesModal({ visible, onClose, userPercentile }: ExclusiveFeaturesModalProps) {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'analytics' | 'shop'>('analytics');
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1W' | '1M' | '3M' | '1Y' | 'ALL'>('3M');
  const [selectedMetric, setSelectedMetric] = useState<'strength' | 'volume' | 'intensity'>('strength');

  useEffect(() => {
    if (visible) {
      loadAnalyticsData();
    }
  }, [visible]);

  const loadAnalyticsData = async () => {
    try {
      const progress = await userService.calculateRealUserProgress();
      setUserProgress(progress);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    }
  };

  // Mock data for charts (in a real app, this would come from your database)
  const generateMockData = () => {
    const baseValue = userPercentile;
    return Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
      value: baseValue + Math.sin(i * 0.2) * 10 + Math.random() * 5 - 2.5,
      volume: 1000 + Math.random() * 500,
    }));
  };

  const chartData = generateMockData();
  const currentValue = chartData[chartData.length - 1]?.value || userPercentile;
  const previousValue = chartData[chartData.length - 2]?.value || userPercentile;
  const changePercent = ((currentValue - previousValue) / previousValue * 100).toFixed(2);
  const isPositive = parseFloat(changePercent) >= 0;

  const timeframes = ['1W', '1M', '3M', '1Y', 'ALL'];
  const metrics = [
    { key: 'strength', label: 'Strength Score', description: 'Combined percentile across all tracked lifts' },
    { key: 'volume', label: 'Training Volume', description: 'Total weight lifted over time period' },
    { key: 'intensity', label: 'Intensity Index', description: 'Average percentage of 1RM used' },
  ];

  const renderChart = () => {
    const maxValue = Math.max(...chartData.map(d => d.value));
    const minValue = Math.min(...chartData.map(d => d.value));
    const range = maxValue - minValue || 1; // Prevent division by zero
    const chartWidth = screenWidth - 80;
    const chartHeight = 200;

    return (
      <View style={styles.chartContainer}>
        {/* Chart Title and Description */}
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: currentTheme.colors.text }]}>
            {metrics.find(m => m.key === selectedMetric)?.label} Trend
          </Text>
          <Text style={[styles.chartDescription, { color: currentTheme.colors.text + '70' }]}>
            {metrics.find(m => m.key === selectedMetric)?.description}
          </Text>
        </View>

        <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
          {/* Y-axis labels */}
          <View style={styles.yAxisLabels}>
            <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
              {Math.round(maxValue)}
            </Text>
            <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
              {Math.round((maxValue + minValue) / 2)}
            </Text>
            <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
              {Math.round(minValue)}
            </Text>
          </View>

          {/* Grid lines with labels */}
          {[0, 0.5, 1].map((ratio) => (
            <View
              key={ratio}
              style={[
                styles.gridLine,
                {
                  top: chartHeight * ratio,
                  width: chartWidth - 40, // Account for y-axis labels
                  left: 40,
                  backgroundColor: currentTheme.colors.border + '30',
                }
              ]}
            />
          ))}
          
          {/* Chart line */}
          <View style={[styles.chartLine, { left: 40 }]}>
            {chartData.map((point, index) => {
              const x = (index / (chartData.length - 1)) * (chartWidth - 40);
              const y = chartHeight - ((point.value - minValue) / range) * chartHeight;
              
              return (
                <View
                  key={index}
                  style={[
                    styles.chartPoint,
                    {
                      left: x - 2,
                      top: y - 2,
                      backgroundColor: isPositive ? '#10B981' : '#EF4444',
                    }
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* X-axis labels */}
        <View style={styles.xAxisLabels}>
          <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
            30 days ago
          </Text>
          <Text style={[styles.axisLabel, { color: currentTheme.colors.text + '60' }]}>
            Today
          </Text>
        </View>
      </View>
    );
  };

  const renderStats = () => (
    <View style={styles.statsContainer}>
      {/* Main Metric Display */}
      <View style={styles.mainStat}>
        <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80' }]}>
          Current {metrics.find(m => m.key === selectedMetric)?.label}
        </Text>
        <Text style={[styles.currentValue, { color: currentTheme.colors.text }]}>
          {selectedMetric === 'strength' ? `${currentValue.toFixed(1)}th` : 
           selectedMetric === 'volume' ? `${(currentValue * 100).toFixed(0)}lbs` :
           `${currentValue.toFixed(1)}%`}
        </Text>
        <View style={styles.changeContainer}>
          <Ionicons
            name={isPositive ? "trending-up" : "trending-down"}
            size={16}
            color={isPositive ? '#10B981' : '#EF4444'}
          />
          <Text style={[
            styles.changePercent,
            { color: isPositive ? '#10B981' : '#EF4444' }
          ]}>
            {isPositive ? '+' : ''}{changePercent}%
          </Text>
          <Text style={[styles.changeLabel, { color: currentTheme.colors.text + '70' }]}>
            vs yesterday
          </Text>
        </View>
      </View>
      
      {/* Quick Stats Grid */}
      <View style={styles.quickStatsHeader}>
        <Text style={[styles.quickStatsTitle, { color: currentTheme.colors.text }]}>
          Key Metrics
        </Text>
      </View>
      <View style={styles.quickStats}>
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatValue, { color: currentTheme.colors.text }]}>
            {userProgress.length}
          </Text>
          <Text style={[styles.quickStatLabel, { color: currentTheme.colors.text + '70' }]}>
            Active Lifts
          </Text>
          <Text style={[styles.quickStatDescription, { color: currentTheme.colors.text + '50' }]}>
            Exercises being tracked
          </Text>
        </View>
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatValue, { color: currentTheme.colors.text }]}>
            {Math.round(Math.max(...chartData.map(d => d.value)))}
          </Text>
          <Text style={[styles.quickStatLabel, { color: currentTheme.colors.text + '70' }]}>
            Peak Score
          </Text>
          <Text style={[styles.quickStatDescription, { color: currentTheme.colors.text + '50' }]}>
            Highest recorded value
          </Text>
        </View>
        <View style={styles.quickStat}>
          <Text style={[styles.quickStatValue, { color: currentTheme.colors.text }]}>
            +{Math.round((currentValue - chartData[0].value) * 10) / 10}
          </Text>
          <Text style={[styles.quickStatLabel, { color: currentTheme.colors.text + '70' }]}>
            30D Growth
          </Text>
          <Text style={[styles.quickStatDescription, { color: currentTheme.colors.text + '50' }]}>
            Change over month
          </Text>
        </View>
      </View>
    </View>
  );

  const renderTimeframeSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={[styles.selectorTitle, { color: currentTheme.colors.text }]}>
        Time Period
      </Text>
      <View style={styles.timeframeContainer}>
        {timeframes.map((timeframe) => (
          <TouchableOpacity
            key={timeframe}
            style={[
              styles.timeframeButton,
              selectedTimeframe === timeframe && {
                backgroundColor: currentTheme.colors.primary + '20',
                borderColor: currentTheme.colors.primary,
              }
            ]}
            onPress={() => setSelectedTimeframe(timeframe as any)}
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

  const renderMetricSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={[styles.selectorTitle, { color: currentTheme.colors.text }]}>
        Metric Type
      </Text>
      <View style={styles.metricContainer}>
        {metrics.map((metric) => (
          <TouchableOpacity
            key={metric.key}
            style={[
              styles.metricButton,
              selectedMetric === metric.key && {
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.primary,
              }
            ]}
            onPress={() => setSelectedMetric(metric.key as any)}
          >
            <Text style={[
              styles.metricLabel,
              {
                color: selectedMetric === metric.key
                  ? currentTheme.colors.text
                  : currentTheme.colors.text + '70'
              }
            ]}>
              {metric.label}
            </Text>
            <Text style={[
              styles.metricDescription,
              {
                color: selectedMetric === metric.key
                  ? currentTheme.colors.text + '80'
                  : currentTheme.colors.text + '50'
              }
            ]}>
              {metric.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderInsights = () => (
    <View style={styles.insightsContainer}>
      <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
        Performance Insights
      </Text>
      <Text style={[styles.sectionDescription, { color: currentTheme.colors.text + '70' }]}>
        AI-powered analysis of your training patterns
      </Text>
      
      <View style={[styles.insightCard, { backgroundColor: currentTheme.colors.surface }]}>
        <View style={styles.insightHeader}>
          <Ionicons name="trending-up" size={20} color="#10B981" />
          <Text style={[styles.insightTitle, { color: currentTheme.colors.text }]}>
            Progress Analysis
          </Text>
        </View>
        <Text style={[styles.insightText, { color: currentTheme.colors.text + '80' }]}>
          Your strength score has increased by {Math.abs(parseFloat(changePercent))}% in the last period. 
          This places you in the top {100 - Math.round(userPercentile)}% of all users on the platform.
        </Text>
      </View>
      
      <View style={[styles.insightCard, { backgroundColor: currentTheme.colors.surface }]}>
        <View style={styles.insightHeader}>
          <Ionicons name="analytics" size={20} color={currentTheme.colors.primary} />
          <Text style={[styles.insightTitle, { color: currentTheme.colors.text }]}>
            Training Recommendation
          </Text>
        </View>
        <Text style={[styles.insightText, { color: currentTheme.colors.text + '80' }]}>
          Based on your current trajectory and consistency patterns, focus on maintaining regular training 
          frequency to sustain this upward trend. Consider increasing training volume by 15-20%.
        </Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet">
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
            Performance Analytics
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'analytics' && { backgroundColor: currentTheme.colors.primary + '20' }
              ]}
              onPress={() => setActiveTab('analytics')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'analytics' ? currentTheme.colors.primary : currentTheme.colors.text + '70' }
              ]}>
                Analytics Dashboard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'shop' && { backgroundColor: currentTheme.colors.primary + '20' }
              ]}
              onPress={() => setActiveTab('shop')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'shop' ? currentTheme.colors.primary : currentTheme.colors.text + '70' }
              ]}>
                Merch Shop
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'analytics' ? (
            <>
              {/* Main Stats */}
              {renderStats()}
              
              {/* Metric Selector */}
              {renderMetricSelector()}
              
              {/* Chart */}
              {renderChart()}
              
              {/* Timeframe Selector */}
              {renderTimeframeSelector()}
              
              {/* Insights */}
              {renderInsights()}
            </>
          ) : (
            <MerchShop userPercentile={userPercentile} />
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
  tabContainer: {
    flexDirection: 'row',
    paddingVertical: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
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
  quickStatsHeader: {
    marginBottom: 16,
  },
  quickStatsTitle: {
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
    marginBottom: 2,
  },
  quickStatDescription: {
    fontSize: 10,
    fontFamily: 'Raleway_400Regular',
    textAlign: 'center',
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
    textAlign: 'center',
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
    width: 4,
    height: 4,
    borderRadius: 2,
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
  insightsContainer: {
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
  insightCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginLeft: 8,
  },
  insightText: {
    fontSize: 14,
    fontFamily: 'Raleway_400Regular',
    lineHeight: 20,
  },
}); 