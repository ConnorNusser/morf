// History widget: a full-width panel listing the user's lifts, each row showing its
// best set per month across time (oldest → newest, right-aligned so the latest
// lines up down the right edge). Month under each point makes the timeline explicit;
// left→right is time. Latest point is accented as "where you are now".
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { LiftProgress } from '@/lib/history/liftProgress';
import React from 'react';
import { StyleSheet, View as RNView } from 'react-native';

const shortName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();
const setLabel = (weight: number, reps: number): string => (weight > 0 ? `${weight}×${reps}` : `×${reps}`);

function LiftRow({ lift, last }: { lift: LiftProgress; last: boolean }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  return (
    <RNView
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {shortName(lift.name)}
      </Text>
      <RNView style={styles.points}>
        {lift.points.map((p, i) => {
          const latest = i === lift.points.length - 1;
          return (
            <RNView key={i} style={styles.point}>
              <Text style={[styles.set, { color: latest ? colors.primary : colors.text }]} numberOfLines={1}>
                {setLabel(p.weight, p.reps)}
              </Text>
              <Text style={[styles.month, { color: colors.text + '80' }]}>{p.monthLabel}</Text>
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
  // Flat: no surface/border — the rows sit on the page, separated by hairline
  // dividers, so it reads as a clean list instead of a boxed panel.
  panel: {
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  name: { flex: 1, fontSize: 14, fontWeight: '600' },
  points: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  point: { alignItems: 'flex-end', minWidth: 46 },
  set: { fontSize: 14, fontWeight: '700' },
  month: { fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
});
