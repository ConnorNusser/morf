import MiniSparkline from '@/components/MiniSparkline';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface ExerciseWithMax {
  id: string;
  name: string;
  maxWeight: number;
  maxReps: number;
  estimated1RM: number;
  isCustom: boolean;
  lastUsed?: Date;
  history: { weight: number; reps: number; date: Date; unit: WeightUnit }[];
}

interface ExerciseCardProps {
  exercise: ExerciseWithMax;
  onPress: () => void;
}

export default function ExerciseCard({ exercise, onPress }: ExerciseCardProps) {
  const { currentTheme } = useTheme();

  // Get sparkline data for an exercise (bi-weekly periods, last 6)
  const getSparklineData = (history: ExerciseWithMax['history']): number[] => {
    if (history.length === 0) return [];

    const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
    const now = new Date();
    const periods: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() - i * 14);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 14);

      const periodEntries = sorted.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= periodStart && entryDate < periodEnd;
      });

      if (periodEntries.length > 0) {
        const maxWeight = Math.max(...periodEntries.map(e => e.weight));
        periods.push(maxWeight);
      } else if (periods.length > 0) {
        periods.push(periods[periods.length - 1]);
      }
    }

    return periods.length >= 2 ? periods : [];
  };

  // Get delta for an exercise (3 month comparison)
  const getDelta = (history: ExerciseWithMax['history']): { value: number; isPositive: boolean } | null => {
    if (history.length < 2) return null;

    const sorted = [...history].sort((a, b) => b.date.getTime() - a.date.getTime());
    const currentMax = sorted[0].weight;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const oldEntries = sorted.filter(h => new Date(h.date) < threeMonthsAgo);
    if (oldEntries.length === 0) return null;

    const oldMax = Math.max(...oldEntries.map(h => h.weight));
    const delta = currentMax - oldMax;

    if (delta === 0) return null;

    return { value: Math.abs(delta), isPositive: delta > 0 };
  };

  const sparklineData = getSparklineData(exercise.history);
  const delta = getDelta(exercise.history);

  return (
    <TouchableOpacity
      style={[styles.liftCard, { borderColor: currentTheme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.liftMain, { backgroundColor: 'transparent' }]}>
        <View style={[styles.liftNameRow, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.liftName, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            {exercise.name}
          </Text>
          {exercise.isCustom && (
            <View style={[styles.customBadge, { backgroundColor: currentTheme.colors.accent + '15' }]}>
              <Text style={[styles.customBadgeText, { color: currentTheme.colors.accent, fontFamily: 'Raleway_500Medium' }]}>
                Custom
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.liftStats, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.liftValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
            {exercise.estimated1RM}
          </Text>
          <Text style={[styles.liftLabel, { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }]}>
            {' '}est. 1RM
          </Text>
          {delta && (
            <View style={[styles.deltaContainer, { backgroundColor: delta.isPositive ? '#00C85C15' : '#FF6B6B15' }]}>
              <Text style={[styles.deltaText, { color: delta.isPositive ? '#00C85C' : '#FF6B6B', fontFamily: 'Raleway_600SemiBold' }]}>
                {delta.isPositive ? '+' : '-'}{delta.value}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.liftRight, { backgroundColor: 'transparent' }]}>
        {sparklineData.length >= 2 && (
          <MiniSparkline data={sparklineData} />
        )}
        <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '25'} />
      </View>
    </TouchableOpacity>
  );
}

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
