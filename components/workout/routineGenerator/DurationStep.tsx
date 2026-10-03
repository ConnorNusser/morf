import { Text } from '@/components/Themed';
import {
  CARD_GAP,
  CARD_WIDTH,
  GeneratorColors,
  stepStyles,
} from '@/components/workout/routineGenerator/routineGeneratorShared';
import { radius, space } from '@/lib/ui/tokens';
import { DURATION_OPTIONS, WorkoutDuration } from '@/lib/workout/routineGeneratorOptions';
import React from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

interface DurationStepProps {
  fadeAnim: Animated.Value;
  colors: GeneratorColors;
  onSelect: (duration: WorkoutDuration) => void;
}

const DurationStep: React.FC<DurationStepProps> = ({ fadeAnim, colors, onSelect }) => (
  <Animated.View style={[stepStyles.stepContent, { opacity: fadeAnim }]}>
    <View style={stepStyles.titleBlock}>
      <Text variant="meta" weight="semiBold" style={stepStyles.stepLabel}>STEP 5</Text>
      <Text variant="screenTitle" tone="primary" weight="bold" style={stepStyles.title}>How long per workout?</Text>
      <Text variant="body" tone="secondary" style={stepStyles.subtitle}>This determines how many exercises we&apos;ll include</Text>
    </View>

    <View style={styles.durationGrid}>
      {DURATION_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[styles.durationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onSelect(option.id)}
          activeOpacity={0.7}
        >
          <Text variant="title" tone="primary" weight="bold" style={styles.durationLabel}>{option.label}</Text>
          <Text variant="meta" tone="secondary">{option.exercises}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </Animated.View>
);

const styles = StyleSheet.create({
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  durationCard: {
    width: CARD_WIDTH,
    borderRadius: radius.card,
    paddingVertical: space.section,
    alignItems: 'center',
    borderWidth: 1,
  },
  durationLabel: {
    marginBottom: space.xs,
  },
});

export default DurationStep;
