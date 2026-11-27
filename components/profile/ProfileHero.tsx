// Profile tab hero: your picture in its full rank aura, your name, and your
// rank line in neutral ink (the ring carries the rank's metal). Data comes from the screen (CareerSection's
// load, the synced user row); this component only lays it out.
import { Text, useInk } from '@/components/Themed';
import RankAvatar from '@/components/ui/RankAvatar';
import StrengthHeadline from '@/components/ui/StrengthHeadline';
import { useTheme } from '@/contexts/ThemeContext';
import { StrengthTier } from '@/lib/data/strengthStandards';
import { LevelProgress } from '@/lib/gamification/levelCurve';
import { rankForLevel } from '@/lib/gamification/ranks';
import { readableInkOn } from '@/lib/ui/contrast';
import { heroRankLine, heroStrengthLine } from '@/lib/ui/profileHero';
import { space } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export const PROFILE_HERO_AVATAR = 28;

interface ProfileHeroProps {
  uri?: string | null;
  username: string;
  level: LevelProgress | null;
  tier?: StrengthTier | null;
  overallPercentile?: number;
  /** Opens the profile-picture editor; omit for a view-only avatar. */
  onAvatarPress?: () => void;
}

export default function ProfileHero({ uri, username, level, tier, overallPercentile = 0, onAvatarPress }: ProfileHeroProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const dark = readableInkOn(currentTheme.colors.background) === '#FFFFFF';
  const strengthLine = heroStrengthLine(tier, overallPercentile);

  return (
    <View>
      {/* Swiss minimal: one quiet identity line, a hairline, then the strength headline. */}
      <View style={styles.container}>
        <TouchableOpacity
          onPress={onAvatarPress}
          disabled={!onAvatarPress}
          activeOpacity={0.85}
          accessibilityRole={onAvatarPress ? 'button' : 'image'}
          accessibilityLabel={onAvatarPress ? 'Edit profile picture' : 'Profile picture'}
          style={styles.identity}
        >
          <RankAvatar
            uri={uri}
            username={username}
            size={PROFILE_HERO_AVATAR}
            level={level?.level ?? null}
            progress={level?.progress}
            animated={false}
          />
          <Text variant="body" weight="semiBold" tone="primary" numberOfLines={1} style={styles.handle}>
            {username ? `@${username}` : 'Set a username'}
          </Text>
        </TouchableOpacity>
        {level ? (
          <Text variant="meta" tone="muted" numberOfLines={1}>
            {rankForLevel(level.level).name} · Lv {level.level}
          </Text>
        ) : null}
      </View>
      <View style={[styles.rule, { backgroundColor: ink.hairline }]} />
      <StrengthHeadline percentile={tier ? overallPercentile : 0} letterSize={128} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingTop: space.md,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  handle: { flexShrink: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: space.md, marginBottom: space.xl },
});
