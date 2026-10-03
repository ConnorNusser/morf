import { Text } from '@/components/Themed';
import {
  CARD_GAP,
  CARD_WIDTH,
  GeneratorColors,
  stepStyles,
} from '@/components/workout/routineGenerator/routineGeneratorShared';
import { radius, space, track } from '@/lib/ui/tokens';
import React from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

interface DaysStepProps {
  fadeAnim: Animated.Value;
  colors: GeneratorColors;
  onSelect: (days: number) => void;
}

const DaysStep: React.FC<DaysStepProps> = ({ fadeAnim, colors, onSelect }) => (
  <Animated.View style={[stepStyles.stepContent, { opacity: fadeAnim }]}>
    <View style={stepStyles.titleBlock}>
      <Text variant="meta" weight="semiBold" style={stepStyles.stepLabel}>STEP 4</Text>
      <Text variant="screenTitle" tone="primary" weight="bold" style={stepStyles.title}>How many days per week?</Text>
      <Text variant="body" tone="secondary" style={stepStyles.subtitle}>We&apos;ll design the optimal split for your schedule</Text>
    </View>

    <View style={styles.daysGrid}>
      {[3, 4, 5, 6].map((days) => (
        <TouchableOpacity
          key={days}
          style={[styles.dayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onSelect(days)}
          activeOpacity={0.7}
        >
          <Text tone="primary" weight="bold" style={styles.dayNumber}>{days}</Text>
          <Text variant="body" tone="secondary" style={styles.dayLabel}>days</Text>
        </TouchableOpacity>
      ))}
    </View>
  </Animated.View>
);

const styles = StyleSheet.create({
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  dayCard: {
    width: CARD_WIDTH,
    borderRadius: radius.card,
    paddingVertical: space.section,
    alignItems: 'center',
    borderWidth: 1,
  },
  // The day-count display number is a named exception to the type scale (48).
  dayNumber: {
    fontSize: 48,
    letterSpacing: track.display,
  },
  dayLabel: {
    marginTop: space.xs,
  },
});

export default DaysStep;
