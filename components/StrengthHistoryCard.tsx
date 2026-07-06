import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity } from 'react-native';
import { formatShortDate as formatDate } from '@/lib/ui/formatters';
import { type as typeScale } from '@/lib/ui/typography';
import Svg, { Path, Line, Text as SvgText, Circle } from 'react-native-svg';
import Card from './Card';
import StrengthHistoryModal from './StrengthHistoryModal';
import { Text } from './Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { userSyncService } from '@/lib/services/userSyncService';
import { PercentileHistoryEntry } from '@/types';
import { Ionicons } from '@expo/vector-icons';

interface StrengthHistoryCardProps {
  userId?: string;
}

function StrengthHistoryCard({ userId }: StrengthHistoryCardProps) {
  const { currentTheme } = useTheme();
  const [history, setHistory] = useState<PercentileHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const user = userId ? { id: userId } : await userSyncService.getCurrentUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const data = await userSyncService.getUserPercentileData(user.id);
      if (data?.percentile_history) {
        setHistory(data.percentile_history);
      }
    } catch (error) {
      console.error('Error loading strength history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Refresh on focus (e.g. after logging a workout updates percentile data), matching
  // the parent History screen — otherwise this card lags the rest of the page.
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  // Don't render if no history or loading
  if (isLoading || history.length === 0) {
    return null;
  }

  // Chart dimensions
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 72; // Card padding + internal padding
  const chartHeight = 120;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 20;
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // Get last 30 entries max for display
  const displayHistory = history.slice(-30);

  // Calculate min/max for Y axis
  const percentiles = displayHistory.map(h => h.percentile);
  const minPercentile = Math.max(0, Math.min(...percentiles) - 5);
  const maxPercentile = Math.min(100, Math.max(...percentiles) + 5);
  const range = maxPercentile - minPercentile || 1;

  // Calculate points
  const points = displayHistory.map((entry, index) => {
    // Handle single data point case - center it
    const x = displayHistory.length === 1
      ? paddingLeft + graphWidth / 2
      : paddingLeft + (index / (displayHistory.length - 1)) * graphWidth;
    const y = paddingTop + graphHeight - ((entry.percentile - minPercentile) / range) * graphHeight;
    return { x, y, percentile: entry.percentile, date: entry.date };
  });

  // Create SVG path
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Create gradient fill path (area under the line)
  const areaPath = `${pathData} L ${points[points.length - 1].x} ${paddingTop + graphHeight} L ${paddingLeft} ${paddingTop + graphHeight} Z`;

  // Calculate change
  const firstValue = displayHistory[0].percentile;
  const lastValue = displayHistory[displayHistory.length - 1].percentile;
  const change = lastValue - firstValue;
  const changeText = change > 0 ? `+${change}` : `${change}`;
  const changeColor = change > 0 ? '#22C55E' : change < 0 ? '#EF4444' : currentTheme.colors.text + '60';

  // Format date for display

  return (
    <>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setShowModal(true)}>
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: currentTheme.colors.text, fontWeight: '600' }]}>
              Strength Over Time
            </Text>
            <View style={styles.headerRight}>
              <View style={styles.changeContainer}>
                <Text style={[styles.changeText, { color: changeColor, fontWeight: '500' }]}>
                  {changeText}%
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '40'} />
            </View>
          </View>

      <Svg width={chartWidth} height={chartHeight}>
        {/* Grid lines */}
        <Line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={paddingTop + graphHeight}
          stroke={currentTheme.colors.border}
          strokeWidth={1}
        />
        <Line
          x1={paddingLeft}
          y1={paddingTop + graphHeight}
          x2={paddingLeft + graphWidth}
          y2={paddingTop + graphHeight}
          stroke={currentTheme.colors.border}
          strokeWidth={1}
        />

        {/* Y-axis labels */}
        <SvgText
          x={paddingLeft - 5}
          y={paddingTop + 4}
          fontSize={10}
          fill={currentTheme.colors.text + '60'}
          textAnchor="end"
        >
          {Math.round(maxPercentile)}
        </SvgText>
        <SvgText
          x={paddingLeft - 5}
          y={paddingTop + graphHeight}
          fontSize={10}
          fill={currentTheme.colors.text + '60'}
          textAnchor="end"
        >
          {Math.round(minPercentile)}
        </SvgText>

        {/* Area fill */}
        <Path
          d={areaPath}
          fill={currentTheme.colors.primary + '20'}
        />

        {/* Line */}
        <Path
          d={pathData}
          fill="none"
          stroke={currentTheme.colors.primary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point dot */}
        <Circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill={currentTheme.colors.primary}
        />

        {/* X-axis labels (first and last date, or centered single date) */}
        {displayHistory.length === 1 ? (
          <SvgText
            x={paddingLeft + graphWidth / 2}
            y={chartHeight - 2}
            fontSize={10}
            fill={currentTheme.colors.text + '60'}
            textAnchor="middle"
          >
            {formatDate(displayHistory[0].date)}
          </SvgText>
        ) : (
          <>
            <SvgText
              x={paddingLeft}
              y={chartHeight - 2}
              fontSize={10}
              fill={currentTheme.colors.text + '60'}
              textAnchor="start"
            >
              {formatDate(displayHistory[0].date)}
            </SvgText>
            <SvgText
              x={paddingLeft + graphWidth}
              y={chartHeight - 2}
              fontSize={10}
              fill={currentTheme.colors.text + '60'}
              textAnchor="end"
            >
              {formatDate(displayHistory[displayHistory.length - 1].date)}
            </SvgText>
          </>
        )}
      </Svg>

        <Text style={[styles.subtitle, { color: currentTheme.colors.text + '60', fontWeight: '400' }]}>
          {displayHistory.length} data point{displayHistory.length !== 1 ? 's' : ''} • Tap for details
        </Text>
        </Card>
      </TouchableOpacity>

      <StrengthHistoryModal
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

export default React.memo(StrengthHistoryCard);

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: typeScale.body,
  },
  changeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  changeText: {
    fontSize: typeScale.meta,
  },
  subtitle: {
    fontSize: typeScale.meta,
    marginTop: 8,
    textAlign: 'center',
  },
});
