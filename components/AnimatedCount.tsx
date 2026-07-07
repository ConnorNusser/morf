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
  value: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** Text number that tweens to `value` on change; honors OS Reduce Motion by snapping. */
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
  // Start at 0 so the first mount counts up from zero.
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduced) {
      progress.value = value;
      setDisplay(value);
      return;
    }
    const tween = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
    progress.value = delay > 0 ? withDelay(delay, tween) : tween;
  }, [value, duration, delay, reduced, progress]);

  useAnimatedReaction(
    () => progress.value,
    current => {
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
