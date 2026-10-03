import InteractiveProgressChart from '@/components/InteractiveProgressChart';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { catalogExerciseName } from '@/lib/gamification/userProfileInsights';
import { space } from '@/lib/ui/tokens';
import { UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

interface LiftProgressionChartProps {
  liftId: string;
  description: string;
  liftHistory: UserProgress[];
  isLoadingHistory: boolean;
}

// Progression chart for the selected lift, shared by the Big-3 and Other-Lifts sections.
export default function LiftProgressionChart({
  liftId,
  description,
  liftHistory,
  isLoadingHistory,
}: LiftProgressionChartProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <View style={[styles.chartContainer, { borderTopColor: ink.hairline }]}>
      {isLoadingHistory ? (
        <View style={styles.chartLoading}>
          <ActivityIndicator size="small" color={currentTheme.colors.primary} />
        </View>
      ) : liftHistory.length >= 2 ? (
        <InteractiveProgressChart
          data={liftHistory}
          selectedMetric="oneRM"
          weightUnit="lbs"
          title={`${catalogExerciseName(liftId)} Progression`}
          description={description}
        />
      ) : (
        <View style={styles.noHistoryContainer}>
          <Ionicons name="trending-up-outline" size={24} color={ink.faint} />
          <Text variant="meta" weight="regular" tone="muted" style={styles.noHistoryText}>
            Not enough data for progression chart
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    marginTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
  },
  chartLoading: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noHistoryContainer: {
    paddingVertical: space.section,
    alignItems: 'center',
    gap: space.sm,
  },
  noHistoryText: {
    textAlign: 'center',
  },
});
