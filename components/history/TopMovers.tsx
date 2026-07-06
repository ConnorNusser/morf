import MiniSparkline from '@/components/MiniSparkline';
import { Text, View, useInk } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { computeTopMovers } from '@/lib/history/topMovers';
import { radius, space, tint } from '@/lib/ui/tokens';
import { ExerciseWithMax, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

// Semantic gain/loss colors, matched to the Exercises-tab ExerciseCard so the same green
// means the same thing across both tabs.
const UP = '#00C85C';
const DOWN = '#FF6B6B';

interface TopMoversProps {
  exercises: ExerciseWithMax[];
  weightUnit: WeightUnit;
  /** Tap a row -> open that lift's full history (same modal the Exercises tab uses). */
  onSelect: (exercise: ExerciseWithMax) => void;
  /** "See all" -> jump to the full Exercises holdings list. */
  onSeeAll: () => void;
}

/**
 * "Your Movers" — the per-lift trajectory answer, sitting directly under the Strength Index
 * hero so the Workouts hub reads portfolio-value (hero) -> your movers (per-lift) -> volume
 * -> recent sessions, mirroring Robinhood's holdings-under-hero layout. It is a teaser, not
 * a second full list: a few slim rows (name, est-1RM / reps, signed delta, sparkline) that
 * tap through into each lift's history, with a "See all" into the Exercises tab. Renders
 * nothing when no lift is meaningfully moving, so it never pads the glance with noise.
 */
function TopMovers({ exercises, weightUnit, onSelect, onSeeAll }: TopMoversProps) {
  const { currentTheme } = useTheme();
  const { colors} = currentTheme;
  const ink = useInk();

  const movers = useMemo(
    () => computeTopMovers(exercises, weightUnit, { limit: 3 }),
    [exercises, weightUnit]
  );

  if (movers.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Same micro-label header grammar as LIFTS / SESSIONS / the Career card. */}
      <View style={styles.headerRow}>
        <SectionLabel style={styles.heading}>YOUR MOVERS</SectionLabel>
        <TouchableOpacity onPress={onSeeAll} hitSlop={8} activeOpacity={0.7}>
          <Text variant="meta" weight="semiBold">
            See all
          </Text>
        </TouchableOpacity>
      </View>

      {movers.map((m, i) => {
        const up = m.delta > 0;
        const color = up ? UP : DOWN;
        return (
          <TouchableOpacity
            key={m.id}
            style={[
              styles.row,
              { borderTopColor: colors.border },
              i === 0 && styles.firstRow,
            ]}
            onPress={() => onSelect(m.exercise)}
            activeOpacity={0.7}
          >
            <View style={styles.rowMain}>
              <Text
                variant="body"
                tone="primary"
                weight="semiBold"
                style={styles.name}
                numberOfLines={1}
              >
                {m.name}
              </Text>
              <View style={styles.statsRow}>
                <Text variant="emphasis" tone="primary" weight="bold">
                  {m.value}
                </Text>
                <Text variant="meta" tone="faint">
                  {m.isBodyweight ? ' reps' : ' est. 1RM'}
                </Text>
                <View style={[styles.deltaPill, { backgroundColor: tint(color) }]}>
                  <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={11} color={color} />
                  <Text variant="meta" weight="semiBold" style={{ color }}>
                    {Math.abs(m.delta)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.rowRight}>
              <MiniSparkline data={m.sparkline} />
              <Ionicons name="chevron-forward" size={16} color={ink.ghost} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default React.memo(TopMovers);

const styles = StyleSheet.create({
  container: {
    marginTop: space.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: space.md,
  },
  heading: {
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  firstRow: {
    borderTopWidth: 0,
  },
  rowMain: {
    flex: 1,
    marginRight: space.md,
  },
  name: {
    marginBottom: space.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginLeft: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
});
