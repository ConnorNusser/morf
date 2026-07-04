// Home strip: a horizontally-scrollable row of the user's lifts, each showing its
// best set per month across time (oldest → newest). Left→right is time; the month
// under each point makes it explicit. The most recent point is accented as "where
// you are now". Inspired by the career heatmap block, but per-lift instead of days.
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { LiftProgress } from '@/lib/history/liftProgress';
import React from 'react';
import { ScrollView, StyleSheet, View as RNView } from 'react-native';

// Drop the "(Barbell)" style equipment suffix for a cleaner card title.
const shortName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

const setLabel = (weight: number, reps: number): string => (weight > 0 ? `${weight}×${reps}` : `×${reps}`);

function LiftCard({ lift }: { lift: LiftProgress }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  return (
    <RNView style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

export default function LiftProgressStrip({ lifts }: { lifts: LiftProgress[] }) {
  const { currentTheme } = useTheme();
  if (lifts.length === 0) return null;
  return (
    <RNView style={styles.wrap}>
      <Text style={[styles.header, { color: currentTheme.colors.text + '99' }]}>YOUR LIFTS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {lifts.map(lift => (
          <LiftCard key={lift.id} lift={lift} />
        ))}
      </ScrollView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  header: { fontSize: 12, letterSpacing: 0.5, marginBottom: 8, marginLeft: 2 },
  scroll: { gap: 10, paddingRight: 8 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 130,
  },
  name: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  points: { flexDirection: 'row', gap: 14 },
  point: { alignItems: 'flex-start' },
  set: { fontSize: 15, fontWeight: '700' },
  month: { fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
});
