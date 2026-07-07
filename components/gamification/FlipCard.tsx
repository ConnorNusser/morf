import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  /** Both faces are absolutely stacked, so the card needs a fixed height. */
  height: number;
  style?: StyleProp<ViewStyle>;
}

// Tap-to-flip card on a single rotateY; faces hidden via backfaceVisibility. Honors Reduce Motion (snaps instead of spinning).
export default function FlipCard({ front, back, height, style }: FlipCardProps) {
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const rot = useSharedValue(0);

  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    const to = next ? 180 : 0;
    rot.value = reduced
      ? to
      : withTiming(to, { duration: 460, easing: Easing.inOut(Easing.cubic) });
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${rot.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${rot.value + 180}deg` }],
  }));

  return (
    <Pressable onPress={toggle} style={[{ height }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.face, frontStyle]}>
        {front}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.face, backStyle]}>
        {back}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: { backfaceVisibility: 'hidden' },
});
