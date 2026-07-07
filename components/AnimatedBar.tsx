import React, { useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedBarProps {
  /** Fill fraction 0..1. */
  progress: number;
  color: string;
  trackColor: string;
  height?: number;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/** Progress bar; fill tweens to `progress` on mount, honors OS Reduce Motion. */
export default function AnimatedBar({
  progress,
  color,
  trackColor,
  height = 6,
  delay = 0,
  duration = 900,
  style,
}: AnimatedBarProps) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, progress));
    if (reduced) {
      p.value = clamped;
      return;
    }
    const tween = withTiming(clamped, { duration, easing: Easing.out(Easing.cubic) });
    p.value = delay > 0 ? withDelay(delay, tween) : tween;
  }, [progress, reduced, p, duration, delay]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${p.value * 100}%`,
  }));

  return (
    <View style={[{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: trackColor }, style]}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fillStyle]} />
    </View>
  );
}
