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

const STEP = 100; // lb per ladder cell

// Flat "Big 3 Total" widget — the Career Tier Ladder's segmented-cell language, but
// the cells fill with the three lift colours (Squat purple, Bench red, Deadlift teal)
// stacked by contribution, up to the total. The current cell is outlined; pound
// clubs (600/1000/1200) label the scale instead of letter grades.
export default function PowerliftingTotal({ data }: { data: PowerliftingTotalData }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const n = data.clubs.length;

  const scaleMax = data.clubs[n - 1]?.value || STEP;
  const cellCount = Math.max(1, Math.round(scaleMax / STEP));
  const currentCell = Math.min(cellCount - 1, Math.floor(data.total / STEP));

  // Cumulative lift bands: each lift owns a lb range [lo, hi) of the total.
  let running = 0;
  const liftBands = data.lifts.map(l => {
    const lo = running;
    running += Math.max(0, l.value);
    return { lo, hi: running, color: l.color };
  });
  const colorForCell = (i: number) => {
    const lo = i * STEP;
    if (lo >= data.total) return null; // unfilled
    return liftBands.find(b => lo >= b.lo && lo < b.hi)?.color ?? liftBands[liftBands.length - 1]?.color;
  };

  // Club label bands (for the scale under the ladder), like the grade letters.
  const bandOf = (cellIdx: number) => {
    const lower = cellIdx * STEP;
    const b = data.clubs.findIndex(c => lower < c.value);
    return b === -1 ? n - 1 : b;
  };
  const currentBand = bandOf(currentCell);
  const bandCounts = data.clubs.map((_, b) =>
    Array.from({ length: cellCount }, (_, i) => bandOf(i)).filter(x => x === b).length,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Total on the left. */}
        <Text style={styles.headerTotal}>
          <Text style={[styles.headerNum, { color: colors.text + '99' }]}>{data.total.toLocaleString()}</Text>
          <Text style={[styles.headerUnit, { color: colors.text + '70' }]}> lb</Text>
        </Text>

        {/* Lifts stacked on the right, colour-coded. */}
        <View style={styles.liftStack}>
          {data.lifts.map(l => (
            <View key={l.label} style={styles.liftRow}>
              <Text style={[styles.liftVal, { color: l.value > 0 ? l.color : colors.text + '55' }]}>
                {l.value.toLocaleString()}
              </Text>
              <Text style={[styles.liftLabel, { color: colors.text + '80' }]}>{l.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Ladder cells filled by lift composition. */}
      <View style={styles.ladderRow}>
        {Array.from({ length: cellCount }, (_, i) => {
          const fill = colorForCell(i);
          return (
            <View
              key={i}
              style={[
                styles.ladderCell,
                {
                  backgroundColor: fill || colors.border,
                  opacity: fill ? 1 : 0.3,
                  borderWidth: i === currentCell ? 2 : 0,
                  borderColor: colors.text,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.ladderLabels}>
        {data.clubs.map((club, b) => (
          <Text
            key={club.value}
            style={[
              styles.ladderBaseLabel,
              {
                flex: bandCounts[b],
                color: colors.text,
                opacity: b === currentBand ? 1 : 0.35,
                fontWeight: b === currentBand ? '600' : '400',
              },
            ]}
          >
            {club.value.toLocaleString()}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTotal: {},
  headerNum: { fontSize: 34, fontWeight: '500', letterSpacing: -1 },
  headerUnit: { fontSize: 15, fontWeight: '500' },

  liftStack: { alignItems: 'flex-end', gap: 3 },
  liftRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  liftVal: { fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },
  liftLabel: { fontSize: 12, fontWeight: '400', width: 58 },

  ladderRow: { flexDirection: 'row', gap: 2 },
  ladderCell: { flex: 1, height: 14, borderRadius: 2 },
  ladderLabels: { flexDirection: 'row', marginTop: 7 },
  ladderBaseLabel: { fontSize: 11, textAlign: 'right' },
});
