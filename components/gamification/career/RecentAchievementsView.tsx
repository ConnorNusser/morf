import AchievementBadge from '@/components/gamification/AchievementBadge';
import AchievementModal, { AchievementModalItem } from '@/components/gamification/AchievementModal';
import { Text } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { Achievement, achievementDisplay } from '@/lib/gamification/achievements';
import { recentAchievements, toSpotlight } from '@/lib/gamification/careerView';
import { RARITY_META } from '@/lib/gamification/rarity';
import { radius, space, withAlpha } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

// ---- Recent achievements: the six you unlocked most recently ----
export default function RecentAchievementsView({
  achievements,
  unlockedAt,
}: {
  achievements: Achievement[];
  unlockedAt: Record<string, string>;
}) {
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);
  const recent = recentAchievements(achievements, unlockedAt);
  return (
    <View style={styles.section}>
      <SectionLabel>Recent achievements</SectionLabel>
      {recent.length === 0 ? (
        <Text variant="meta" tone="muted" style={styles.empty}>
          Log a workout to start earning achievements — your latest will show up here.
        </Text>
      ) : (
        <View style={styles.recentGrid}>
          {recent.map(a => (
            <RecentAchievementTile
              key={a.id}
              achievement={a}
              onPress={() => setSpotlight(toSpotlight(a))}
            />
          ))}
        </View>
      )}
      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} featurable />
    </View>
  );
}

// Compact unlocked-only tile for the Recent achievements strip — 3 per row, badge + title, barely taller than a stat row.
function RecentAchievementTile({ achievement, onPress }: { achievement: Achievement; onPress: () => void }) {
  const r = RARITY_META[achievement.rarity].accent;
  const display = achievementDisplay(achievement);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={display.title}
      style={[styles.recentTile, { backgroundColor: withAlpha(r, 'hairline'), borderColor: withAlpha(r, 'faint') }]}
    >
      <AchievementBadge
        icon={display.icon}
        emblem={emblemFor(achievement.id)}
        rarity={achievement.rarity}
        unlocked
        size={30}
      />
      <Text variant="meta" tone="primary" weight="semiBold" style={styles.recentTitle} numberOfLines={2}>
        {display.title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.section },
  recentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  recentTile: {
    width: '31.5%',
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    alignItems: 'center',
    gap: space.xs,
  },
  recentTitle: { textAlign: 'center' },
  empty: { lineHeight: lineHeightFor(type.meta) },
});
