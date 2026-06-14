import React, { useEffect, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedCountProps {
  /** Target value to count up (or down) to. */
  value: number;
  /** Tween duration in ms. */
  duration?: number;
  /** Delay before the count starts (e.g. to line up with an entrance). */
  delay?: number;
  /** Decimal places to render. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * A number that tweens from its previous value to `value` whenever it changes —
 * a small, satisfying "rolling up" effect for hero stats. Renders a plain Text
 * so it inherits normal text layout. Honors the OS "Reduce Motion" setting by
 * snapping straight to the value.
 */
export default function AnimatedCount({
  value,
  duration = 1000,
  delay = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  style,
  numberOfLines,
}: AnimatedCountProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduced) {
      progress.value = value;
      setDisplay(value);
      return;
    }
    const tween = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
    progress.value = delay > 0 ? withDelay(delay, tween) : tween;
  }, [value, duration, delay, reduced, progress]);

  // Mirror the UI-thread shared value back to React state so a real <Text>
  // renders the in-flight number. One-shot tweens, so the churn is brief.
  useAnimatedReaction(
    () => progress.value,
    (current) => {
      runOnJS(setDisplay)(current);
    },
  );

  return (
    <Text style={style} numberOfLines={numberOfLines} allowFontScaling={false}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </Text>
  );
}
