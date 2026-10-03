import { Text } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { LiftPR } from '@/lib/gamification/personalRecords';
import { formatFullDate as formatDate } from '@/lib/ui/formatters';
import { radius, space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// ---- Personal records: best estimated 1RM per main lift ----
export default function PersonalRecordsView({ prs }: { prs: LiftPR[] }) {
  const { currentTheme } = useTheme();
  if (prs.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionLabel>Personal records</SectionLabel>
      <View style={[styles.prCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
        {prs.map((pr, i) => (
          <View
            key={pr.exerciseId}
            style={[
              styles.prRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: currentTheme.colors.border },
            ]}
          >
            <View style={styles.prLeft}>
              <Text variant="body" tone="primary" weight="semiBold" numberOfLines={1}>
                {pr.name}
              </Text>
              <Text variant="meta" tone="muted" style={styles.prSub}>
                {pr.topWeight} {pr.unit} × {pr.topReps} · {formatDate(pr.date)}
              </Text>
            </View>
            <View style={styles.prRight}>
              <Text variant="emphasis" tone="primary" weight="bold">
                {pr.estimatedOneRM} {pr.unit}
              </Text>
              <Text variant="meta" tone="faint" style={styles.prValueLabel}>1RM</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.section },
  prCard: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
  prLeft: { flex: 1, marginRight: space.md },
  prSub: { marginTop: space.xs },
  prRight: { alignItems: 'flex-end' },
  prValueLabel: { marginTop: space.xs },
});
