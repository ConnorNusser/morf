import { cardStyles } from '@/components/profile/userProfile/cardStyles';
import LiftProgressionChart from '@/components/profile/userProfile/LiftProgressionChart';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { BIG_3, UserLiftData, catalogExerciseName } from '@/lib/gamification/userProfileInsights';
import { space, radius, tint } from '@/lib/ui/tokens';
import { MAIN_LIFTS, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface TopLiftsCardProps {
  otherLifts: UserLiftData[];
  selectedLiftId: string | null;
  liftHistory: UserProgress[];
  isLoadingHistory: boolean;
  onSelectLift: (exerciseId: string) => void;
}

/** The user's best non-Big-3 lifts; tapping a row expands its progression chart. */
export default function TopLiftsCard({
  otherLifts,
  selectedLiftId,
  liftHistory,
  isLoadingHistory,
  onSelectLift,
}: TopLiftsCardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <View style={[cardStyles.card, { backgroundColor: currentTheme.colors.surface }]}>
      <Text variant="body" weight="semiBold" tone="primary">
        Top Lifts
      </Text>
      <View style={styles.liftsList}>
        {otherLifts.map((lift) => {
          const isSelected = selectedLiftId === lift.exercise_id && !BIG_3.includes(selectedLiftId as typeof MAIN_LIFTS.BENCH_PRESS);
          return (
            <TouchableOpacity
              key={lift.exercise_id}
              style={[
                styles.liftRowInteractive,
                {
                  backgroundColor: currentTheme.colors.background,
                  borderColor: isSelected ? currentTheme.colors.primary : currentTheme.colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
              onPress={() => onSelectLift(lift.exercise_id)}
              activeOpacity={0.7}
            >
              <View style={styles.liftRowLeft}>
                <Text variant="meta" weight="medium" tone="primary">
                  {catalogExerciseName(lift.exercise_id)}
                </Text>
                <Text variant="meta" weight="semiBold" tone="secondary">
                  {Math.round(lift.estimated_1rm)} lbs
                </Text>
              </View>
              <View style={[styles.liftChevron, { backgroundColor: isSelected ? tint(currentTheme.colors.primary) : currentTheme.colors.border + '50' }]}>
                <Ionicons
                  name={isSelected ? 'chevron-up' : 'chevron-forward'}
                  size={16}
                  color={isSelected ? currentTheme.colors.primary : ink.muted}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedLiftId && !BIG_3.includes(selectedLiftId as typeof MAIN_LIFTS.BENCH_PRESS) && (
        <LiftProgressionChart
          liftId={selectedLiftId}
          description="Tap points to see exact values"
          liftHistory={liftHistory}
          isLoadingHistory={isLoadingHistory}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  liftsList: {
    gap: space.sm,
  },
  liftRowInteractive: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
  },
  liftRowLeft: {
    flex: 1,
    gap: space.xs,
  },
  liftChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
