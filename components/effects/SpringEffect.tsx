import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Cherry blossom petal colors
const PETAL_COLORS = [
  '#FFB7C5', // Light pink
  '#FF99AC', // Medium pink
  '#FFDDE1', // Pale pink
  '#FFE4E8', // Very light pink
  '#FFC0CB', // Pink
];

interface Petal {
  id: number;
  x: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  drift: number;
  rotation: number;
  color: string;
}

const generatePetals = (count: number): Petal[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: Date.now() + i,
    x: Math.random() * SCREEN_WIDTH,
    size: 8 + Math.random() * 10,
    opacity: 0.6 + Math.random() * 0.3,
    delay: Math.random() * 6000,
    duration: 8000 + Math.random() * 6000,
    drift: (Math.random() - 0.5) * 100,
    rotation: Math.random() * 360,
    color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
  }));
};

const PetalComponent = ({ petal }: { petal: Petal }) => {
  const translateY = useSharedValue(-30);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(petal.rotation);

  useEffect(() => {
    translateY.value = withDelay(
      petal.delay,
      withRepeat(
        withTiming(SCREEN_HEIGHT + 30, {
          duration: petal.duration,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );

    translateX.value = withDelay(
      petal.delay,
      withRepeat(
        withSequence(
          withTiming(petal.drift, {
            duration: petal.duration / 3,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-petal.drift * 0.5, {
            duration: petal.duration / 3,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(petal.drift * 0.3, {
            duration: petal.duration / 3,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      )
    );

    rotate.value = withDelay(
      petal.delay,
      withRepeat(
        withTiming(petal.rotation + 360, {
          duration: petal.duration,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );
  }, [petal, translateY, translateX, rotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.petal,
        animatedStyle,
        {
          left: petal.x,
          width: petal.size,
          height: petal.size * 0.6,
          borderRadius: petal.size / 2,
          opacity: petal.opacity,
          backgroundColor: petal.color,
        },
      ]}
    />
  );
};

export interface SpringEffectProps {
  intervalMs: number;
}

export default function SpringEffect({ intervalMs }: SpringEffectProps) {
  const [isActive, setIsActive] = useState(true);
  const [petals, setPetals] = useState<Petal[]>(() => generatePetals(25));

  useEffect(() => {
    // Petal shower duration: 12-20 seconds
    const showerDuration = 12000 + Math.random() * 8000;

    const stopTimeout = setTimeout(() => {
      setIsActive(false);
      setPetals([]);
    }, showerDuration);

    const nextShowerTimeout = setTimeout(() => {
      setPetals(generatePetals(25));
      setIsActive(true);
    }, intervalMs);

    return () => {
      clearTimeout(stopTimeout);
      clearTimeout(nextShowerTimeout);
    };
  }, [isActive, intervalMs]);

  if (!isActive || petals.length === 0) return null;

  return (
    <>
      {petals.map(petal => (
        <PetalComponent key={petal.id} petal={petal} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  petal: {
    position: 'absolute',
    shadowColor: '#FF69B4',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});
