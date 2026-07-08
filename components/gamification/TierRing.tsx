import { getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  tier: StrengthTier;
  progress: number; // 0..1 toward the next tier
  size?: number;
  stroke?: number;
}

// Tier glyph inside a progress-to-next-tier ring; the ring sweeps up to its value so progress visibly advances.
export default function TierRing({ tier, progress, size = 42, stroke = 3 }: Props) {
  const { currentTheme } = useTheme();
  const ring = getTierColor(tier);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const center = size / 2;
  // Longer tiers (e.g. "S++") need a smaller glyph to fit the ring.
  const tierFont = tier.length >= 3 ? 13 : tier.length === 2 ? 15 : 17;

  const reduced = useReducedMotion();
  // Starts empty and sweeps to the real value once it arrives (data loads async).
  const fill = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      fill.value = clamped;
      return;
    }
    fill.value = withDelay(120, withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [clamped, reduced, fill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - fill.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={r} stroke={currentTheme.colors.text + '1F'} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke={ring}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          animatedProps={animatedProps}
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
