import { getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  tier: StrengthTier;
  progress: number; // 0..1 toward the next tier
  size?: number;
  stroke?: number;
}

// Compact strength badge: the tier inside a circular progress-to-next-tier ring.
// Self-contained and tappable (wrap in a touchable) — the lifter's headline rank.
export default function TierRing({ tier, progress, size = 42, stroke = 3 }: Props) {
  const { currentTheme } = useTheme();
  const ring = getTierColor(tier);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const center = size / 2;
  // Longer tiers (e.g. "S++") need a smaller glyph to fit the ring.
  const tierFont = tier.length >= 3 ? 13 : tier.length === 2 ? 15 : 17;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={r} stroke={currentTheme.colors.text + '1F'} strokeWidth={stroke} fill="none" />
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
        <Text style={[styles.label, { color: ring }]}>TIER</Text>
        <Text style={[styles.tier, { color: currentTheme.colors.text, fontSize: tierFont }]}>{tier}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 7, fontWeight: '700', letterSpacing: 0.5, marginBottom: -2 },
  tier: { fontWeight: '800' },
});
