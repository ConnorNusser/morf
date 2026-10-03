import { Text, View } from '@/components/Themed';
import AchievementBadge from '@/components/gamification/AchievementBadge';
import FlipCard from '@/components/gamification/FlipCard';
import { ACHIEVEMENT_EMBLEMS } from '@/lib/gamification/achievementEmblems';
import { RARITY_META } from '@/lib/gamification/rarity';
import { SessionRewards } from '@/lib/gamification/sessionRewards';
import { radius, space, tint } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

function AchievementRewardRow({
  achievement,
}: {
  achievement: SessionRewards['newAchievements'][number];
}) {
  const accent = RARITY_META[achievement.rarity].accent;

  const front = (
    <View style={[styles.achRowFace, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
      <AchievementBadge
        icon={achievement.icon}
        emblem={ACHIEVEMENT_EMBLEMS[achievement.id]}
        rarity={achievement.rarity}
        size={34}
      />
      <View style={styles.achTextWrap}>
        <Text variant="body" weight="semiBold" style={styles.achTitle} numberOfLines={1}>
          {achievement.title}
        </Text>
        <Text variant="meta" weight="medium" style={[styles.achSub, { color: accent }]}>
          {RARITY_META[achievement.rarity].label} · unlocked
        </Text>
      </View>
      <Ionicons name="sync-outline" size={14} color="rgba(255,255,255,0.4)" />
    </View>
  );

  const back = (
    <View style={[styles.achRowFace, styles.achRowBack, { backgroundColor: tint(accent), borderColor: accent }]}>
      <View style={styles.achTextWrap}>
        <Text variant="meta" weight="semiBold" style={[styles.achSub, { color: accent }]} numberOfLines={1}>
          {achievement.title}
        </Text>
        <Text variant="meta" style={styles.achBackDesc} numberOfLines={2}>
          {achievement.description}
        </Text>
      </View>
    </View>
  );

  // height 76 absorbs the 12→14pt type-floor snap without clipping the two-line back face.
  return <FlipCard front={front} back={back} height={76} style={styles.achRowWrap} />;
}

export default function RewardsSection({ rewards }: { rewards: SessionRewards }) {
  const { newAchievements } = rewards;
  const shownAch = newAchievements.slice(0, 3);
  if (shownAch.length === 0) return null;

  // No artificial delay: this only mounts once async rewards land, so a delay just made it lag.
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.rewardsSection}>
      <View style={styles.achList}>
        {shownAch.map(a => (
          <AchievementRewardRow key={a.id} achievement={a} />
        ))}
        {newAchievements.length > shownAch.length && (
          <Text variant="meta" style={styles.achMore}>
            +{newAchievements.length - shownAch.length} more unlocked
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// White-alpha palette is a named exception (screen is always dark); 28/32/36 rhythm is structural.
const styles = StyleSheet.create({
  rewardsSection: {
    width: '100%',
    marginBottom: 28,
  },
  achList: {
    width: '100%',
    gap: space.md,
  },
  achRowWrap: {
    width: '100%',
  },
  achRowFace: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  achRowBack: {
    paddingVertical: space.md,
  },
  achTextWrap: {
    flex: 1,
  },
  achTitle: {
    color: '#fff',
  },
  achSub: {
    marginTop: 1,
  },
  achBackDesc: {
    color: '#fff',
    marginTop: 2,
    lineHeight: lineHeightFor(type.meta),
  },
  achMore: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
});
