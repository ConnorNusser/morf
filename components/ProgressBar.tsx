import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0 to 100
  height?: number;
  animated?: boolean;
  style?: ViewStyle;
  showGlow?: boolean;
  showTicks?: boolean;
  currentWeight?: number;
  targetWeight?: number;
  exerciseName?: string;
  color?: string; // Custom color for the progress bar fill
}

export default function ProgressBar({
  progress,
  height = 8,
  animated = true,
  style,
  showGlow = false,
  showTicks = false,
  currentWeight,
  targetWeight,
  exerciseName,
  color,
}: ProgressBarProps) {
  const { currentTheme } = useTheme();
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const [_showModal, setShowModal] = useState(false);

  // Strength tier percentiles
  const strengthTicks = [
    { label: 'E', percentile: 0 },
    { label: 'D', percentile: 6 },
    { label: 'C', percentile: 23 },
    { label: 'B', percentile: 47 },
    { label: 'A', percentile: 70 },
    { label: 'S', percentile: 85 },
  ];

  const isInteractive = !!(currentWeight || targetWeight || exerciseName);

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedProgress, {
        toValue: Math.max(0, Math.min(100, progress)),
        duration: 800,
        useNativeDriver: false,
      }).start();
    } else {
      animatedProgress.setValue(Math.max(0, Math.min(100, progress)));
    }
  }, [progress, animated, animatedProgress]);

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const glowStyle = showGlow ? {
    shadowColor: currentTheme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  } : {};

  const handlePress = () => {
    if (isInteractive) {
      setShowModal(true);
    }
  };

  return (
    <>
      <Pressable
        onPress={isInteractive ? handlePress : undefined}
        disabled={!isInteractive}
        style={[
          styles.container, 
          { height: showTicks ? height + 24 : height },
          style,
          isInteractive && styles.interactive
        ]}
      >
        {/* Background */}
        <View
          style={[
            styles.background,
            {
              height,
              borderRadius: height / 2,
              backgroundColor: currentTheme.colors.secondary,
            },
          ]}
        />
        
        {/* Progress Fill */}
        <Animated.View
          style={[
            styles.progress,
            {
              height,
              borderRadius: height / 2,
              backgroundColor: color || currentTheme.colors.primary,
              width: progressWidth,
            },
            glowStyle,
          ]}
        />

        {/* Tick marks */}
        {showTicks && strengthTicks.map((tick, index) => {
          // First tick (E at 0%) should align left, last tick align right, others center
          const isFirst = index === 0;
          const isLast = index === strengthTicks.length - 1;
          const translateX = isFirst ? 0 : isLast ? -20 : -10;

          return (
            <View
              key={index}
              style={[
                styles.tickContainer,
                {
                  left: `${tick.percentile}%`,
                  transform: [{ translateX }],
                }
              ]}
            >
              <View style={[styles.tick, { backgroundColor: currentTheme.colors.border }]} />
              <Text style={[
                styles.tickLabel,
                {
                  color: currentTheme.colors.text,
                }
              ]}>
                {tick.label}
              </Text>
            </View>
          );
        })}
      </Pressable>

      {/* <ProgressBarModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        progress={progress}
        currentWeight={currentWeight}
        targetWeight={targetWeight}
        exerciseName={exerciseName}
      /> */}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
  },
  interactive: {
    opacity: 0.9,
  },
  background: {
    position: 'absolute',
    width: '100%',
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  tickContainer: {
    position: 'absolute',
    alignItems: 'center',
    top: -2,
  },
  tick: {
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  tickLabel: {
    fontSize: 8,
    fontWeight: '500',
    marginTop: 4,
    opacity: 0.7,
  },
}); 