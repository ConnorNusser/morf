// The arrival light show: a soft bloom behind the header and embers rising
// over the content.
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const EMBER_GOLD = require('@/assets/images/celebration/ember-gold.png');
const EMBER_BLUE = require('@/assets/images/celebration/ember-blue.png');

// A glowing ember that rises from the bottom of the screen, drifts, and fades —
// the confetti replacement, built from generated glow sprites (real alpha).
const Ember = ({ delay, startX, size, sprite }: { delay: number; startX: number; size: number; sprite: number }) => {
  const translateY = useSharedValue(SCREEN_HEIGHT * (0.7 + Math.random() * 0.3));
  const translateX = useSharedValue(startX);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    const duration = 3200 + Math.random() * 1200;
    // One sequence per value — a second assignment would replace the first
    // animation before it ever runs.
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(0.9, { duration: 500 }),
        withDelay(duration - 1700, withTiming(0, { duration: 1200 })),
      ),
    );
    scale.value = withDelay(delay, withSpring(1, { damping: 10 }));
    translateY.value = withDelay(
      delay,
      withTiming(-size, { duration, easing: Easing.out(Easing.quad) })
    );
    const drift = (Math.random() - 0.5) * 140;
    translateX.value = withDelay(
      delay,
      withTiming(startX + drift, { duration, easing: Easing.inOut(Easing.sin) })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Animation runs once on mount
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Image
      source={sprite}
      style={[styles.ember, { width: size, height: size }, animatedStyle]}
    />
  );
};

// One soft bloom behind the header on arrival — swells in, then settles low.
export const BurstGlow = () => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = withSequence(
      withTiming(0.55, { duration: 700 }),
      withDelay(1100, withTiming(0.3, { duration: 1500 })),
    );
    scale.value = withSpring(1, { damping: 12, stiffness: 60 });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Animation runs once on mount
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return (
    <Animated.Image source={EMBER_GOLD} style={[styles.burst, style]} />
  );
};

export function RisingEmbers() {
  // Rising embers, gold-heavy with a few theme-blue sparks mixed in.
  const embers = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        delay: Math.random() * 900,
        startX: Math.random() * SCREEN_WIDTH,
        size: 16 + Math.random() * 26,
        sprite: i % 3 === 2 ? EMBER_BLUE : EMBER_GOLD,
      })),
    [],
  );

  return (
    <>
      {embers.map((e) => (
        <Ember key={e.id} delay={e.delay} startX={e.startX} size={e.size} sprite={e.sprite} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  ember: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
  // Soft bloom behind the header; sized off the screen so it reads as light, not a sprite.
  burst: {
    position: 'absolute',
    top: -SCREEN_WIDTH * 0.35,
    alignSelf: 'center',
    width: SCREEN_WIDTH * 1.3,
    height: SCREEN_WIDTH * 1.3,
    pointerEvents: 'none',
  },
});
