// Slim rest-timer bar shown under the workout header while resting: a tinted
// fill drains with the remaining time, ∓30s nudges, and Skip. Replaces the old
// expandable rest panel — it appears on its own, takes one row, and never
// hijacks the logging flow.
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, screenGutter, space, tint, track } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, View } from 'react-native';

interface RestBarProps {
  remaining: number; // seconds left
  duration: number; // full rest length (grows with +30s)
  formatted: string; // "1:42"
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
}

export default function RestBar({ remaining, duration, formatted, onAdjust, onSkip }: RestBarProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const accent = currentTheme.colors.primary;

  // The fill tracks remaining/duration, gliding linearly between 1s ticks so
  // the drain reads continuous instead of stepping.
  const fraction = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
  const fill = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: fraction,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [fraction, fill]);
  const fillWidth = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const nudge = (seconds: number) => {
    playHapticFeedback('light', false);
    onAdjust(seconds);
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border },
      ]}
    >
      <Animated.View style={[styles.fill, { width: fillWidth, backgroundColor: tint(accent) }]} />

      <View style={styles.content}>
        <Text variant="meta" weight="bold" style={[styles.restLabel, { color: accent }]}>
          REST
        </Text>
        <Text variant="emphasis" tone="primary" weight="bold" style={styles.time}>
          {formatted}
        </Text>

        <View style={styles.flex} />

        <TouchableOpacity
          style={[styles.nudge, { backgroundColor: ink.hairline }]}
          onPress={() => nudge(-30)}
          hitSlop={6}
          accessibilityLabel="Shorten rest by 30 seconds"
        >
          <Text variant="meta" tone="secondary" weight="semiBold">
            −30
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nudge, { backgroundColor: ink.hairline }]}
          onPress={() => nudge(30)}
          hitSlop={6}
          accessibilityLabel="Extend rest by 30 seconds"
        >
          <Text variant="meta" tone="secondary" weight="semiBold">
            +30
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skip}
          onPress={onSkip}
          hitSlop={6}
          accessibilityLabel="Skip rest"
        >
          <Text variant="meta" weight="bold" style={{ color: accent }}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: screenGutter,
    marginBottom: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  restLabel: {
    letterSpacing: track.caps,
  },
  time: {
    fontVariant: ['tabular-nums'],
  },
  flex: { flex: 1 },
  nudge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  skip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
});
