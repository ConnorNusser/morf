// Volume per session as BARS — one bar = one workout, oldest → newest, wearing the
// session's PPL split color; the newest bar is full strength, older ones fade.
// Bars, deliberately not a line: sessions are discrete efforts. Shared so the This
// Week card can host it without owning session-recap derivation.
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS } from '@/lib/data/pplCategories';
import { SessionRecap } from '@/lib/history/sessionRecap';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const CHART_SESSIONS = 10;
const BAR_MAX_H = 34;
const BAR_MIN_H = 6;

export default function SessionVolumeBars({ recaps }: { recaps: SessionRecap[] }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const bars = recaps.slice(0, CHART_SESSIONS).reverse(); // oldest → newest
  if (bars.length < 3) return null;
  const max = Math.max(...bars.map(r => r.volumeDisplay), 1);

  return (
    <View style={styles.chart}>
      {bars.map((r, i) => {
        const latest = i === bars.length - 1;
        const h = BAR_MIN_H + (r.volumeDisplay / max) * (BAR_MAX_H - BAR_MIN_H);
        const color = r.split ? PPL_COLORS[r.split] : colors.primary;
        return (
          <View
            key={r.workout.id}
            style={[
              styles.bar,
              { height: h, backgroundColor: color, opacity: latest ? 1 : 0.35 + (i / bars.length) * 0.4 },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: BAR_MAX_H },
  bar: { flex: 1, borderRadius: 2.5 },
});
