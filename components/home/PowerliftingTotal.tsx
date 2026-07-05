import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface TotalLift {
  label: string; // "Squat" / "Bench" / "Deadlift"
  value: number; // best e1RM, lb
  color: string; // the lift's identity colour (PPL)
}

export interface TotalClub {
  value: number; // lb milestone (600 / 1000 / 1200)
  achieved: boolean; // total has reached it
}

export interface PowerliftingTotalData {
  total: number; // combined best e1RM of squat + bench + deadlift, lb
  lifts: TotalLift[]; // the three contributions
  clubs: TotalClub[]; // the milestone ladder
  nextTarget: number; // the club currently being chased (0 once all done)
  remaining: number; // lb left to reach nextTarget (0 once reached)
  achievedCount: number; // clubs unlocked
  allUnlocked: boolean;
}

// Flat "Big 3 Total" widget — one bar where the three lifts (Squat purple, Bench
// red, Deadlift teal) stack into a single row. The row's length is the total
// scaled to the club you're chasing, so it reads as both composition and progress.
export default function PowerliftingTotal({ data }: { data: PowerliftingTotalData }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const n = data.clubs.length;

  // Scale the bar to the club being chased (or the top club once all are earned).
  const scaleMax = data.allUnlocked ? data.clubs[n - 1]?.value || data.total : data.nextTarget;
  const denom = data.total > scaleMax ? data.total : scaleMax; // full bar once past scale
  const fillPct = Math.min(100, (data.total / denom) * 100);

  const caption = data.allUnlocked
    ? `All ${n} clubs earned`
    : `${data.remaining.toLocaleString()} lb to the ${data.nextTarget.toLocaleString()} club`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Big 3 Total</Text>
        <Text style={styles.headerTotal}>
          <Text style={[styles.headerNum, { color: colors.text }]}>{data.total.toLocaleString()}</Text>
          <Text style={[styles.headerUnit, { color: colors.text + '99' }]}> lb</Text>
        </Text>
      </View>

      {/* One combined bar: the three lifts stack into the filled portion. */}
      <View style={[styles.track, { backgroundColor: colors.text + '12' }]}>
        <View style={[styles.fillRow, { width: `${fillPct}%` }]}>
          {data.lifts.map(l => (
            <View key={l.label} style={{ flex: Math.max(0, l.value), backgroundColor: l.color }} />
          ))}
        </View>
      </View>

      <Text style={[styles.caption, { color: colors.text + '99' }]}>{caption}</Text>

      {/* Legend: which colour is which lift, with pounds. */}
      <View style={styles.legend}>
        {data.lifts.map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: l.color, opacity: l.value > 0 ? 1 : 0.4 }]} />
            <Text style={[styles.legendVal, { color: l.value > 0 ? l.color : colors.text + '55' }]}>
              {l.value.toLocaleString()}
            </Text>
            <Text style={[styles.legendLabel, { color: colors.text + '80' }]}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: 'bold' },
  headerTotal: {},
  headerNum: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  headerUnit: { fontSize: 14, fontWeight: '600' },

  track: { height: 16, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' },
  fillRow: { flexDirection: 'row', height: '100%', borderRadius: 8, overflow: 'hidden' },

  caption: { fontSize: 11, opacity: 0.6, textAlign: 'center', marginTop: 10 },

  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendVal: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  legendLabel: { fontSize: 13, fontWeight: '500' },
});
