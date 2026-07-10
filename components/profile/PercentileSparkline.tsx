import { PercentileHistoryEntry } from '@/types';
import React, { useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

interface PercentileSparklineProps {
  /** Chronological percentile history — needs ≥2 entries to draw a line. */
  history: PercentileHistoryEntry[];
  /** Stroke color — the user's tier color. */
  color: string;
  height?: number;
}

/**
 * Compact, axis-free percentile trend: one stroke, a soft gradient fill, and
 * an end dot. Width-responsive via onLayout so it fills whatever card it's in.
 */
export default function PercentileSparkline({ history, color, height = 56 }: PercentileSparklineProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pad = 4;
  const values = history.map(h => h.percentile);
  const min = Math.max(0, Math.min(...values) - 5);
  const max = Math.min(100, Math.max(...values) + 5);
  const range = max - min || 1;

  const points = width > 0
    ? history.map((entry, i) => ({
        x: pad + (i / (history.length - 1)) * (width - pad * 2),
        y: pad + (height - pad * 2) * (1 - (entry.percentile - min) / range),
      }))
    : [];

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const last = points[points.length - 1];
  const area = points.length > 0
    ? `${line} L ${last.x} ${height} L ${points[0].x} ${height} Z`
    : '';

  return (
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
          <Circle cx={last.x} cy={last.y} r={3.5} fill={color} />
        </Svg>
      )}
    </View>
  );
}
