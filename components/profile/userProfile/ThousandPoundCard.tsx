import { cardStyles } from '@/components/profile/userProfile/cardStyles';
import LiftProgressionChart from '@/components/profile/userProfile/LiftProgressionChart';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { BIG_3 } from '@/lib/gamification/userProfileInsights';
import { space, radius, tint, trend } from '@/lib/ui/tokens';
import { MAIN_LIFTS, UserProgress } from '@/types';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface ThousandPoundCardProps {
  benchMax: number;
  squatMax: number;
  deadliftMax: number;
  big3Total: number;
  thousandPoundProgress: number;
  selectedLiftId: string | null;
  liftHistory: UserProgress[];
  isLoadingHistory: boolean;
  onSelectLift: (exerciseId: string) => void;
}

/** 1000lb Club progress bar plus the tappable Big-3 maxes and their progression chart. */
export default function ThousandPoundCard({
  benchMax,
  squatMax,
  deadliftMax,
  big3Total,
  thousandPoundProgress,
  selectedLiftId,
  liftHistory,
  isLoadingHistory,
  onSelectLift,
}: ThousandPoundCardProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={[cardStyles.card, { backgroundColor: currentTheme.colors.surface }]}>
      <View style={cardStyles.cardHeader}>
        <Text variant="body" weight="semiBold" tone="primary">
          1000lb Club
        </Text>
        <Text variant="emphasis" weight="bold">
          {big3Total} lbs
        </Text>
      </View>

      <View style={[styles.progressBarContainer, { backgroundColor: currentTheme.colors.border }]}>
        <View
          style={[
            styles.progressBar,
            {
              backgroundColor: thousandPoundProgress >= 100 ? trend.up : currentTheme.colors.primary,
              width: `${thousandPoundProgress}%`
            }
          ]}
        />
      </View>
      <Text variant="meta" weight="regular" tone="muted" style={styles.progressText}>
        {thousandPoundProgress >= 100 ? 'Member!' : `${thousandPoundProgress}% to 1000lbs`}
      </Text>

      <View style={styles.big3Container}>
        <TouchableOpacity
          style={[
            styles.big3Item,
            {
              backgroundColor: selectedLiftId === MAIN_LIFTS.BENCH_PRESS ? tint(currentTheme.colors.primary) : currentTheme.colors.background,
              borderColor: selectedLiftId === MAIN_LIFTS.BENCH_PRESS ? currentTheme.colors.primary : currentTheme.colors.border,
            }
          ]}
          onPress={() => benchMax ? onSelectLift(MAIN_LIFTS.BENCH_PRESS) : null}
          activeOpacity={benchMax ? 0.7 : 1}
          disabled={!benchMax}
        >
          <Text variant="meta" weight="medium" tone="secondary">
            Bench
          </Text>
          <Text variant="body" weight="semiBold" tone="primary">
            {benchMax || '-'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.big3Item,
            {
              backgroundColor: selectedLiftId === MAIN_LIFTS.SQUAT ? tint(currentTheme.colors.primary) : currentTheme.colors.background,
              borderColor: selectedLiftId === MAIN_LIFTS.SQUAT ? currentTheme.colors.primary : currentTheme.colors.border,
            }
          ]}
          onPress={() => squatMax ? onSelectLift(MAIN_LIFTS.SQUAT) : null}
          activeOpacity={squatMax ? 0.7 : 1}
          disabled={!squatMax}
        >
          <Text variant="meta" weight="medium" tone="secondary">
            Squat
          </Text>
          <Text variant="body" weight="semiBold" tone="primary">
            {squatMax || '-'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.big3Item,
            {
              backgroundColor: selectedLiftId === MAIN_LIFTS.DEADLIFT ? tint(currentTheme.colors.primary) : currentTheme.colors.background,
              borderColor: selectedLiftId === MAIN_LIFTS.DEADLIFT ? currentTheme.colors.primary : currentTheme.colors.border,
            }
          ]}
          onPress={() => deadliftMax ? onSelectLift(MAIN_LIFTS.DEADLIFT) : null}
          activeOpacity={deadliftMax ? 0.7 : 1}
          disabled={!deadliftMax}
        >
          <Text variant="meta" weight="medium" tone="secondary">
            Deadlift
          </Text>
          <Text variant="body" weight="semiBold" tone="primary">
            {deadliftMax || '-'}
          </Text>
        </TouchableOpacity>
      </View>

      {selectedLiftId && BIG_3.includes(selectedLiftId as typeof MAIN_LIFTS.BENCH_PRESS) && (
        <LiftProgressionChart
          liftId={selectedLiftId}
          description="Estimated from your workout sessions"
          liftHistory={liftHistory}
          isLoadingHistory={isLoadingHistory}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    textAlign: 'center',
  },
  big3Container: {
    flexDirection: 'row',
    marginTop: space.xs,
    gap: space.sm,
  },
  big3Item: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
  },
});
