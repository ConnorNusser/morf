import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface TotalLift {
  label: string; // "Squat" / "Bench" / "Deadlift"
  value: number; // best e1RM, lb
  color: string; // the lift's identity colour (PPL)
}

export interface PowerliftingTotalData {
  total: number; // combined best e1RM of squat + bench + deadlift, lb
  lifts: TotalLift[]; // the three contributions, in bar order
  milestoneTarget: number; // next club to chase (lb)
  remaining: number; // lb left to reach it (0 once reached)
  allUnlocked: boolean;
}

// Flat, full-width "big 3 total" hero — the combined squat/bench/deadlift e1RM (the
// 1,000 lb club). The bar is SEGMENTED: each lift is a coloured chunk (its PPL
// identity colour) scaled to the next club target, so you see both the total's size
// and its composition at a glance. A legend names the three contributions.
export default function PowerliftingTotal({ data }: { data: PowerliftingTotalData }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const scale = Math.max(data.total, data.milestoneTarget, 1);
  const caption = data.allUnlocked
    ? `${data.milestoneTarget.toLocaleString()} lb club`
    : `${data.remaining.toLocaleString()} to ${data.milestoneTarget.toLocaleString()} club`;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: colors.text }]}>BIG 3 TOTAL</Text>
        <Text style={[styles.caption, { color: colors.text }]}>{caption}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>{data.total.toLocaleString()}</Text>
        <Text style={[styles.unit, { color: colors.text }]}>lb</Text>
      </View>

      <View style={[styles.track, { backgroundColor: colors.text + '0D' }]}>
        {data.lifts.map(l => (
          <View key={l.label} style={{ width: `${(l.value / scale) * 100}%`, backgroundColor: l.color }} />
        ))}
      </View>

      <View style={styles.legend}>
        {data.lifts.map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: l.color }]} />
            <Text style={[styles.legendText, { color: colors.text + '99' }]}>
              {l.label} <Text style={[styles.legendValue, { color: colors.text }]}>{l.value.toLocaleString()}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 1, opacity: 0.5 },
  caption: { fontSize: 12, opacity: 0.55 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  value: { fontSize: 44, fontWeight: '800', lineHeight: 48, letterSpacing: -1 },
  unit: { fontSize: 18, fontWeight: '600', marginLeft: 6, opacity: 0.55 },
  track: { height: 14, borderRadius: 7, overflow: 'hidden', flexDirection: 'row', marginTop: 12, gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 13, fontWeight: '500' },
  legendValue: { fontWeight: '700' },
});
