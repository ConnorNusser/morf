import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  level: number;
  progress: number; // 0..1 toward next level
  size?: number;
  stroke?: number;
  color?: string;
}

// Compact level badge: the level number inside a circular XP-progress ring.
// Self-contained and tappable (wrap in a touchable) — a clean gamification mark.
export default function LevelRing({ level, progress, size = 40, stroke = 3, color }: Props) {
  const { currentTheme } = useTheme();
  const ring = color ?? currentTheme.colors.primary;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle cx={center} cy={center} r={r} stroke={currentTheme.colors.text + '1F'} strokeWidth={stroke} fill="none" />
        {/* Progress arc — start at top (rotate -90°), clockwise */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={ring}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.num, { color: currentTheme.colors.text }]}>{level}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 15, fontWeight: '700' },
});
