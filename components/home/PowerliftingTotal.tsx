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
  const caption = data.allUnlocked
    ? `${data.milestoneTarget.toLocaleString()} lb club`
    : `${data.remaining.toLocaleString()} to ${data.milestoneTarget.toLocaleString()} club`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Big 3 Total</Text>
        <Text style={[styles.caption, { color: colors.text + '99' }]}>{caption}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>{data.total.toLocaleString()}</Text>
        <Text style={[styles.unit, { color: colors.text + '99' }]}>lb</Text>
      </View>

      {/* Composition as colour-coded stats (not another bar — everything else is a bar) */}
      <View style={styles.lifts}>
        {data.lifts.map(l => (
          <View key={l.label} style={styles.lift}>
            <Text style={[styles.liftValue, { color: l.color }]}>{l.value.toLocaleString()}</Text>
            <Text style={[styles.liftLabel, { color: colors.text + '99' }]}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 18, fontWeight: 'bold' },
  caption: { fontSize: 12, fontWeight: '500' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontSize: 40, fontWeight: '800', lineHeight: 44, letterSpacing: -1 },
  unit: { fontSize: 17, fontWeight: '600', marginLeft: 6 },
  lifts: { flexDirection: 'row', gap: 28, marginTop: 14 },
  lift: {},
  liftValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  liftLabel: { fontSize: 12, marginTop: 1, fontWeight: '500' },
});
