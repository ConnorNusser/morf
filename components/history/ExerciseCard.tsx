import MiniSparkline from '@/components/MiniSparkline';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ExerciseWithMax, WeightUnit } from '@/types';
import { computeExerciseTrend } from '@/lib/history/exerciseTrend';
import { type as typeScale } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface ExerciseCardProps {
  exercise: ExerciseWithMax;
  weightUnit: WeightUnit;
  onPress: (exercise: ExerciseWithMax) => void;
}

function ExerciseCard({ exercise, weightUnit, onPress }: ExerciseCardProps) {
  const { currentTheme } = useTheme();

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
      <View style={[styles.liftMain, { backgroundColor: 'transparent' }]}>
        <View style={[styles.liftNameRow, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.liftName, { color: currentTheme.colors.text, fontWeight: '600' }]}>
            {exercise.name}
          </Text>
          {exercise.isCustom && (
            <View style={[styles.customBadge, { backgroundColor: currentTheme.colors.primary + '15' }]}>
              <Text style={[styles.customBadgeText, { color: currentTheme.colors.primary, fontWeight: '500' }]}>
                Custom
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.liftStats, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.liftValue, { color: currentTheme.colors.text, fontWeight: '700' }]}>
            {isBodyweight ? (exercise.bestReps ?? 0) : exercise.estimated1RM}
          </Text>
          <Text style={[styles.liftLabel, { color: currentTheme.colors.text + '40', fontWeight: '400' }]}>
            {isBodyweight ? ' reps' : ' est. 1RM'}
          </Text>
          {trend.deltaDisplay > 0 && (
            <View style={[styles.deltaContainer, { backgroundColor: trend.isPositive ? '#00C85C15' : '#FF6B6B15' }]}>
              <Text style={[styles.deltaText, { color: trend.isPositive ? '#00C85C' : '#FF6B6B', fontWeight: '600' }]}>
                {trend.isPositive ? '+' : '-'}{trend.deltaDisplay}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.liftRight, { backgroundColor: 'transparent' }]}>
        {trend.sparkline.length >= 2 && (
          <MiniSparkline data={trend.sparkline} />
        )}
        <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '25'} />
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(ExerciseCard);

const styles = StyleSheet.create({
  liftCard: {
    paddingVertical: 14,
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
    gap: 8,
    marginBottom: 4,
  },
  liftName: {
    fontSize: typeScale.body,
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  customBadgeText: {
    fontSize: typeScale.micro,
  },
  liftStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liftValue: {
    fontSize: typeScale.emphasis,
  },
  liftLabel: {
    fontSize: typeScale.caption,
  },
  deltaContainer: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deltaText: {
    fontSize: typeScale.caption,
  },
  liftRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
