// Expanded-row weight history: line plot over sessions plus start/current/sessions summary.

import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { WeightDataPoint } from '@/lib/history/routineProgress';
import { radius, space, trend } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface WeightHistoryChartProps {
  data: WeightDataPoint[];
  unit: string;
}

export default function WeightHistoryChart({ data, unit }: WeightHistoryChartProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const colors = currentTheme.colors;

  if (data.length < 1) return null;

  const weights = data.map(d => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const chartWidth = 280;
  const chartHeight = 100;
  const paddingBottom = 24;
  const paddingTop = 16;
  const graphHeight = chartHeight - paddingBottom - paddingTop;

  const points = data.map((d, i) => ({
    x: data.length === 1 ? chartWidth / 2 : (i / (data.length - 1)) * chartWidth,
    y: paddingTop + graphHeight - ((d.weight - min) / range) * graphHeight,
    weight: d.weight,
    session: d.sessionNumber,
  }));

  const startWeight = data[0].weight;
  const endWeight = data[data.length - 1].weight;
  const totalChange = endWeight - startWeight;

  return (
    <View style={[styles.chartContainer, { backgroundColor: colors.background }]}>
      <View style={styles.chartHeader}>
        <Text variant="meta" tone="muted">
          Weight History
        </Text>
        {totalChange !== 0 && (
          <Text
            variant="meta"
            weight="semiBold"
            style={{ color: totalChange > 0 ? trend.up : trend.down }}
          >
            {totalChange > 0 ? '+' : ''}{totalChange} {unit}
          </Text>
        )}
      </View>

      <View style={{ width: chartWidth, height: chartHeight }}>
        {/* Y-axis fontSize is chart geometry (fits the fixed 100pt plot). */}
        <Text style={[styles.yLabel, { top: paddingTop - 6, color: ink.faint }]}>
          {max}
        </Text>
        <Text style={[styles.yLabel, { top: paddingTop + graphHeight - 6, color: ink.faint }]}>
          {min}
        </Text>

        <View style={[styles.gridLine, { top: paddingTop, backgroundColor: colors.border }]} />
        <View style={[styles.gridLine, { top: paddingTop + graphHeight / 2, backgroundColor: colors.border }]} />
        <View style={[styles.gridLine, { top: paddingTop + graphHeight, backgroundColor: colors.border }]} />

        {points.slice(1).map((point, i) => {
          const prev = points[i];
          const length = Math.sqrt(Math.pow(point.x - prev.x, 2) + Math.pow(point.y - prev.y, 2));
          const angle = Math.atan2(point.y - prev.y, point.x - prev.x) * 180 / Math.PI;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: prev.x,
                top: prev.y,
                width: length,
                height: 2,
                backgroundColor: colors.primary,
                borderRadius: 1,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          );
        })}

        {points.map((point, i) => (
          <View
            key={i}
            style={[
              styles.dataPoint,
              {
                left: point.x - 4,
                top: point.y - 4,
                backgroundColor: colors.primary,
                borderColor: colors.background,
              },
            ]}
          />
        ))}

        <View style={styles.xLabels}>
          {points.length <= 6 ? (
            points.map((point, i) => (
              <Text
                key={i}
                style={[styles.xLabel, { left: point.x - 8, color: ink.faint }]}
              >
                #{point.session}
              </Text>
            ))
          ) : (
            <>
              <Text style={[styles.xLabel, { left: points[0].x - 8, color: ink.faint }]}>
                #{points[0].session}
              </Text>
              <Text style={[styles.xLabel, { left: points[points.length - 1].x - 8, color: ink.faint }]}>
                #{points[points.length - 1].session}
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.chartSummary}>
        <View style={styles.summaryItem}>
          <Text variant="meta" tone="faint" style={styles.summaryItemLabel}>
            Start
          </Text>
          <Text variant="meta" tone="primary" weight="medium">
            {startWeight} {unit}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text variant="meta" tone="faint" style={styles.summaryItemLabel}>
            Current
          </Text>
          <Text variant="meta" tone="primary" weight="medium">
            {endWeight} {unit}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text variant="meta" tone="faint" style={styles.summaryItemLabel}>
            Sessions
          </Text>
          <Text variant="meta" tone="primary" weight="medium">
            {data.length}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    borderRadius: radius.card,
    padding: space.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  // Axis labels keep 10pt: chart geometry against the fixed 280×100 plot.
  yLabel: {
    position: 'absolute',
    left: -4,
    fontSize: 10,
  },
  gridLine: {
    position: 'absolute',
    left: 20,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  xLabels: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
  },
  xLabel: {
    position: 'absolute',
    bottom: 0,
    fontSize: 10,
  },
  chartSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: space.md,
    paddingTop: space.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryItemLabel: {
    marginBottom: space.xs,
  },
  summaryDivider: {
    width: 1,
    height: 24,
  },
});
