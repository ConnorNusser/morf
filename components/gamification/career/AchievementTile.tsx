import AchievementBadge from '@/components/gamification/AchievementBadge';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { Achievement, achievementDisplay } from '@/lib/gamification/achievements';
import { formatCompact } from '@/lib/gamification/careerStats';
import { RARITY_META } from '@/lib/gamification/rarity';
import { radius, space, tint, withAlpha } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

// A locked achievement counts as "in progress" once it's at least started, and
// "almost there" once it crosses this bar — which gets a visible highlight.
const ALMOST_THRESHOLD = 0.6;

const ACH_TILE_HEIGHT = 150;

export default function AchievementTile({ achievement, isNew, onPress }: { achievement: Achievement; isNew: boolean; onPress: () => void }) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  // Rarity is the one organizing color — the tile frame, wash and progress all
  // match the badge so the grid reads as a coherent rarity-coded collection.
  const r = RARITY_META[achievement.rarity].accent;
  const display = achievementDisplay(achievement);
  const pct = Math.round(achievement.progress * 100);
  const almost = !achievement.unlocked && !display.masked && achievement.progress >= ALMOST_THRESHOLD;

  const frameStyle = achievement.unlocked
    ? { backgroundColor: withAlpha(r, 'hairline'), borderColor: isNew ? r : withAlpha(r, 'faint'), borderWidth: isNew ? 2 : 1 }
    : almost
      ? { backgroundColor: withAlpha(r, 'hairline'), borderColor: withAlpha(r, 'muted'), borderWidth: 1 }
      : { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border, borderWidth: 1 };

  // The tile face: badge, title, and an unmistakable status (check / % / lock).
  const front = (
    <View style={[styles.achFace, styles.achTile, frameStyle]}>
      <View style={styles.achTileTop}>
        <AchievementBadge
          icon={display.icon}
          emblem={emblemFor(achievement.id)}
          rarity={achievement.rarity}
          unlocked={achievement.unlocked}
          isNew={isNew}
          size={40}
        />
        {achievement.unlocked ? (
          <View style={[styles.achCheck, { backgroundColor: r }]}>
            <Ionicons name="checkmark" size={13} color="#fff" />
          </View>
        ) : almost ? (
          <View style={[styles.achAlmostPill, { backgroundColor: tint(r), borderColor: r }]}>
            <Text variant="meta" weight="bold" style={{ color: r }}>{pct}%</Text>
          </View>
        ) : (
          <Ionicons
            name={display.masked ? 'help' : 'lock-closed'}
            size={14}
            color={ink.faint}
          />
        )}
      </View>
      <Text
        variant="meta"
        tone={achievement.unlocked ? 'primary' : 'muted'}
        weight="semiBold"
        style={styles.achTitle}
        numberOfLines={1}
      >
        {display.title}
      </Text>
      {achievement.unlocked ? (
        <Text variant="meta" weight="bold" style={{ color: r }} numberOfLines={1}>
          {isNew ? 'Just unlocked' : 'Unlocked'}
        </Text>
      ) : display.masked ? (
        <Text variant="meta" tone="muted" numberOfLines={1}>
          Secret achievement
        </Text>
      ) : (
        <Text variant="meta" tone="muted" numberOfLines={1}>
          {formatCompact(achievement.current)} / {formatCompact(achievement.target)}
        </Text>
      )}
      {!achievement.unlocked && !display.masked && (
        <View style={[styles.achTrack, { backgroundColor: currentTheme.colors.border }]}>
          <View style={[styles.achFill, { backgroundColor: r, width: `${pct}%` }]} />
        </View>
      )}
    </View>
  );

  // Tap opens the full-screen spotlight — the same modal History's feed uses.
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={display.title}
      style={[styles.achTileWrap, { height: ACH_TILE_HEIGHT }]}
    >
      {front}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  achTileWrap: { width: '48%' },
  achFace: { width: '100%', height: '100%' },
  achTile: { borderRadius: radius.card, padding: space.md, gap: space.xs },
  achTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achCheck: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  achAlmostPill: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.badge, borderWidth: 1 },
  achTitle: { marginTop: space.xs },
  achTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: space.sm },
  achFill: { height: 4, borderRadius: 2 },
});
