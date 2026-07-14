// Shared visual kit for the league surfaces (board + home card): the motion
// system, rank-tier color mapping, ring gauge, composition bar, and press
// feedback. One implementation so the card and board can't drift apart.
import { Text } from '@/components/Themed';
import { getStrengthTier, getTierColor, TIER_COLORS } from '@/lib/data/strengthStandards';
import { formatCompact } from '@/lib/utils/utils';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Motion system (M3 Expressive): emphasized-decelerate for spatial entrances,
// springs only for objects that move, timing sweeps for gauges.
export const EMPHASIZED_DECEL = Easing.bezier(0.05, 0.7, 0.1, 1);

// Gold = glory (leader, PRs, champion) — the one hue outside the tier ladder.
export const GOLD = TIER_COLORS.S;

export const pts = (value: number) => formatCompact(value);

/**
 * Rank mapped through the tier ladder, relative to the field: 1st of N sits at
 * the 100th percentile (S gold), last at the 0th (E gray). `pure` colors
 * strokes and fills; `text` is lifted toward white so numerals clear contrast.
 */
export const rankTierColors = (
  rank: number | null,
  field: number,
): { pure: string; text: string } | null => {
  if (rank == null || field < 2) return null;
  const percentile = ((field - rank) / (field - 1)) * 100;
  const pure = getTierColor(getStrengthTier(percentile));
  return { pure, text: lightenForText(pure) };
};

export const lightenForText = (hex: string, amount = 0.35): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

/** UI-thread count-up on the emphasized-decelerate curve. */
export function useCountUp(target: number, duration = 600): number {
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(80, withTiming(target, { duration, easing: EMPHASIZED_DECEL }));
  }, [target, duration, progress]);
  useAnimatedReaction(
    () => Math.round(progress.value),
    (value, previous) => {
      if (value !== previous) runOnJS(setDisplay)(value);
    },
  );
  return display;
}

/** Spatial entrance on the emphasized-decelerate curve (web-safe, no Keyframe). */
export function FadeSlideIn({
  delay = 0,
  distance = 10,
  style,
  children,
}: {
  delay?: number;
  distance?: number;
  style?: object;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 350, easing: EMPHASIZED_DECEL }));
  }, [delay, progress]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Press feedback: a quick spring scale — interaction lands within a frame. */
export function PressableScale({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: object;
  children: React.ReactNode;
}) {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
  }));
  return (
    <TouchableOpacity
      onPressIn={() => { pressed.value = withTiming(1, { duration: 80 }); }}
      onPressOut={() => { pressed.value = withSpring(0, { damping: 14, stiffness: 400 }); }}
      onPress={onPress}
      activeOpacity={1}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

/** Height-animated disclosure: expanding pushes siblings smoothly (no snap). */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const height = useSharedValue(0);
  const measured = useSharedValue(0);
  useEffect(() => {
    height.value = withTiming(open ? measured.value : 0, { duration: 300, easing: EMPHASIZED_DECEL });
  }, [open, height, measured]);
  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: measured.value > 0 ? Math.min(1, height.value / measured.value) : 0,
  }));
  return (
    <Animated.View style={[styles.collapse, animatedStyle]}>
      <RNView
        style={styles.collapseInner}
        onLayout={e => {
          measured.value = e.nativeEvent.layout.height;
          if (open) height.value = withTiming(e.nativeEvent.layout.height, { duration: 300, easing: EMPHASIZED_DECEL });
        }}
      >
        {children}
      </RNView>
    </Animated.View>
  );
}

/**
 * Share-of-leader × composition bar with a slow specular sweep across the
 * fill — the board's one piece of linear ambient motion.
 */
export function CompositionBar({
  sharePct,
  volumePoints,
  prPoints,
  accent,
  trackColor,
  height = 5,
  style,
}: {
  sharePct: number;
  volumePoints: number;
  prPoints: number;
  accent: string;
  trackColor: string;
  height?: number;
  style?: object;
}) {
  const [trackW, setTrackW] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(
      withDelay(900, withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) })),
      -1,
      false,
    );
  }, [sweep]);
  const fillW = (trackW * Math.min(100, Math.max(sharePct, 0.5))) / 100;
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -48 + sweep.value * (fillW + 96) }],
  }));

  return (
    <RNView
      style={[styles.barTrack, { backgroundColor: trackColor, height, borderRadius: height / 2 }, style]}
      onLayout={e => setTrackW(e.nativeEvent.layout.width)}
    >
      <RNView style={[styles.barFill, { width: fillW, borderRadius: height / 2 }]}>
        {volumePoints > 0 && <RNView style={{ flex: volumePoints, backgroundColor: accent }} />}
        {prPoints > 0 && <RNView style={{ flex: prPoints, backgroundColor: GOLD }} />}
        <Animated.View pointerEvents="none" style={[styles.sweepBand, sweepStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.18)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sweepFill}
          />
        </Animated.View>
      </RNView>
    </RNView>
  );
}

/**
 * WHOOP-style ring: share of the leader's total, rank centered, a breathing
 * tip dot at the arc's leading edge.
 */
export function RankRing({
  pct,
  rank,
  field,
  color,
  trackColor,
  size = 96,
}: {
  pct: number;
  rank: number | null;
  field: number;
  color: string;
  trackColor: string;
  size?: number;
}) {
  const strokeWidth = size >= 72 ? 7 : 5;
  const TIP_R = strokeWidth / 2 + 2;
  // Inset the ring by the tip dot's overhang so it never clips the canvas.
  const r = (size - strokeWidth) / 2 - (TIP_R - strokeWidth / 2) - 1;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);
  useEffect(() => {
    // A gauge is a measurement, not an object in motion: one decelerating
    // sweep, no overshoot (an underdamped spring here reads as error).
    progress.value = withTiming(pct, { duration: 700, easing: EMPHASIZED_DECEL });
  }, [pct, progress]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.min(progress.value, 100) / 100),
  }));

  // The tip breathes gently — ambient life without the loading-spinner read
  // an orbiting arc gives a circle.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);
  const tipProps = useAnimatedProps(() => {
    const angle = (Math.PI / 180) * ((Math.min(progress.value, 100) / 100) * 360 - 90);
    return {
      cx: size / 2 + r * Math.cos(angle),
      cy: size / 2 + r * Math.sin(angle),
      r: TIP_R * (1 + pulse.value * 0.25),
      opacity: progress.value > 2 ? 0.75 + pulse.value * 0.25 : 0,
    };
  });

  return (
    <RNView style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <AnimatedCircle fill="#FFFFFF" animatedProps={tipProps} />
      </Svg>
      <RNView style={styles.ringCenter}>
        <Text variant={size >= 72 ? 'title' : 'meta'} weight="bold" tone="primary">
          {rank != null ? `#${rank}` : '—'}
        </Text>
        {size >= 72 && rank != null && field > 1 && (
          <Text variant="meta" tone="muted">of {field}</Text>
        )}
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  collapse: {
    overflow: 'hidden',
  },
  collapseInner: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  barTrack: {
    overflow: 'hidden',
  },
  barFill: {
    flexDirection: 'row',
    height: '100%',
    overflow: 'hidden',
  },
  sweepBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 48,
  },
  sweepFill: {
    flex: 1,
  },
  ringCenter: {
    alignItems: 'center',
  },
});
