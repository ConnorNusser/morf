import MiniSparkline from '@/components/MiniSparkline';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { computeTopMovers } from '@/lib/history/topMovers';
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

  const movers = useMemo(
    () => computeTopMovers(exercises, weightUnit, { limit: 3 }),
    [exercises, weightUnit]
  );

  if (movers.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Same micro-label header grammar as LIFTS / SESSIONS / the Career card. */}
      <View style={[styles.headerRow, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.heading, { color: colors.text }]}>YOUR MOVERS</Text>
        <TouchableOpacity onPress={onSeeAll} hitSlop={8} activeOpacity={0.7}>
          <Text style={[styles.seeAll, { color: colors.primary, fontWeight: '600' }]}>
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
            <View style={[styles.rowMain, { backgroundColor: 'transparent' }]}>
              <Text
                style={[styles.name, { color: colors.text, fontWeight: '600' }]}
                numberOfLines={1}
              >
                {m.name}
              </Text>
              <View style={[styles.statsRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.value, { color: colors.text, fontWeight: '700' }]}>
                  {m.value}
                </Text>
                <Text style={[styles.unit, { color: colors.text + '40', fontWeight: '400' }]}>
                  {m.isBodyweight ? ' reps' : ' est. 1RM'}
                </Text>
                <View style={[styles.deltaPill, { backgroundColor: color + '15' }]}>
                  <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={11} color={color} />
                  <Text style={[styles.deltaText, { color, fontWeight: '600' }]}>
                    {Math.abs(m.delta)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.rowRight, { backgroundColor: 'transparent' }]}>
              <MiniSparkline data={m.sparkline} />
              <Ionicons name="chevron-forward" size={16} color={colors.text + '25'} />
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
    marginTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  heading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.45,
  },
  seeAll: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  firstRow: {
    borderTopWidth: 0,
  },
  rowMain: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 15,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontSize: 17,
  },
  unit: {
    fontSize: 12,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deltaText: {
    fontSize: 11,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
