import { Text, useInk } from '@/components/Themed';
import { space } from '@/lib/ui/tokens';
import { PercentileHistoryEntry } from '@/types';
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

interface PercentileSparklineProps {
  /** Chronological percentile history — needs ≥2 entries to draw a line. */
  history: PercentileHistoryEntry[];
  /** Stroke color — the user's tier color. */
  color: string;
  height?: number;
}

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Compact percentile trend with just enough anchors to read it: start/end
 * percentile values on the line, a peak marker when the high point isn't an
 * endpoint, and start/end dates underneath. One stroke, gradient fill.
 */
export default function PercentileSparkline({ history, color, height = 72 }: PercentileSparklineProps) {
  const ink = useInk();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Side gutters make room for the endpoint value labels; top for the peak label.
  const padX = 26;
  const padTop = 16;
  const padBottom = 6;
  const values = history.map(h => h.percentile);
  const min = Math.max(0, Math.min(...values) - 5);
  const max = Math.min(100, Math.max(...values) + 5);
  const range = max - min || 1;

  const points = width > 0
    ? history.map((entry, i) => ({
        x: padX + (i / (history.length - 1)) * (width - padX * 2),
        y: padTop + (height - padTop - padBottom) * (1 - (entry.percentile - min) / range),
      }))
    : [];

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const area = points.length > 0
    ? `${line} L ${last.x} ${height} L ${first.x} ${height} Z`
    : '';

  // Flag the all-time high of the window when it isn't the first/last entry.
  const peakIndex = values.indexOf(Math.max(...values));
  const showPeak = peakIndex > 0 && peakIndex < values.length - 1 && values[peakIndex] > values[values.length - 1];
  const peak = points[peakIndex];

  return (
    <View>
      <View onLayout={onLayout} style={{ height }}>
        {points.length > 1 && (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#sparkFill)" />
            <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {/* start value, left of the line */}
            <Circle cx={first.x} cy={first.y} r={2.5} fill={ink.muted} />
            <SvgText x={first.x - 6} y={first.y + 4} fill={ink.secondary} fontSize={12} fontWeight="600" textAnchor="end">
              {values[0]}
            </SvgText>
            {/* peak marker, when the high point is mid-window */}
            {showPeak && (
              <>
                <Circle cx={peak.x} cy={peak.y} r={2.5} fill={ink.muted} />
                <SvgText x={peak.x} y={peak.y - 7} fill={ink.muted} fontSize={11} fontWeight="600" textAnchor="middle">
                  {values[peakIndex]}
                </SvgText>
              </>
            )}
            {/* current value, right of the end dot, in the tier color */}
            <Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
            <SvgText x={last.x + 7} y={last.y + 4} fill={color} fontSize={12} fontWeight="700" textAnchor="start">
              {values[values.length - 1]}
            </SvgText>
          </Svg>
        )}
      </View>
      <View style={styles.dateRow}>
        <Text variant="meta" tone="faint">{formatDay(history[0].date)}</Text>
        <Text variant="meta" tone="faint">Percentile</Text>
        <Text variant="meta" tone="faint">{formatDay(history[history.length - 1].date)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xs,
  },
});
