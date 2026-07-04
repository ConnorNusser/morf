import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface PowerliftingTotalData {
  total: number; // combined best e1RM of squat + bench + deadlift, in lb
  milestoneTarget: number; // next club to chase (lb)
  remaining: number; // lb left to reach that club (0 once reached)
  progress: number; // 0..1 toward the next club
  allUnlocked: boolean; // every milestone already cleared
}

interface Props {
  data: PowerliftingTotalData;
}

// Flat, full-width "powerlifting total" hero — the combined squat/bench/deadlift
// e1RM (the 1,000 lb club idea). No card box: a big number sitting on the page,
// a subtle track + primary fill toward the next club, and a one-line caption.
export default function PowerliftingTotal({ data }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;

  const caption = data.allUnlocked
    ? `${data.milestoneTarget.toLocaleString()} lb club reached`
    : `${data.remaining.toLocaleString()} lb to the ${data.milestoneTarget.toLocaleString()} lb club`;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>BIG 3 TOTAL</Text>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>
          {data.total.toLocaleString()}
        </Text>
        <Text style={[styles.unit, { color: colors.text }]}>lb</Text>
      </View>

      <View style={[styles.track, { backgroundColor: colors.text + '15' }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              width: `${Math.round(Math.max(0, Math.min(1, data.progress)) * 100)}%`,
            },
          ]}
        />
      </View>

      <Text style={[styles.caption, { color: colors.text }]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.5,
    marginBottom: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 48,
  },
  unit: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 6,
    opacity: 0.6,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  caption: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 8,
  },
});
