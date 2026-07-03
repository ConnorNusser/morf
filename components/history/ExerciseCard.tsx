import MiniSparkline from '@/components/MiniSparkline';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ExerciseWithMax, WeightUnit } from '@/types';
import { computeExerciseTrend } from '@/lib/history/exerciseTrend';
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

  // One clock-independent trend derivation feeds both signals: best-per-day buckets
  // across the FULL logged window (no fixed 3-month cutoff, no live-clock calendar
  // windows), so even a sub-3-month or not-recently-logged history still reads a delta.
  const trend = useMemo(
    () => computeExerciseTrend(exercise.history, weightUnit),
    [exercise.history, weightUnit]
  );

  return (
    <TouchableOpacity
      style={[styles.liftCard, { borderColor: currentTheme.colors.border }]}
      onPress={() => onPress(exercise)}
      activeOpacity={0.7}
    >
      <View style={[styles.liftMain, { backgroundColor: 'transparent' }]}>
        <View style={[styles.liftNameRow, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.liftName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
            {exercise.name}
          </Text>
          {exercise.isCustom && (
            <View style={[styles.customBadge, { backgroundColor: currentTheme.colors.primary + '15' }]}>
              <Text style={[styles.customBadgeText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>
                Custom
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.liftStats, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.liftValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
            {exercise.estimated1RM}
          </Text>
          <Text style={[styles.liftLabel, { color: currentTheme.colors.text + '40', fontFamily: currentTheme.fonts.regular }]}>
            {' '}est. 1RM
          </Text>
          {trend.deltaDisplay > 0 && (
            <View style={[styles.deltaContainer, { backgroundColor: trend.isPositive ? '#00C85C15' : '#FF6B6B15' }]}>
              <Text style={[styles.deltaText, { color: trend.isPositive ? '#00C85C' : '#FF6B6B', fontFamily: currentTheme.fonts.semiBold }]}>
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
    fontSize: 15,
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  customBadgeText: {
    fontSize: 9,
  },
  liftStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liftValue: {
    fontSize: 18,
  },
  liftLabel: {
    fontSize: 13,
  },
  deltaContainer: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deltaText: {
    fontSize: 11,
  },
  liftRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
