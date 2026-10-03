import { Text } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { CareerStats, formatCompact } from '@/lib/gamification/careerStats';
import { cleanExerciseName } from '@/lib/gamification/careerView';
import { radius, space } from '@/lib/ui/tokens';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// ---- Fun all-time bests ----
export default function BestsView({ stats }: { stats: CareerStats }) {
  const { currentTheme } = useTheme();
  if (!stats.heaviestSet && stats.biggestSessionVolume === 0) return null;
  const hs = stats.heaviestSet;
  const heaviestName = hs ? cleanExerciseName(getCatalogExercise(hs.exerciseId)?.name ?? 'Lift') : '';
  return (
    <View style={styles.section}>
      <SectionLabel>All-time bests</SectionLabel>
      <View style={styles.bestsRow}>
        {hs && (
          <View style={[styles.bestTile, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
            <Text variant="emphasis" tone="primary" weight="bold">
              {hs.weight} {stats.unit} × {hs.reps}
            </Text>
            <Text variant="meta" tone="muted" style={styles.bestLabel} numberOfLines={1}>
              Heaviest set · {heaviestName}
            </Text>
          </View>
        )}
        {stats.biggestSessionVolume > 0 && (
          <View style={[styles.bestTile, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
            <Text variant="emphasis" tone="primary" weight="bold">
              {formatCompact(stats.biggestSessionVolume)} {stats.unit}
            </Text>
            <Text variant="meta" tone="muted" style={styles.bestLabel}>Biggest session</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.section },
  bestsRow: { flexDirection: 'row', gap: space.md },
  bestTile: { flex: 1, borderRadius: radius.card, borderWidth: 1, padding: space.lg },
  bestLabel: { marginTop: space.xs },
});
