import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Counts a displayed integer up to `target` (from `from` on first mount, then
 * from wherever it currently is when `target` changes). Honors OS Reduce Motion.
 */
export default function useCountUp(
  target: number,
  { from = 0, duration = 800 }: { from?: number; duration?: number } = {},
): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? target : Math.round(from));
  const value = useRef(new Animated.Value(from)).current;

  useEffect(() => {
    if (reduced) {
      setShown(target);
      return;
    }
    const id = value.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(value, { toValue: target, duration, useNativeDriver: false }).start();
    return () => value.removeListener(id);
  }, [target, duration, reduced, value]);

  return shown;
}
