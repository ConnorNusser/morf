import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { formatShortDate as formatDate } from '@/lib/ui/formatters';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import Card from './Card';
import IconButton from './IconButton';
import { Text } from './Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import { userSyncService } from '@/lib/services/userSyncService';
import { MuscleGroupPercentiles, PercentileHistoryEntry, UserPercentileData } from '@/types';
import { Ionicons } from '@expo/vector-icons';

// Get color for a specific percentile value
const getColorForPercentile = (percentile: number): string => {
  const tier = getStrengthTier(percentile);
  return getTierColor(tier);
};

interface StrengthHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

type ViewMode = 'chart' | 'history';
type CategoryKey = 'push' | 'pull' | 'legs' | null;

const MUSCLE_CATEGORIES = {
  push: { label: 'Push', muscles: ['chest', 'shoulders'] as const },
  pull: { label: 'Pull', muscles: ['back', 'arms'] as const },
  legs: { label: 'Legs', muscles: ['legs', 'glutes'] as const },
};

export default function StrengthHistoryModal({ visible, onClose }: StrengthHistoryModalProps) {
  const { currentTheme } = useTheme();
  const [history, setHistory] = useState<PercentileHistoryEntry[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupPercentiles | null>(null);
  const [overallPercentile, setOverallPercentile] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(null);

  useEffect(() => {
    if (!visible) return;
    loadData();
  }, [visible]);

  // Reset selected category when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedCategory(null);
      setViewMode('chart');
    }
  }, [visible]);

  const loadData = async () => {
    try {
      const user = await userSyncService.getCurrentUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const data: UserPercentileData | null = await userSyncService.getUserPercentileData(user.id);
      if (data) {
        setHistory(data.percentile_history?.map(h => ({ ...h })) || []);
        setMuscleGroups(data.muscle_groups);
        setOverallPercentile(data.overall_percentile);
      }
    } catch (error) {
      console.error('Error loading strength history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const avgCategory = (source: MuscleGroupPercentiles | null | undefined, category: keyof typeof MUSCLE_CATEGORIES): number => {
    if (!source) return 0;
    const values = MUSCLE_CATEGORIES[category].muscles.map(m => source[m]).filter(v => v > 0);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  const getCategoryPercentile = (category: keyof typeof MUSCLE_CATEGORIES): number =>
    avgCategory(muscleGroups, category);

  const getCategoryPercentileFromEntry = (entry: PercentileHistoryEntry, category: keyof typeof MUSCLE_CATEGORIES): number =>
    avgCategory(entry.muscleGroups, category);

  // Chart dimensions
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 72;
  const chartHeight = 180;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 30;
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const displayHistory = history.slice(-30);

  // Get percentiles based on selected category or overall
  const getDisplayPercentiles = () => {
    if (selectedCategory) {
      return displayHistory.map(h => getCategoryPercentileFromEntry(h, selectedCategory));
    }
    return displayHistory.map(h => h.percentile);
  };

  const displayPercentiles = getDisplayPercentiles();
  const percentiles = displayPercentiles.length > 0 ? displayPercentiles : [0];
  const minPercentile = Math.max(0, Math.min(...percentiles) - 5);
  const maxPercentile = Math.min(100, Math.max(...percentiles) + 5);
  const range = maxPercentile - minPercentile || 1;

  const points = displayHistory.map((entry, index) => {
    const pct = selectedCategory ? getCategoryPercentileFromEntry(entry, selectedCategory) : entry.percentile;
    const x = displayHistory.length === 1
      ? paddingLeft + graphWidth / 2
      : paddingLeft + (index / (displayHistory.length - 1)) * graphWidth;
    const y = paddingTop + graphHeight - ((pct - minPercentile) / range) * graphHeight;
    return { x, y, percentile: pct, date: entry.date };
  });

  const pathData = points.length > 0
    ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    : '';

  const areaPath = points.length > 0
    ? `${pathData} L ${points[points.length - 1].x} ${paddingTop + graphHeight} L ${paddingLeft} ${paddingTop + graphHeight} Z`
    : '';

  const firstValue = displayPercentiles[0] || 0;
  const lastValue = displayPercentiles[displayPercentiles.length - 1] || 0;
  const change = lastValue - firstValue;
  const changeColor = change > 0 ? '#22C55E' : change < 0 ? '#EF4444' : currentTheme.colors.text + '60';

  // Overall change from first entry ever to current
  const overallFirstValue = displayHistory[0]?.percentile || 0;
  const overallLastValue = displayHistory[displayHistory.length - 1]?.percentile || 0;
  const overallChange = overallLastValue - overallFirstValue;

  const currentPercentile = selectedCategory ? getCategoryPercentile(selectedCategory) : overallPercentile;
  const tier = getStrengthTier(currentPercentile);
  const tierColor = getTierColor(tier);


  const formatDateLong = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleClearFilter = () => {
    setSelectedCategory(null);
  };

  const headerTitle = selectedCategory
    ? `${MUSCLE_CATEGORIES[selectedCategory].label} History`
    : 'Strength History';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={styles.headerSpacer} />
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
            {headerTitle}
          </Text>
          <IconButton icon="close" onPress={onClose} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Current Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: tierColor, fontFamily: currentTheme.fonts.bold }]}>
                {currentPercentile}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60' }]}>
                Percentile
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: changeColor, fontFamily: currentTheme.fonts.bold }]}>
                {change > 0 ? '+' : ''}{change}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60' }]}>
                30-Day
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: overallChange >= 0 ? '#22C55E' : '#EF4444', fontFamily: currentTheme.fonts.bold }]}>
                {overallChange > 0 ? '+' : ''}{overallChange}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60' }]}>
                Overall
              </Text>
            </View>
          </View>

          {/* View Toggle */}
          <View style={[styles.toggleContainer, { backgroundColor: currentTheme.colors.surface }]}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === 'chart' && { backgroundColor: currentTheme.colors.background }
              ]}
              onPress={() => setViewMode('chart')}
            >
              <Ionicons
                name="analytics-outline"
                size={16}
                color={viewMode === 'chart' ? currentTheme.colors.text : currentTheme.colors.text + '60'}
              />
              <Text style={[
                styles.toggleText,
                { color: viewMode === 'chart' ? currentTheme.colors.text : currentTheme.colors.text + '60' }
              ]}>
                Chart
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === 'history' && { backgroundColor: currentTheme.colors.background }
              ]}
              onPress={() => setViewMode('history')}
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={viewMode === 'history' ? currentTheme.colors.text : currentTheme.colors.text + '60'}
              />
              <Text style={[
                styles.toggleText,
                { color: viewMode === 'history' ? currentTheme.colors.text : currentTheme.colors.text + '60' }
              ]}>
                History
              </Text>
            </TouchableOpacity>
          </View>

          {viewMode === 'chart' ? (
            <>
              {/* Chart View */}
              <Card style={styles.chartCard}>
                {displayHistory.length > 0 ? (
                  <Svg width={chartWidth} height={chartHeight}>
                    {/* Horizontal grid lines */}
                    {[0, 0.5, 1].map((ratio, i) => (
                      <Line
                        key={i}
                        x1={paddingLeft}
                        y1={paddingTop + graphHeight * (1 - ratio)}
                        x2={paddingLeft + graphWidth}
                        y2={paddingTop + graphHeight * (1 - ratio)}
                        stroke={currentTheme.colors.border}
                        strokeWidth={1}
                        strokeDasharray={i === 0 ? undefined : "4,4"}
                      />
                    ))}

                    {/* Y-axis labels */}
                    <SvgText x={paddingLeft - 8} y={paddingTop + 4} fontSize={11} fill={currentTheme.colors.text + '60'} textAnchor="end">
                      {Math.round(maxPercentile)}
                    </SvgText>
                    <SvgText x={paddingLeft - 8} y={paddingTop + graphHeight / 2 + 4} fontSize={11} fill={currentTheme.colors.text + '60'} textAnchor="end">
                      {Math.round((maxPercentile + minPercentile) / 2)}
                    </SvgText>
                    <SvgText x={paddingLeft - 8} y={paddingTop + graphHeight + 4} fontSize={11} fill={currentTheme.colors.text + '60'} textAnchor="end">
                      {Math.round(minPercentile)}
                    </SvgText>

                    {/* Gradient definitions */}
                    <Defs>
                      <LinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        {points.map((point, i) => (
                          <Stop
                            key={i}
                            offset={`${(i / Math.max(points.length - 1, 1)) * 100}%`}
                            stopColor={getColorForPercentile(point.percentile)}
                          />
                        ))}
                      </LinearGradient>
                      <LinearGradient id="areaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        {points.map((point, i) => (
                          <Stop
                            key={i}
                            offset={`${(i / Math.max(points.length - 1, 1)) * 100}%`}
                            stopColor={getColorForPercentile(point.percentile)}
                            stopOpacity={0.15}
                          />
                        ))}
                      </LinearGradient>
                    </Defs>

                    {/* Area fill with gradient */}
                    <Path d={areaPath} fill="url(#areaGradient)" />

                    {/* Line with gradient */}
                    <Path d={pathData} fill="none" stroke="url(#lineGradient)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

                    {/* Data points - each colored by its percentile */}
                    {points.map((point, i) => {
                      const pointColor = getColorForPercentile(point.percentile);
                      return (
                        <Circle
                          key={i}
                          cx={point.x}
                          cy={point.y}
                          r={i === points.length - 1 ? 5 : 3}
                          fill={pointColor}
                        />
                      );
                    })}

                    {/* X-axis labels */}
                    {displayHistory.length >= 2 && (
                      <>
                        <SvgText x={paddingLeft} y={chartHeight - 8} fontSize={11} fill={currentTheme.colors.text + '60'} textAnchor="start">
                          {formatDate(displayHistory[0].date)}
                        </SvgText>
                        {displayHistory.length > 5 && (
                          <SvgText x={paddingLeft + graphWidth / 2} y={chartHeight - 8} fontSize={11} fill={currentTheme.colors.text + '60'} textAnchor="middle">
                            {formatDate(displayHistory[Math.floor(displayHistory.length / 2)].date)}
                          </SvgText>
                        )}
                        <SvgText x={paddingLeft + graphWidth} y={chartHeight - 8} fontSize={11} fill={currentTheme.colors.text + '60'} textAnchor="end">
                          {formatDate(displayHistory[displayHistory.length - 1].date)}
                        </SvgText>
                      </>
                    )}
                  </Svg>
                ) : (
                  <View style={styles.emptyChart}>
                    <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60' }]}>
                      No history data yet
                    </Text>
                  </View>
                )}
              </Card>

              {/* Category Breakdown or Individual Muscles */}
              {selectedCategory ? (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                      Muscles
                    </Text>
                    <TouchableOpacity
                      style={[styles.clearButton, { backgroundColor: currentTheme.colors.surface }]}
                      onPress={handleClearFilter}
                    >
                      <Text style={[styles.clearButtonText, { color: currentTheme.colors.text + '80' }]}>
                        Clear
                      </Text>
                      <Ionicons name="close" size={14} color={currentTheme.colors.text + '60'} />
                    </TouchableOpacity>
                  </View>
                  {MUSCLE_CATEGORIES[selectedCategory].muscles.map((muscle, index) => {
                    const musclePercentile = muscleGroups?.[muscle] || 0;
                    const muscleTier = getStrengthTier(musclePercentile);
                    const muscleTierColor = getTierColor(muscleTier);
                    const isLast = index === MUSCLE_CATEGORIES[selectedCategory].muscles.length - 1;

                    return (
                      <View
                        key={muscle}
                        style={[
                          styles.categoryRow,
                          { borderBottomColor: currentTheme.colors.border },
                          isLast && { borderBottomWidth: 0 }
                        ]}
                      >
                        <Text style={[styles.categoryLabel, { color: currentTheme.colors.text, width: 80 }]}>
                          {muscle.charAt(0).toUpperCase() + muscle.slice(1)}
                        </Text>
                        <View style={styles.categoryRight}>
                          <View style={[styles.progressBar, { backgroundColor: currentTheme.colors.surface }]}>
                            <View
                              style={[styles.progressFill, { width: `${musclePercentile}%`, backgroundColor: muscleTierColor }]}
                            />
                          </View>
                          <Text style={[styles.categoryValue, { color: muscleTierColor, fontFamily: currentTheme.fonts.semiBold }]}>
                            {musclePercentile}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold, marginBottom: 12 }]}>
                    By Category
                  </Text>
                  {Object.entries(MUSCLE_CATEGORIES).map(([key, category]) => {
                    const categoryKey = key as keyof typeof MUSCLE_CATEGORIES;
                    const categoryPercentile = getCategoryPercentile(categoryKey);
                    const catTier = getStrengthTier(categoryPercentile);
                    const catTierColor = getTierColor(catTier);

                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.categoryRow, { borderBottomColor: currentTheme.colors.border }]}
                        onPress={() => setSelectedCategory(categoryKey)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.categoryLabel, { color: currentTheme.colors.text }]}>
                          {category.label}
                        </Text>
                        <View style={styles.categoryRight}>
                          <View style={[styles.progressBar, { backgroundColor: currentTheme.colors.surface }]}>
                            <View
                              style={[styles.progressFill, { width: `${categoryPercentile}%`, backgroundColor: catTierColor }]}
                            />
                          </View>
                          <Text style={[styles.categoryValue, { color: catTierColor, fontFamily: currentTheme.fonts.semiBold }]}>
                            {categoryPercentile}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '40'} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </>
          ) : (
            <>
              {/* History List View */}
              <Card style={styles.historyCard}>
                {[...displayHistory].reverse().map((entry, index) => {
                  const currentPct = selectedCategory
                    ? getCategoryPercentileFromEntry(entry, selectedCategory)
                    : entry.percentile;
                  const prevEntry = displayHistory[displayHistory.length - 1 - index - 1];
                  const prevPct = prevEntry
                    ? (selectedCategory ? getCategoryPercentileFromEntry(prevEntry, selectedCategory) : prevEntry.percentile)
                    : currentPct;
                  const entryChange = currentPct - prevPct;
                  const entryTier = getStrengthTier(currentPct);
                  const entryTierColor = getTierColor(entryTier);
                  const isLast = index === displayHistory.length - 1;

                  return (
                    <View
                      key={entry.date}
                      style={[
                        styles.historyRow,
                        { borderBottomColor: currentTheme.colors.border },
                        isLast && styles.historyRowLast
                      ]}
                    >
                      <View style={styles.historyLeft}>
                        <Text style={[styles.historyDate, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                          {formatDateLong(entry.date)}
                        </Text>
                        {!selectedCategory && entry.muscleGroups && (
                          <Text style={[styles.historyDetail, { color: currentTheme.colors.text + '50' }]}>
                            Push {Math.round((entry.muscleGroups.chest + entry.muscleGroups.shoulders) / 2)} · Pull {Math.round((entry.muscleGroups.back + entry.muscleGroups.arms) / 2)} · Legs {Math.round((entry.muscleGroups.legs + entry.muscleGroups.glutes) / 2)}
                          </Text>
                        )}
                        {selectedCategory && entry.muscleGroups && (
                          <Text style={[styles.historyDetail, { color: currentTheme.colors.text + '50' }]}>
                            {MUSCLE_CATEGORIES[selectedCategory].muscles.map(m =>
                              `${m.charAt(0).toUpperCase() + m.slice(1)} ${entry.muscleGroups![m]}`
                            ).join(' · ')}
                          </Text>
                        )}
                      </View>
                      <View style={styles.historyRight}>
                        <Text style={[styles.historyValue, { color: entryTierColor, fontFamily: currentTheme.fonts.bold }]}>
                          {currentPct}
                        </Text>
                        {entryChange !== 0 && (
                          <Text style={[
                            styles.historyChange,
                            { color: entryChange > 0 ? '#22C55E' : '#EF4444' }
                          ]}>
                            {entryChange > 0 ? '+' : ''}{entryChange}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </Card>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  toggleText: {
    fontSize: 14,
  },
  chartCard: {
    padding: 12,
    marginBottom: 24,
  },
  emptyChart: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  clearButtonText: {
    fontSize: 13,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryLabel: {
    fontSize: 15,
    width: 50,
  },
  categoryRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryValue: {
    fontSize: 15,
    width: 28,
    textAlign: 'right',
  },
  historyCard: {
    padding: 0,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyRowLast: {
    borderBottomWidth: 0,
  },
  historyLeft: {
    flex: 1,
  },
  historyDate: {
    fontSize: 14,
  },
  historyDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyValue: {
    fontSize: 18,
  },
  historyChange: {
    fontSize: 12,
    marginTop: 2,
  },
});
