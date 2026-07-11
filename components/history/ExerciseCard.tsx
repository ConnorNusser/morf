import AnimatedBar from '@/components/AnimatedBar';
import MiniSparkline from '@/components/MiniSparkline';
import { Text, View, useInk } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import {
  calculateStrengthPercentile,
  FEMALE_STANDARDS,
  getPercentileColor,
  getStrengthTier,
  MALE_STANDARDS,
} from '@/lib/data/strengthStandards';
import { computeExerciseTrend } from '@/lib/history/exerciseTrend';
import { radius, space, tint, trend as trendColor } from '@/lib/ui/tokens';
import { convertWeight, ExerciseWithMax, Gender, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

// Shared trend tokens so the same green means the same thing across both tabs.
const UP = trendColor.up;
const DOWN = trendColor.down;

export interface ExerciseGrading {
  bodyweightLbs: number;
  gender: Gender;
  age?: number;
}

interface ExerciseCardProps {
  exercise: ExerciseWithMax;
  weightUnit: WeightUnit;
  grading?: ExerciseGrading | null;
  onPress: (exercise: ExerciseWithMax) => void;
}

function ExerciseCard({ exercise, weightUnit, grading, onPress }: ExerciseCardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  // Calisthenics lifts have no meaningful 1RM, so headline/trend use reps instead of weight.
  const isBodyweight = exercise.metric === 'bodyweight';

  // Best-per-day buckets across the FULL logged window (no 3-month cutoff, no live-clock
  // windows) so even a short/stale history reads a delta.
  const trend = useMemo(
    () => computeExerciseTrend(exercise.history, weightUnit, isBodyweight ? 'reps' : 'topWeight'),
    [exercise.history, weightUnit, isBodyweight]
  );

  // Tier + percentile for standard weighted lifts; null for bodyweight/unranked lifts.
  const grade = useMemo(() => {
    if (isBodyweight || !grading || exercise.estimated1RM <= 0) return null;
    const stdMap = grading.gender === 'female' ? FEMALE_STANDARDS : MALE_STANDARDS;
    if (!stdMap[exercise.id]) return null;
    const oneRmLbs =
      weightUnit === 'kg' ? convertWeight(exercise.estimated1RM, 'kg', 'lbs') : exercise.estimated1RM;
    const pct = Math.round(
      calculateStrengthPercentile(oneRmLbs, grading.bodyweightLbs, grading.gender, exercise.id, grading.age)
    );
    return { pct, tier: getStrengthTier(pct), color: getPercentileColor(pct) };
  }, [exercise.id, exercise.estimated1RM, isBodyweight, grading, weightUnit]);

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: currentTheme.colors.border }]}
      onPress={() => onPress(exercise)}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <View style={styles.main}>
          <View style={styles.nameRow}>
            <Text variant="title" tone="primary" weight="semiBold" numberOfLines={1} style={styles.name}>
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
          <View style={styles.statsRow}>
            <Text variant="statHero" tone="primary" weight="bold">
              {isBodyweight ? (exercise.bestReps ?? 0) : exercise.estimated1RM}
            </Text>
            <Text variant="meta" tone="muted" style={styles.statUnit}>
              {isBodyweight ? 'reps' : `${weightUnit} · 1RM`}
            </Text>
            {trend.deltaDisplay > 0 && (
              <View style={[styles.delta, { backgroundColor: tint(trend.isPositive ? UP : DOWN) }]}>
                <Ionicons
                  name={trend.isPositive ? 'arrow-up' : 'arrow-down'}
                  size={11}
                  color={trend.isPositive ? UP : DOWN}
                />
                <Text variant="meta" weight="semiBold" style={{ color: trend.isPositive ? UP : DOWN }}>
                  {trend.deltaDisplay}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.right}>
          {grade && <TierBadge tier={grade.tier} size="small" showTooltip={false} />}
          {trend.sparkline.length >= 2 && <MiniSparkline data={trend.sparkline} />}
        </View>
      </View>

      {grade && (
        <View style={styles.gradeRow}>
          <AnimatedBar
            progress={grade.pct / 100}
            color={grade.color}
            trackColor={ink.hairline}
            height={6}
            style={styles.gradeBar}
          />
          <Text variant="meta" tone="muted" weight="medium" style={styles.gradePct}>
            {grade.pct}th pct
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(ExerciseCard);

const styles = StyleSheet.create({
  card: {
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  main: { flex: 1, gap: space.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flexShrink: 1 },
  customBadge: {
    paddingHorizontal: space.xs,
    paddingVertical: 1,
    borderRadius: radius.badge,
  },
  statsRow: { flexDirection: 'row', alignItems: 'baseline' },
  statUnit: { marginLeft: space.xs },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginLeft: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.badge,
    alignSelf: 'center',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gradeBar: { flex: 1 },
  gradePct: { minWidth: 54, textAlign: 'right' },
});
