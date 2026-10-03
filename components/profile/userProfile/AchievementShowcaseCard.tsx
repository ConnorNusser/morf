import AchievementBadge from '@/components/gamification/AchievementBadge';
import { AchievementModalItem } from '@/components/gamification/AchievementModal';
import { cardStyles } from '@/components/profile/userProfile/cardStyles';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { RARITY_META } from '@/lib/gamification/rarity';
import { AchievementShowcase } from '@/lib/gamification/userProfileInsights';
import { space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface AchievementShowcaseCardProps {
  username: string;
  showcase: AchievementShowcase;
  onSpotlight: (item: AchievementModalItem) => void;
}

/** Grid of the user's rarest earned achievements; tapping one opens the spotlight. */
export default function AchievementShowcaseCard({ username, showcase, onSpotlight }: AchievementShowcaseCardProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={[cardStyles.card, { backgroundColor: currentTheme.colors.surface }]}>
      <View style={cardStyles.cardHeader}>
        <Text variant="body" weight="semiBold" tone="primary">
          Rarest Achievements
        </Text>
        <Text variant="meta" tone="muted">
          {showcase.totalAchievements} earned
        </Text>
      </View>
      <View style={styles.showcaseGrid}>
        {showcase.rarest.map(m => (
          <TouchableOpacity
            key={m.id}
            style={styles.showcaseCell}
            activeOpacity={0.7}
            onPress={() => onSpotlight({ ...m, earnedLabel: `@${username}` })}
            accessibilityRole="button"
            accessibilityLabel={m.title}
          >
            <AchievementBadge icon={m.icon} emblem={emblemFor(m.id)} rarity={m.rarity} size={40} />
            <Text variant="meta" weight="medium" tone="primary" numberOfLines={1} style={styles.showcaseTitle}>
              {m.title}
            </Text>
            <Text variant="meta" weight="semiBold" style={{ color: RARITY_META[m.rarity].accent }}>
              {RARITY_META[m.rarity].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  showcaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.lg,
  },
  showcaseCell: {
    flexBasis: '33.3%',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.xs,
  },
  showcaseTitle: {
    textAlign: 'center',
    maxWidth: '100%',
  },
});
