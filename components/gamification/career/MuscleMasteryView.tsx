import { Text } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor } from '@/lib/data/strengthStandards';
import { MuscleMastery } from '@/lib/gamification/muscleMastery';
import { radius, space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// ---- Muscle-group mastery: per-group tier with a percentile bar ----
export default function MuscleMasteryView({ mastery }: { mastery: MuscleMastery[] }) {
  const { currentTheme } = useTheme();
  if (mastery.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionLabel>Muscle mastery</SectionLabel>
      <View style={[styles.muscleCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
        {mastery.map(m => {
          const color = getTierColor(m.tier);
          return (
            <View key={m.group} style={styles.muscleRow}>
              <Text variant="meta" tone="primary" weight="semiBold" style={styles.muscleName}>
                {m.group.charAt(0).toUpperCase() + m.group.slice(1)}
              </Text>
              <View style={[styles.muscleTrack, { backgroundColor: currentTheme.colors.border }]}>
                <View style={[styles.muscleFill, { backgroundColor: color, width: `${Math.max(3, m.percentile)}%` }]} />
              </View>
              <TierBadge tier={m.tier} size="tiny" variant="outline" showTooltip={false} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.section },
  muscleCard: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg, paddingVertical: space.sm },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  muscleName: { width: 78 },
  muscleTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  muscleFill: { height: 7, borderRadius: 4 },
});
