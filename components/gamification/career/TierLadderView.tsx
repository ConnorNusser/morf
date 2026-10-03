import { Text } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor } from '@/lib/data/strengthStandards';
import { TierRung } from '@/lib/gamification/tierTimeline';
import { space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// ---- Tier ladder: every tier, reached ones filled, current marked ----
const TIER_BASES: { base: string; count: number }[] = [
  { base: 'E', count: 3 },
  { base: 'D', count: 3 },
  { base: 'C', count: 3 },
  { base: 'B', count: 3 },
  { base: 'A', count: 3 },
  { base: 'S', count: 4 },
];

export default function TierLadderView({ ladder }: { ladder: TierRung[] }) {
  const { currentTheme } = useTheme();
  const currentBase = ladder.find(r => r.current)?.tier[0] ?? '';
  return (
    <View style={styles.section}>
      <SectionLabel>Tier ladder</SectionLabel>
      <View style={styles.ladderRow}>
        {ladder.map(rung => (
          <View
            key={rung.tier}
            style={[
              styles.ladderCell,
              {
                backgroundColor: rung.reached ? getTierColor(rung.tier) : currentTheme.colors.border,
                opacity: rung.reached ? 1 : 0.3,
                borderWidth: rung.current ? 2 : 0,
                borderColor: currentTheme.colors.text,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.ladderLabels}>
        {TIER_BASES.map(({ base, count }) => (
          <Text
            key={base}
            variant="meta"
            tone={base === currentBase ? 'primary' : 'faint'}
            weight={base === currentBase ? 'bold' : 'medium'}
            style={[styles.ladderBaseLabel, { flex: count }]}
          >
            {base}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.section },
  ladderRow: { flexDirection: 'row', gap: 2 },
  ladderCell: { flex: 1, height: 26, borderRadius: 3 },
  ladderLabels: { flexDirection: 'row', marginTop: space.sm },
  ladderBaseLabel: { textAlign: 'center' },
});
