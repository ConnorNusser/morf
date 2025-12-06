import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface MiniSparklineProps {
  data: number[]; // Array of values (typically 6 periods)
  height?: number;
  width?: number;
  barWidth?: number;
  gap?: number;
}

export default function MiniSparkline({
  data,
  height = 24,
  width = 60,
  barWidth = 6,
  gap = 3,
}: MiniSparklineProps) {
  const { currentTheme: _currentTheme } = useTheme();

  if (!data || data.length === 0) {
    return null;
  }

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  // Determine trend: compare first half avg to second half avg
  const midpoint = Math.floor(data.length / 2);
  const firstHalfAvg = data.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
  const secondHalfAvg = data.slice(midpoint).reduce((a, b) => a + b, 0) / (data.length - midpoint);
  const isUpward = secondHalfAvg >= firstHalfAvg;

  const trendColor = isUpward ? '#00C85C' : '#FF6B6B';

  return (
    <View style={[styles.container, { height, width }]}>
      {data.map((value, index) => {
        // Normalize height: min 15%, max 100%
        const normalizedHeight = ((value - minValue) / range) * 0.85 + 0.15;
        const barHeight = Math.max(height * normalizedHeight, 3);

        // Fade older bars slightly
        const opacity = 0.4 + (index / (data.length - 1)) * 0.6;

        return (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: barHeight,
                width: barWidth,
                backgroundColor: trendColor,
                opacity,
                marginLeft: index > 0 ? gap : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 2,
  },
});
