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

// Warm "heat" ramp — the higher the club, the hotter. Muted (not neon) so it reads
// as prestige, not an arcade. One colour per rung, low→high.
const HEAT = ['#E0A32E', '#E07A3E', '#D75248', '#C0433E'];
const heatFor = (i: number, n: number) => HEAT[Math.min(HEAT.length - 1, Math.round((i / Math.max(1, n - 1)) * (HEAT.length - 1)))];

// Flat, full-width "Big 3 Total" widget — a peer of Overall Strength. The total is
// the hero; the three lifts show composition as colour-coded pounds (no letters);
// the milestone "clubs" (600/1000/1200) render as a subway-style stepper where each
// rung's colour heats up with the weight. The next club glows; earned ones are
// filled; future ones sit as dim outlined chips. Colour ⇒ pounds, never grades.
export default function PowerliftingTotal({ data }: { data: PowerliftingTotalData }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const n = data.clubs.length;
  const activeIndex = data.clubs.findIndex(c => !c.achieved); // -1 when all earned

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Big 3 Total</Text>
        <Text style={[styles.clubsCount, { color: colors.text + '80' }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{data.achievedCount}</Text> of {n} clubs
        </Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>{data.total.toLocaleString()}</Text>
        <Text style={[styles.unit, { color: colors.text + '99' }]}>lb</Text>
      </View>

      {/* Composition: colour-coded pounds joined by faint links (no S/B/D letters). */}
      <View style={styles.comp}>
        {data.lifts.map((l, i) => (
          <React.Fragment key={l.label}>
            {i > 0 && <View style={[styles.compLink, { backgroundColor: colors.text + '14' }]} />}
            <View style={styles.compLift}>
              <View style={[styles.dot, { backgroundColor: l.color, opacity: l.value > 0 ? 1 : 0.4 }]} />
              <Text style={[styles.compVal, { color: l.value > 0 ? l.color : colors.text + '55' }]}>
                {l.value.toLocaleString()}
                <Text style={styles.compUnit}>lb</Text>
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Club stepper — a rung per milestone, coloured by weight. */}
      <View style={styles.rungs}>
        <View style={[styles.track, { backgroundColor: colors.text + '12', left: `${50 / n}%`, right: `${50 / n}%` }]} />
        {activeIndex > 0 && (
          <View
            style={[
              styles.track,
              styles.lead,
              { backgroundColor: colors.primary + '55', left: `${50 / n}%`, width: `${(activeIndex * 100) / n}%` },
            ]}
          />
        )}
        <View style={styles.chips}>
          {data.clubs.map((club, i) => {
            const heat = heatFor(i, n);
            const isActive = i === activeIndex;
            const chipStyle = club.achieved
              ? { backgroundColor: heat, borderColor: heat }
              : isActive
                ? { backgroundColor: heat, borderColor: heat }
                : { backgroundColor: colors.background, borderColor: heat + '3D' };
            const numColor = club.achieved || isActive ? '#1A1206' : heat + 'B0';
            return (
              <View key={club.value} style={styles.chipCol}>
                <View
                  style={[
                    styles.chip,
                    chipStyle,
                    isActive && { shadowColor: heat, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
                  ]}
                >
                  <Text style={[styles.chipNum, { color: numColor }]}>{club.value.toLocaleString()}</Text>
                </View>
                <Text
                  style={[
                    styles.chipCap,
                    { color: isActive ? heat : colors.text + '40', fontWeight: isActive ? '700' : '500' },
                  ]}
                >
                  {club.achieved ? 'Earned' : isActive ? `${data.remaining} to go` : ' '}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 18, fontWeight: 'bold' },
  clubsCount: { fontSize: 13, fontWeight: '500' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontSize: 40, fontWeight: '800', lineHeight: 44, letterSpacing: -1 },
  unit: { fontSize: 17, fontWeight: '600', marginLeft: 6 },

  comp: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  compLift: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  compVal: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  compUnit: { fontSize: 11, fontWeight: '600', opacity: 0.7 },
  compLink: { flex: 1, height: 1, marginHorizontal: 12 },

  rungs: { marginTop: 26 },
  track: { position: 'absolute', top: 19, height: 3, borderRadius: 2 },
  lead: { top: 18, height: 4 },
  chips: { flexDirection: 'row', justifyContent: 'space-between' },
  chipCol: { alignItems: 'center', flex: 1 },
  chip: {
    minWidth: 64,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipNum: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  chipCap: { fontSize: 11.5, marginTop: 9, textAlign: 'center' },
});
