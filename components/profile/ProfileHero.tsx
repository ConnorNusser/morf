// Profile tab hero: your picture in its full rank aura, your name, and your
// rank line in neutral ink (the ring carries the rank's metal). Data comes from the screen (CareerSection's
// load, the synced user row); this component only lays it out.
import { Text } from '@/components/Themed';
import RankAvatar from '@/components/ui/RankAvatar';
import HexTierBadge from '@/components/gamification/HexTierBadge';
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

export const PROFILE_HERO_AVATAR = 56;

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
  const strengthLine = heroStrengthLine(tier, overallPercentile);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        activeOpacity={0.85}
        accessibilityRole={onAvatarPress ? 'button' : 'image'}
        accessibilityLabel={onAvatarPress ? 'Edit profile picture' : 'Profile picture'}
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
            <Ionicons name="camera" size={12} color={readableInkOn(currentTheme.colors.primary)} />
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.text}>
        <Text variant="heading" weight="bold" tone="primary" numberOfLines={1}>
          {username ? `@${username}` : 'Set a username'}
        </Text>
        {level ? (
          <Text variant="meta" tone="secondary" numberOfLines={1}>
            {rankForLevel(level.level).name} · Lv {level.level}
          </Text>
        ) : null}
      </View>

      {/* Style D: the tier as an object beside your name; the sheet below breaks it down. */}
      {tier && overallPercentile > 0 ? <HexTierBadge tier={tier} size={64} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.lg,
    paddingBottom: space.lg,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
