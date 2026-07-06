import MiniSparkline from '@/components/MiniSparkline';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ExerciseWithMax, WeightUnit } from '@/types';
import { computeExerciseTrend } from '@/lib/history/exerciseTrend';
import { radius, space, tint } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

// Semantic gain/loss colors, matched to TopMovers so the same green means the same
// thing across both tabs.
const UP = '#00C85C';
const DOWN = '#FF6B6B';

interface ExerciseCardProps {
  exercise: ExerciseWithMax;
  weightUnit: WeightUnit;
  onPress: (exercise: ExerciseWithMax) => void;
}

function ExerciseCard({ exercise, weightUnit, onPress }: ExerciseCardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  // A calisthenics lift (pull-ups, push-ups) has no meaningful 1RM, so it is scored on
  // reps instead: the headline is its best set's rep count and the trend tracks rep
  // progression rather than weight.
  const isBodyweight = exercise.metric === 'bodyweight';

  // One clock-independent trend derivation feeds both signals: best-per-day buckets
  // across the FULL logged window (no fixed 3-month cutoff, no live-clock calendar
  // windows), so even a sub-3-month or not-recently-logged history still reads a delta.
  // Bodyweight rows read the 'reps' variant so the delta/sparkline reflect rep gains.
  const trend = useMemo(
    () => computeExerciseTrend(exercise.history, weightUnit, isBodyweight ? 'reps' : 'topWeight'),
    [exercise.history, weightUnit, isBodyweight]
  );

  return (
    <TouchableOpacity
      style={[styles.liftCard, { borderColor: currentTheme.colors.border }]}
      onPress={() => onPress(exercise)}
      activeOpacity={0.7}
    >
      <View style={styles.liftMain}>
        <View style={styles.liftNameRow}>
          <Text variant="body" tone="primary" weight="semiBold">
            {exercise.name}
          </Text>
          {exercise.isCustom && (
            <View style={[styles.customBadge, { backgroundColor: tint(currentTheme.colors.primary) }]}>
              <Text variant="meta" weight="medium">
                Custom
              </Text>
            </View>
          )}
        </View>
        <View style={styles.liftStats}>
          <Text variant="emphasis" tone="primary" weight="bold">
            {isBodyweight ? (exercise.bestReps ?? 0) : exercise.estimated1RM}
          </Text>
          <Text variant="meta" tone="faint">
            {isBodyweight ? ' reps' : ' est. 1RM'}
          </Text>
          {trend.deltaDisplay > 0 && (
            <View style={[styles.deltaContainer, { backgroundColor: tint(trend.isPositive ? UP : DOWN) }]}>
              <Text variant="meta" weight="semiBold" style={{ color: trend.isPositive ? UP : DOWN }}>
                {trend.isPositive ? '+' : '-'}{trend.deltaDisplay}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.liftRight}>
        {trend.sparkline.length >= 2 && (
          <MiniSparkline data={trend.sparkline} />
        )}
        <Ionicons name="chevron-forward" size={16} color={ink.ghost} />
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(ExerciseCard);

const styles = StyleSheet.create({
  liftCard: {
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liftMain: {
    flex: 1,
  },
  liftNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  customBadge: {
    paddingHorizontal: space.xs,
    paddingVertical: 1,
    borderRadius: radius.badge,
  },
  liftStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deltaContainer: {
    marginLeft: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  liftRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
});
