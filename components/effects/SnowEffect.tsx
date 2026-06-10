import React, { memo, useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Module-level state to track snow timing across remounts
let lastSnowStartTime: number | null = null;
let lastSnowEndTime: number | null = null;

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

const SnowflakeComponent = memo(function SnowflakeComponent({ snowflake }: { snowflake: Snowflake }) {
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

    // Cleanup animations on unmount
    return () => {
      cancelAnimation(translateY);
      cancelAnimation(translateX);
    };
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
});

export interface SnowEffectProps {
  intervalMs: number;
}

const SNOWFLAKE_COUNT = 25;

export default function SnowEffect({ intervalMs }: SnowEffectProps) {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>(() => {
    const now = Date.now();

    // Check if we should be snowing based on wall-clock time
    if (lastSnowStartTime !== null && lastSnowEndTime !== null) {
      // Currently in a snow session that hasn't ended yet
      if (now < lastSnowEndTime) {
        return generateSnowflakes(SNOWFLAKE_COUNT);
      }
      // Check if interval has passed since last snow ended
      if (now - lastSnowEndTime < intervalMs) {
        return []; // Still waiting for next snow
      }
    }

    // Start a new snow session
    const snowDuration = 15000 + Math.random() * 15000;
    lastSnowStartTime = now;
    lastSnowEndTime = now + snowDuration;
    return generateSnowflakes(SNOWFLAKE_COUNT);
  });

  useEffect(() => {
    if (snowflakes.length === 0) {
      // Not currently snowing - schedule next snow based on wall-clock time
      const now = Date.now();
      const timeUntilNextSnow = lastSnowEndTime
        ? Math.max(0, (lastSnowEndTime + intervalMs) - now)
        : intervalMs;

      const nextSnowTimeout = setTimeout(() => {
        const snowDuration = 15000 + Math.random() * 15000;
        lastSnowStartTime = Date.now();
        lastSnowEndTime = Date.now() + snowDuration;
        setSnowflakes(generateSnowflakes(SNOWFLAKE_COUNT));
      }, timeUntilNextSnow);

      return () => clearTimeout(nextSnowTimeout);
    } else {
      // Currently snowing - schedule stop based on remaining time
      const now = Date.now();
      const timeUntilStop = lastSnowEndTime ? Math.max(0, lastSnowEndTime - now) : 0;

      const stopTimeout = setTimeout(() => {
        setSnowflakes([]);
      }, timeUntilStop);

      return () => clearTimeout(stopTimeout);
    }
  }, [snowflakes.length, intervalMs]);

  if (snowflakes.length === 0) return null;

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
  },
});
