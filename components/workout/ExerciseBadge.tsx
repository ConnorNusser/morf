import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor, OneRMCalculator } from '@/lib/strengthStandards';
import { UserProgress, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';

interface ExerciseSet {
  weight: number;
  reps: number;
  unit?: string;
}

interface ExerciseBadgeProps {
  matchedExerciseId?: string | null;
  isCustom?: boolean;
  sets: ExerciseSet[];
  userLifts: UserProgress[];
  weightUnit?: WeightUnit;
}

export type BadgeInfo =
  | { type: 'tier'; tier: string; tierColor: string; isPR: boolean; percentile: number }
  | { type: 'new'; label: string; icon: 'sparkles' }
  | { type: 'custom'; label: string; icon: 'create' }
  | { type: 'volume'; label: string; icon: 'barbell' }
  | null;

export function getExerciseBadgeInfo(
  matchedExerciseId: string | null | undefined,
  isCustom: boolean | undefined,
  sets: ExerciseSet[],
  userLifts: UserProgress[]
): BadgeInfo {
  // For custom exercises, check if it's a PR based on weight
  if (isCustom || !matchedExerciseId) {
    const maxWeight = Math.max(...sets.map(s => s.weight), 0);
    if (maxWeight > 0) {
      return { type: 'volume', label: `${Math.round(maxWeight)}`, icon: 'barbell' };
    }
    return { type: 'custom', label: 'Custom', icon: 'create' };
  }

  // For featured exercises, get the tier from user's current data
  const userLift = userLifts.find(l => l.workoutId === matchedExerciseId);

  // Calculate the best 1RM from this workout's sets
  const best1RM = Math.max(
    ...sets.map(set => {
      if (set.reps === 0) return 0;
      return OneRMCalculator.estimate(set.weight, set.reps);
    }),
    0
  );

  if (userLift && userLift.percentileRanking > 0) {
    const tier = getStrengthTier(userLift.percentileRanking);
    const tierColor = getTierColor(tier);
    // Check if this is a PR
    const isPR = best1RM > userLift.personalRecord;
    return { type: 'tier', tier, tierColor, isPR, percentile: userLift.percentileRanking };
  }

  // No existing data - show as new lift
  if (best1RM > 0) {
    return { type: 'new', label: 'New', icon: 'sparkles' };
  }

  return null;
}

export default function ExerciseBadge({
  matchedExerciseId,
  isCustom,
  sets,
  userLifts,
  weightUnit = 'lbs',
}: ExerciseBadgeProps) {
  const { currentTheme } = useTheme();

  const badgeInfo = useMemo(
    () => getExerciseBadgeInfo(matchedExerciseId, isCustom, sets, userLifts),
    [matchedExerciseId, isCustom, sets, userLifts]
  );

  if (!badgeInfo) return null;

  if (badgeInfo.type === 'tier') {
    return (
      <View style={[styles.badgeRow, { backgroundColor: 'transparent' }]}>
        {badgeInfo.isPR && (
          <View style={[styles.prBadge, { backgroundColor: '#22C55E20' }]}>
            <Text style={[styles.prBadgeText, { color: '#22C55E', fontFamily: 'Raleway_700Bold' }]}>
              PR
            </Text>
          </View>
        )}
        <TierBadge percentile={badgeInfo.percentile} size="small" />
      </View>
    );
  }

  if (badgeInfo.type === 'new') {
    return (
      <View style={[styles.newBadge, { backgroundColor: currentTheme.colors.primary + '20' }]}>
        <Ionicons name="sparkles" size={12} color={currentTheme.colors.primary} />
        <Text
          style={[
            styles.newBadgeText,
            { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' },
          ]}
        >
          New
        </Text>
      </View>
    );
  }

  if (badgeInfo.type === 'custom') {
    return (
      <View style={[styles.customBadge, { backgroundColor: currentTheme.colors.accent + '20' }]}>
        <Text
          style={[
            styles.customBadgeText,
            { color: currentTheme.colors.accent, fontFamily: 'Raleway_500Medium' },
          ]}
        >
          Custom
        </Text>
      </View>
    );
  }

  if (badgeInfo.type === 'volume') {
    return (
      <View style={[styles.volumeBadge, { backgroundColor: currentTheme.colors.accent + '20' }]}>
        <Ionicons name="barbell-outline" size={12} color={currentTheme.colors.accent} />
        <Text
          style={[
            styles.volumeBadgeText,
            { color: currentTheme.colors.accent, fontFamily: 'Raleway_600SemiBold' },
          ]}
        >
          {badgeInfo.label} {weightUnit}
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prBadgeText: {
    fontSize: 11,
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  newBadgeText: {
    fontSize: 11,
  },
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  customBadgeText: {
    fontSize: 11,
  },
  volumeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  volumeBadgeText: {
    fontSize: 11,
  },
});
