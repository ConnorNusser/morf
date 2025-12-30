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

interface Snowflake {
  id: number;
  x: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  drift: number;
}

const generateSnowflakes = (count: number): Snowflake[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: Date.now() + i,
    x: Math.random() * SCREEN_WIDTH,
    size: 3 + Math.random() * 5,
    opacity: 0.4 + Math.random() * 0.4,
    delay: Math.random() * 8000,
    duration: 6000 + Math.random() * 6000,
    drift: (Math.random() - 0.5) * 60,
  }));
};

const SnowflakeComponent = ({ snowflake }: { snowflake: Snowflake }) => {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      snowflake.delay,
      withRepeat(
        withTiming(SCREEN_HEIGHT + 20, {
          duration: snowflake.duration,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );

    translateX.value = withDelay(
      snowflake.delay,
      withRepeat(
        withSequence(
          withTiming(snowflake.drift, {
            duration: snowflake.duration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(-snowflake.drift, {
            duration: snowflake.duration / 2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        true
      )
    );
  }, [snowflake, translateY, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.snowflake,
        animatedStyle,
        {
          left: snowflake.x,
          width: snowflake.size,
          height: snowflake.size,
          borderRadius: snowflake.size / 2,
          opacity: snowflake.opacity,
        },
      ]}
    />
  );
};

export interface SnowEffectProps {
  intervalMs: number;
}

export default function SnowEffect({ intervalMs }: SnowEffectProps) {
  const [isSnowing, setIsSnowing] = useState(true);
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>(() => generateSnowflakes(30));

  useEffect(() => {
    // Snow duration: 15-30 seconds
    const snowDuration = 15000 + Math.random() * 15000;

    const stopTimeout = setTimeout(() => {
      setIsSnowing(false);
      setSnowflakes([]);
    }, snowDuration);

    const nextSnowTimeout = setTimeout(() => {
      setSnowflakes(generateSnowflakes(30));
      setIsSnowing(true);
    }, intervalMs);

    return () => {
      clearTimeout(stopTimeout);
      clearTimeout(nextSnowTimeout);
    };
  }, [isSnowing, intervalMs]);

  if (!isSnowing || snowflakes.length === 0) return null;

  return (
    <>
      {snowflakes.map(flake => (
        <SnowflakeComponent key={flake.id} snowflake={flake} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  snowflake: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
});
