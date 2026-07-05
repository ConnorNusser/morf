// History widget: a full-width panel listing the user's lifts, each row showing its
// best set per month across time (oldest → newest, right-aligned so the latest
// lines up down the right edge). Month under each point makes the timeline explicit;
// left→right is time. Each point is a themed chip: the latest is an accent-filled
// "you are here" capsule, earlier ones are quiet outlined chips colored by whether
// that month rose or fell from the one before it — reusing the same green/red
// gain-loss language as ExerciseCard and TopMovers so the whole app reads as one system.
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { LiftProgress } from '@/lib/history/liftProgress';
import React from 'react';
import { StyleSheet, View as RNView } from 'react-native';

// Semantic gain/loss colors, matched to ExerciseCard / TopMovers so the same green
// means the same thing across every tab.
const UP = '#00C85C';
const DOWN = '#FF6B6B';

const shortName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();
const setLabel = (weight: number, reps: number): string => (weight > 0 ? `${weight}×${reps}` : `×${reps}`);
const metricOf = (p: { weight: number; reps: number }): number => (p.weight > 0 ? p.weight : p.reps);

function LiftRow({ lift, last }: { lift: LiftProgress; last: boolean }) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  return (
    <RNView
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.name, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
        {shortName(lift.name)}
      </Text>
      <RNView style={styles.points}>
        {lift.points.map((p, i) => {
          const latest = i === lift.points.length - 1;
          const prev = i > 0 ? lift.points[i - 1] : null;
          const trendColor = prev
            ? metricOf(p) > metricOf(prev)
              ? UP
              : metricOf(p) < metricOf(prev)
                ? DOWN
                : colors.text + '80'
            : colors.text + '80';

          return (
            <RNView
              key={i}
              style={[
                styles.point,
                latest
                  ? { backgroundColor: colors.primary + '16' }
                  : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.set,
                  {
                    color: latest ? colors.primary : trendColor,
                    fontFamily: latest ? fonts.bold : fonts.semiBold,
                  },
                ]}
                numberOfLines={1}
              >
                {setLabel(p.weight, p.reps)}
              </Text>
              <Text style={[styles.month, { color: colors.text + '55', fontFamily: fonts.medium }]}>
                {p.monthLabel}
              </Text>
            </RNView>
          );
        })}
      </RNView>
    </RNView>
  );
}

export default function LiftProgressWidget({ lifts }: { lifts: LiftProgress[] }) {
  if (lifts.length === 0) return null;
  return (
    <RNView style={styles.panel}>
      {lifts.map((lift, i) => (
        <LiftRow key={lift.id} lift={lift} last={i === lifts.length - 1} />
      ))}
    </RNView>
  );
}

const styles = StyleSheet.create({
  // Flat: no surface/border on the panel itself — rows sit on the page, separated by
  // hairline dividers, so the panel reads as a clean list, not a boxed card.
  panel: {
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  name: { flex: 1, fontSize: 14 },
  points: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  // Each point is a small themed chip (matches the pill language used by delta/sort/
  // record chips elsewhere in History) rather than bare floating text.
  point: {
    alignItems: 'center',
    minWidth: 50,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  set: { fontSize: 13, letterSpacing: -0.2 },
  month: { fontSize: 9, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
});
