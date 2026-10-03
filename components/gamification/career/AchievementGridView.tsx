import Chip from '@/components/Chip';
import AchievementModal, { AchievementModalItem } from '@/components/gamification/AchievementModal';
import AchievementTile from '@/components/gamification/career/AchievementTile';
import { Text } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { Achievement } from '@/lib/gamification/achievements';
import { AchievementFilter, buildAchievementGrid, toSpotlight } from '@/lib/gamification/careerView';
import { Rarity, RARITY_META } from '@/lib/gamification/rarity';
import { radius, space, tint, withAlpha } from '@/lib/ui/tokens';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

// ---- Achievement grid ----
const ACH_FILTERS: { key: AchievementFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'special', label: 'Special' },
  { key: 'strength', label: 'Strength' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'volume', label: 'Volume' },
  { key: 'milestone', label: 'Milestones' },
];

export default function AchievementGridView({ achievements, newIds }: { achievements: Achievement[]; newIds: Set<string> }) {
  const [filter, setFilter] = useState<AchievementFilter>('all');
  const [rarityFilter, setRarityFilter] = useState<Rarity | null>(null);
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);
  const { breakdown, filtered, unlocked, groups } = buildAchievementGrid(achievements, filter, rarityFilter, newIds);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <SectionLabel>Achievements</SectionLabel>
        <Text variant="meta" tone="muted" weight="semiBold">
          {unlocked}/{filtered.length}
        </Text>
      </View>
      <View style={styles.rarityRow}>
        {breakdown.map(b => {
          const rc = RARITY_META[b.rarity].accent;
          const complete = b.total > 0 && b.unlocked === b.total;
          const active = rarityFilter === b.rarity;
          return (
            <TouchableOpacity
              key={b.rarity}
              activeOpacity={0.7}
              onPress={() => setRarityFilter(prev => (prev === b.rarity ? null : b.rarity))}
              style={[
                styles.rarityChip,
                {
                  backgroundColor: tint(rc),
                  borderColor: active || complete ? rc : withAlpha(rc, 'ghost'),
                  borderWidth: active ? 1.5 : 1,
                },
              ]}
            >
              <Text variant="meta" weight="semiBold" style={{ color: rc }}>
                {RARITY_META[b.rarity].label}
              </Text>
              <Text variant="meta" tone="primary" weight="bold">
                {b.unlocked}/{b.total}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text variant="meta" tone="faint" style={styles.achHint}>
        Tap a tier to filter · tap a badge for details
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achTabs}>
        {ACH_FILTERS.map(f => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ScrollView>
      {groups.map(g =>
        g.items.length === 0 ? null : (
          <View key={g.key} style={styles.achGroup}>
            <View style={styles.achGroupHead}>
              <SectionLabel>{g.label}</SectionLabel>
              <Text variant="meta" tone="faint" weight="bold">{g.items.length}</Text>
            </View>
            <View style={styles.grid}>
              {g.items.map(a => (
                <AchievementTile
                  key={a.id}
                  achievement={a}
                  isNew={newIds.has(a.id)}
                  onPress={() => setSpotlight(toSpotlight(a))}
                />
              ))}
            </View>
          </View>
        ),
      )}

      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} featurable />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.section },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  rarityRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xs, marginBottom: space.lg },
  rarityChip: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.control, borderWidth: 1, gap: space.xs },
  achTabs: { gap: space.sm, paddingBottom: space.md },
  achHint: { marginTop: space.xs },
  achGroup: { marginTop: space.sm, gap: space.sm },
  achGroupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
