// Profile tab hero: your picture in its full rank aura, your name, and your
// rank line in the rank accent. Data comes from the screen (CareerSection's
// load, the synced user row); this component only lays it out.
import { Text } from '@/components/Themed';
import RankAvatar from '@/components/ui/RankAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { StrengthTier } from '@/lib/data/strengthStandards';
import { LevelProgress } from '@/lib/gamification/levelCurve';
import { rankAccentForLevel, rankForLevel } from '@/lib/gamification/ranks';
import { readableInkOn } from '@/lib/ui/contrast';
import { heroRankLine, heroStrengthLine } from '@/lib/ui/profileHero';
import { space } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export const PROFILE_HERO_AVATAR = 112;

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
  const dark = readableInkOn(currentTheme.colors.background) === '#FFFFFF';
  const accent = level ? rankAccentForLevel(level.level, dark, level.progress) : undefined;
  const strengthLine = heroStrengthLine(tier, overallPercentile);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        activeOpacity={0.85}
        accessibilityRole={onAvatarPress ? 'button' : 'image'}
        accessibilityLabel={onAvatarPress ? 'Edit profile picture' : 'Profile picture'}
        style={styles.avatarSlot}
      >
        <RankAvatar
          uri={uri}
          username={username}
          size={PROFILE_HERO_AVATAR}
          level={level?.level ?? null}
          progress={level?.progress}
        />
        {onAvatarPress ? (
          <View style={[styles.editBadge, { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.background }]}>
            <Ionicons name="camera" size={14} color={readableInkOn(currentTheme.colors.primary)} />
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.text}>
        <Text variant="heading" weight="bold" tone="primary" numberOfLines={1}>
          {username ? `@${username}` : 'Set a username'}
        </Text>
        {level ? (
          <Text variant="body" weight="semiBold" style={{ color: accent }} numberOfLines={1}>
            {heroRankLine(rankForLevel(level.level).name, level.level)}
          </Text>
        ) : null}
        {strengthLine ? (
          <Text variant="meta" tone="muted" numberOfLines={1}>
            {strengthLine}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  // Room for the ring + glow, which draw outside the avatar's footprint.
  avatarSlot: {
    margin: space.lg,
  },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    alignItems: 'center',
    gap: space.xs,
  },
});
