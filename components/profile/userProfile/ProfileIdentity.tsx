import AchievementBadge from '@/components/gamification/AchievementBadge';
import { AchievementModalItem } from '@/components/gamification/AchievementModal';
import { Text, View, useInk } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { StrengthTier } from '@/lib/data/strengthStandards';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { achievementMeta } from '@/lib/gamification/achievementMeta';
import { RARITY_META } from '@/lib/gamification/rarity';
import { WorkoutSummary } from '@/lib/services/feedService';
import { getCountryName } from '@/lib/services/geoService';
import { formatRelativeTime } from '@/lib/ui/formatters';
import { space, radius, tint } from '@/lib/ui/tokens';
import { RemoteUser, RemoteUserData, formatHeight } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Linking, StyleSheet, TouchableOpacity } from 'react-native';

interface ProfileIdentityProps {
  user: RemoteUser;
  userData: RemoteUserData | null;
  overallTier: StrengthTier | undefined;
  tierColor: string | undefined;
  recentWorkouts: WorkoutSummary[];
  memberSince: Date | null;
  onSpotlight: (item: AchievementModalItem) => void;
  onPressPicture: () => void;
}

/** Top identity block: username + tier, featured achievement, body stats, socials, avatar and activity meta. */
export default function ProfileIdentity({
  user,
  userData,
  overallTier,
  tierColor,
  recentWorkouts,
  memberSince,
  onSpotlight,
  onPressPicture,
}: ProfileIdentityProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <View style={styles.userHeader}>
      <View style={styles.userInfoLeft}>
        <View style={styles.nameRow}>
          <Text
            variant="title"
            weight="semiBold"
            tone="primary"
            style={tierColor ? { color: tierColor } : undefined}
          >
            @{user.username}
          </Text>
          {overallTier && <TierBadge tier={overallTier} size="tiny" />}
        </View>
        {user.country_code && (
          <Text variant="meta" weight="regular" tone="muted">
            {getCountryName(user.country_code)}
          </Text>
        )}
        {(() => {
          const featured = userData?.featured_achievement_id
            ? achievementMeta(userData.featured_achievement_id)
            : undefined;
          if (!featured) return null;
          return (
            <TouchableOpacity
              style={styles.featuredRow}
              activeOpacity={0.7}
              onPress={() => onSpotlight({ ...featured, earnedLabel: `@${user.username}` })}
              accessibilityRole="button"
              accessibilityLabel={featured.title}
            >
              <AchievementBadge
                icon={featured.icon}
                emblem={emblemFor(featured.id)}
                rarity={featured.rarity}
                size={24}
              />
              <Text variant="meta" weight="semiBold" style={{ color: RARITY_META[featured.rarity].accent }}>
                {featured.title}
              </Text>
            </TouchableOpacity>
          );
        })()}
        {(userData?.height || userData?.weight) && (
          <Text variant="meta" tone="muted">
            {[
              userData?.height ? formatHeight(userData.height) : null,
              userData?.weight ? `${Math.round(userData.weight.value)} ${userData.weight.unit}` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        )}
        {(userData?.instagram_username || userData?.tiktok_username || userData?.discord_username) && (
          <View style={styles.socialLinksRow}>
            {userData?.instagram_username && (
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: '#E1306C20' }]}
                onPress={() => Linking.openURL(`https://instagram.com/${userData.instagram_username}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-instagram" size={18} color="#E1306C" />
              </TouchableOpacity>
            )}
            {userData?.tiktok_username && (
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: ink.hairline }]}
                onPress={() => Linking.openURL(`https://tiktok.com/@${userData.tiktok_username}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-tiktok" size={18} color={ink.primary} />
              </TouchableOpacity>
            )}
            {userData?.discord_username && (
              <View
                style={[styles.socialButton, { backgroundColor: '#5865F220' }]}
              >
                <Ionicons name="logo-discord" size={18} color="#5865F2" />
              </View>
            )}
          </View>
        )}
      </View>
      <View style={styles.userHeaderRight}>
        {user.profile_picture_url ? (
          <TouchableOpacity
            onPress={onPressPicture}
            activeOpacity={0.8}
            style={tierColor ? [styles.avatarGlow, { shadowColor: tierColor }] : null}
          >
            <Image
              source={{ uri: user.profile_picture_url }}
              style={[styles.avatarImage, tierColor ? { borderWidth: 2, borderColor: tierColor } : null]}
            />
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.avatar,
              { backgroundColor: tint(tierColor ?? currentTheme.colors.primary) },
              tierColor ? [styles.avatarGlow, { borderWidth: 2, borderColor: tierColor, shadowColor: tierColor }] : null,
            ]}
          >
            <Text variant="statHero" weight="semiBold" style={tierColor ? { color: tierColor } : undefined}>
              {user.username.slice(-2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.metaCol}>
          {recentWorkouts.length > 0 && (
            <Text variant="meta" tone="faint" style={styles.metaText}>
              Last workout {formatRelativeTime(recentWorkouts[0].created_at)}
            </Text>
          )}
          {memberSince && (
            <Text variant="meta" tone="faint" style={styles.metaText}>
              Joined {memberSince.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    alignSelf: 'flex-start',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
  },
  userHeaderRight: {
    alignItems: 'flex-end',
    gap: space.sm,
    marginLeft: space.lg,
  },
  metaCol: {
    alignItems: 'flex-end',
    gap: space.xs,
  },
  metaText: {
    textAlign: 'right',
  },
  avatarGlow: {
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  userInfoLeft: {
    flex: 1,
    gap: space.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  socialLinksRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  socialButton: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
