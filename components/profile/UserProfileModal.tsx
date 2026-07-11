import AchievementBadge from '@/components/gamification/AchievementBadge';
import AchievementModal, { AchievementModalItem } from '@/components/gamification/AchievementModal';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { achievementMeta, AchievementMeta } from '@/lib/gamification/achievementMeta';
import { RARITY_META, rarityRank } from '@/lib/gamification/rarity';
import PercentileSparkline from '@/components/profile/PercentileSparkline';
import IconButton from '@/components/IconButton';
import InteractiveProgressChart from '@/components/InteractiveProgressChart';
import { formatRelativeTime, formatDuration } from '@/lib/ui/formatters';
import SkeletonCard from '@/components/SkeletonCard';
import StrengthRadarCard from '@/components/StrengthRadarCard';
import { Text, View, useInk } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import EmptyState from '@/components/ui/EmptyState';
import StatStrip from '@/components/ui/StatStrip';
import { useTheme } from '@/contexts/ThemeContext';
import { getCountryName } from '@/lib/services/geoService';
import { layout } from '@/lib/ui/styles';
import { space, radius, screenGutter, tint, trend } from '@/lib/ui/tokens';
import { supabase } from '@/lib/services/supabase';
import { userSyncService } from '@/lib/services/userSyncService';
import { WorkoutFeedData, WorkoutSummary } from '@/lib/services/feedService';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { calculateStrengthPercentile, getStrengthTier, getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { userService } from '@/lib/services/userService';
import { convertWeightToLbs } from '@/lib/utils/utils';
import { RemoteUser, RemoteUserData, MAIN_LIFTS, UserPercentileData, UserProgress, formatHeight, isFeaturedLift } from '@/types';
import { usePauseVideosWhileOpen } from '@/contexts/VideoPlayerContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface UserLiftData {
  exercise_id: string;
  estimated_1rm: number;
  recorded_at: string;
}


interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: RemoteUser | null;
}

// Aggregated from every workout's feed_data: career PRs + earned achievements.
interface AchievementShowcase {
  totalPRs: number;
  totalAchievements: number;
  rarest: AchievementMeta[];
}

const BIG_3 = [MAIN_LIFTS.BENCH_PRESS, MAIN_LIFTS.SQUAT, MAIN_LIFTS.DEADLIFT];

// Ambient gradient alpha: the 12% tint() token reads too faint across a full
// sheet, so the top wash gets its own slightly deeper stop.
const wash = (color: string): string => color + '2E';

export default function UserProfileModal({ visible, onClose, user }: UserProfileModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  usePauseVideosWhileOpen(visible);
  const [lifts, setLifts] = useState<UserLiftData[]>([]);
  const [userData, setUserData] = useState<RemoteUserData | null>(null);
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);
  const [percentileData, setPercentileData] = useState<UserPercentileData | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const [workoutCount, setWorkoutCount] = useState<number>(0);
  const [showcase, setShowcase] = useState<AchievementShowcase | null>(null);
  const [myLifts, setMyLifts] = useState<UserLiftData[]>([]);
  const [myUserData, setMyUserData] = useState<RemoteUserData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<Date | null>(null);
  const [comparisonMode, setComparisonMode] = useState<'weight' | 'percentile'>('weight');
  const [showAllComparisons, setShowAllComparisons] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [isFriendLoading, setIsFriendLoading] = useState(false);
  const [showFullScreenPicture, setShowFullScreenPicture] = useState(false);
  const [selectedLiftId, setSelectedLiftId] = useState<string | null>(null);
  const [liftHistory, setLiftHistory] = useState<UserProgress[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  const checkFriendStatus = useCallback(async () => {
    if (!user) return;
    const friendStatus = await userSyncService.isFriend(user.id);
    setIsFriend(friendStatus);
  }, [user]);

  const loadLiftHistory = useCallback(async (exerciseId: string) => {
    if (!user) return;

    if (selectedLiftId === exerciseId) {
      setSelectedLiftId(null);
      setLiftHistory([]);
      return;
    }

    setSelectedLiftId(exerciseId);
    setIsLoadingHistory(true);

    try {
      const history = await userSyncService.getUserLiftHistory(user.id, exerciseId);

      const progressData: UserProgress[] = history.map(lift => ({
        workoutId: exerciseId,
        personalRecord: lift.estimated_1rm,
        lastUpdated: lift.recorded_at,
        percentileRanking: 0,
        strengthLevel: '',
      }));

      setLiftHistory(progressData);
    } catch (error) {
      console.error('Error loading lift history:', error);
      setLiftHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user, selectedLiftId]);

  const handleToggleFriend = async () => {
    if (!user) return;
    setIsFriendLoading(true);
    try {
      if (isFriend) {
        await userSyncService.removeFriend(user.id);
        setIsFriend(false);
      } else {
        await userSyncService.addFriend(user.id);
        setIsFriend(true);
      }
    } catch (error) {
      console.error('Error toggling friend:', error);
    } finally {
      setIsFriendLoading(false);
    }
  };

  const loadUserData = useCallback(async () => {
    if (!user || !supabase) return;

    setIsLoading(true);
    try {
      const currentUser = await userSyncService.getCurrentUser();
      setCurrentUserId(currentUser?.id || null);

      const [liftsResult, userResult, percentileResult, workoutsResult, workoutCountResult, feedDataResult] = await Promise.all([
        supabase
          .from('user_best_lifts')
          .select('exercise_id, estimated_1rm, recorded_at')
          .eq('user_id', user.id),
        supabase
          .from('users')
          .select('user_data, country_code, created_at')
          .eq('id', user.id)
          .single(),
        userSyncService.getUserPercentileData(user.id),
        userSyncService.getUserWorkouts(user.id, 5),
        supabase
          .from('user_workouts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        // Just the gamification snapshots — aggregated below into career PRs
        // and the rarest-achievements showcase.
        supabase
          .from('user_workouts')
          .select('feed_data')
          .eq('user_id', user.id)
      ]);

      if (liftsResult.error) {
        console.error('Error loading user lifts:', liftsResult.error);
        setLifts([]);
      } else {
        setLifts(liftsResult.data || []);
      }

      if (userResult.data) {
        if (userResult.data.user_data) {
          setUserData(userResult.data.user_data as RemoteUserData);
        } else {
          setUserData(null);
        }
        if (userResult.data.country_code && user) {
          user.country_code = userResult.data.country_code;
        }
        if (userResult.data.created_at) {
          setMemberSince(new Date(userResult.data.created_at));
        }
      } else {
        setUserData(null);
        setMemberSince(null);
      }

      setPercentileData(percentileResult);

      setRecentWorkouts(workoutsResult);

      setWorkoutCount(workoutCountResult.count || 0);

      let totalPRs = 0;
      const earnedIds = new Set<string>();
      for (const row of feedDataResult.data || []) {
        const fd = row.feed_data as WorkoutFeedData | null;
        totalPRs += fd?.pr_count || 0;
        (fd?.achievement_ids || []).forEach(id => earnedIds.add(id));
      }
      // Unknown ids (older app versions) resolve to undefined and drop out.
      const rarest = [...earnedIds]
        .map(achievementMeta)
        .filter((m): m is AchievementMeta => m != null)
        .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))
        .slice(0, 6);
      setShowcase({ totalPRs, totalAchievements: earnedIds.size, rarest });

      // Current user's lifts and profile, for the comparison
      if (currentUser && currentUser.id !== user.id) {
        const [myLiftsResult, myProfile] = await Promise.all([
          supabase
            .from('user_best_lifts')
            .select('exercise_id, estimated_1rm, recorded_at')
            .eq('user_id', currentUser.id),
          userService.getUserProfileOrDefault()
        ]);
        setMyLifts(myLiftsResult.data || []);
        setMyUserData({
          height: myProfile.height,
          weight: myProfile.weight,
          gender: myProfile.gender,
        });
      } else {
        setMyLifts([]);
        setMyUserData(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setLifts([]);
      setUserData(null);
      setPercentileData(null);
      setRecentWorkouts([]);
      setWorkoutCount(0);
      setShowcase(null);
      setMyLifts([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (visible && user) {
      loadUserData();
      checkFriendStatus();
    }
  }, [visible, user, loadUserData, checkFriendStatus]);

  // Must be before early return to maintain consistent hook order
  const enhancedTopContributions = useMemo(() => {
    if (!percentileData?.top_contributions) return [];

    const liftWeightMap: Record<string, number> = {};
    lifts.forEach(lift => {
      liftWeightMap[lift.exercise_id] = lift.estimated_1rm;
    });

    return percentileData.top_contributions.map(c => ({
      ...c,
      weight: c.weight || liftWeightMap[c.exercise_id] || undefined,
    }));
  }, [percentileData?.top_contributions, lifts]);

  // Must be before early return to maintain consistent hook order
  const liftComparison = useMemo(() => {
    if (!currentUserId || currentUserId === user?.id || myLifts.length === 0 || lifts.length === 0) {
      return null;
    }

    const myBodyWeight = myUserData?.weight ? convertWeightToLbs(myUserData.weight.value, myUserData.weight.unit) : 0;
    const myGender = myUserData?.gender === 'male' || myUserData?.gender === 'female' ? myUserData.gender : 'male';
    const theirBodyWeight = userData?.weight ? convertWeightToLbs(userData.weight.value, userData.weight.unit) : 0;
    const theirGender = userData?.gender === 'male' || userData?.gender === 'female' ? userData.gender : 'male';

    const myLiftMap: Record<string, number> = {};
    myLifts.forEach(lift => {
      myLiftMap[lift.exercise_id] = lift.estimated_1rm;
    });

    const theirLiftMap: Record<string, number> = {};
    lifts.forEach(lift => {
      theirLiftMap[lift.exercise_id] = lift.estimated_1rm;
    });

    let commonExercises = Object.keys(myLiftMap).filter(id => id in theirLiftMap);
    if (comparisonMode === 'percentile') {
      commonExercises = commonExercises.filter(id => isFeaturedLift(id));
    }
    if (commonExercises.length === 0) return null;

    const comparisons = commonExercises
      .map(exerciseId => {
        const myWeight = myLiftMap[exerciseId];
        const theirWeight = theirLiftMap[exerciseId];

        const myPercentile = myBodyWeight > 0 && isFeaturedLift(exerciseId)
          ? Math.round(calculateStrengthPercentile(myWeight, myBodyWeight, myGender, exerciseId))
          : 0;
        const theirPercentile = theirBodyWeight > 0 && isFeaturedLift(exerciseId)
          ? Math.round(calculateStrengthPercentile(theirWeight, theirBodyWeight, theirGender, exerciseId))
          : 0;

        const usePercentile = comparisonMode === 'percentile';
        const myValue = usePercentile ? myPercentile : Math.round(myWeight);
        const theirValue = usePercentile ? theirPercentile : Math.round(theirWeight);

        return {
          exerciseId,
          name: getCatalogExercise(exerciseId)?.name || exerciseId,
          myValue,
          theirValue,
          myWeight: Math.round(myWeight),
          theirWeight: Math.round(theirWeight),
          myPercentile,
          theirPercentile,
          iWin: myValue > theirValue,
          isTie: myValue === theirValue,
        };
      })
      .filter(c => comparisonMode !== 'percentile' || (c.myPercentile > 0 && c.theirPercentile > 0))
      .sort((a, b) => b.theirValue - a.theirValue);

    if (comparisons.length === 0) return null;

    const myWins = comparisons.filter(c => c.iWin && !c.isTie).length;
    const theirWins = comparisons.filter(c => !c.iWin && !c.isTie).length;

    return {
      comparisons,
      myWins,
      theirWins,
      ties: comparisons.length - myWins - theirWins,
    };
  }, [currentUserId, user?.id, myLifts, lifts, comparisonMode, myUserData, userData]);

  // Derived lift stats, memoized so they don't recompute on unrelated state changes.
  const { benchMax, squatMax, deadliftMax, big3Total, thousandPoundProgress, totalVolume, otherLifts } = useMemo(() => {
    const getBig3Lift = (exerciseId: string) => {
      const lift = lifts.find(l => l.exercise_id === exerciseId);
      return lift ? Math.round(lift.estimated_1rm) : 0;
    };

    const benchMax = getBig3Lift(MAIN_LIFTS.BENCH_PRESS);
    const squatMax = getBig3Lift(MAIN_LIFTS.SQUAT);
    const deadliftMax = getBig3Lift(MAIN_LIFTS.DEADLIFT);
    const big3Total = benchMax + squatMax + deadliftMax;
    const thousandPoundProgress = Math.min(100, Math.round((big3Total / 1000) * 100));

    // Sum of all 1RMs, a rough proxy for volume
    const totalVolume = lifts.reduce((sum, lift) => sum + lift.estimated_1rm, 0);

    const otherLifts = lifts
      .filter(l => !BIG_3.includes(l.exercise_id as typeof MAIN_LIFTS.BENCH_PRESS))
      .filter(l => getCatalogExercise(l.exercise_id) !== null)
      .sort((a, b) => b.estimated_1rm - a.estimated_1rm)
      .slice(0, 5);

    return { benchMax, squatMax, deadliftMax, big3Total, thousandPoundProgress, totalVolume, otherLifts };
  }, [lifts]);

  if (!user) return null;

  const overallPercentile = percentileData?.overall_percentile ?? null;
  // Overall tier drives the identity color, same as feed usernames.
  const overallTier = (percentileData?.strength_level as StrengthTier | undefined)
    ?? (overallPercentile !== null ? getStrengthTier(overallPercentile) : undefined);
  const tierColor = overallTier ? getTierColor(overallTier) : undefined;

  const sparkHistory = percentileData?.percentile_history?.slice(-30) ?? [];
  const sparkDelta = sparkHistory.length >= 2
    ? Math.round(sparkHistory[sparkHistory.length - 1].percentile - sparkHistory[0].percentile)
    : 0;
  const sparkSince = sparkHistory.length >= 2
    ? new Date(sparkHistory[0].date).toLocaleDateString('en-US', { month: 'short' })
    : '';

  const getExerciseName = (id: string) => {
    const workout = getCatalogExercise(id);
    return workout?.name || id;
  };

  // Progression chart for the selected lift, shared by the Big-3 and Other-Lifts sections.
  const renderLiftChart = (liftId: string, description: string) => (
    <View style={[styles.chartContainer, { borderTopColor: ink.hairline }]}>
      {isLoadingHistory ? (
        <View style={styles.chartLoading}>
          <ActivityIndicator size="small" color={currentTheme.colors.primary} />
        </View>
      ) : liftHistory.length >= 2 ? (
        <InteractiveProgressChart
          data={liftHistory}
          selectedMetric="oneRM"
          weightUnit="lbs"
          title={`${getExerciseName(liftId)} Progression`}
          description={description}
        />
      ) : (
        <View style={styles.noHistoryContainer}>
          <Ionicons name="trending-up-outline" size={24} color={ink.faint} />
          <Text variant="meta" weight="regular" tone="muted" style={styles.noHistoryText}>
            Not enough data for progression chart
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
        {/* Fixed tier-color ambience behind the whole sheet — doesn't scroll away. */}
        {tierColor && !isLoading && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <LinearGradient colors={[wash(tierColor), 'transparent']} style={styles.ambientTop} />
            <LinearGradient colors={['transparent', tint(tierColor)]} style={styles.ambientBottom} />
          </View>
        )}
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <IconButton icon="chevron-back" onPress={onClose} />
          <Text variant="emphasis" weight="semiBold" tone="primary">
            Profile
          </Text>
          {/* No friend button on your own profile (reachable via the feed header). */}
          {currentUserId !== user?.id ? (
            <TouchableOpacity
              style={[
                styles.friendButton,
                {
                  backgroundColor: isFriend ? currentTheme.colors.surface : currentTheme.colors.primary,
                  borderColor: isFriend ? currentTheme.colors.border : currentTheme.colors.primary,
                  borderWidth: 1,
                }
              ]}
              onPress={handleToggleFriend}
              disabled={isFriendLoading}
              activeOpacity={0.7}
            >
              {isFriendLoading ? (
                <ActivityIndicator size="small" color={isFriend ? currentTheme.colors.text : '#FFFFFF'} />
              ) : (
                <>
                  <Ionicons
                    name={isFriend ? 'checkmark' : 'person-add'}
                    size={16}
                    color={isFriend ? currentTheme.colors.text : '#FFFFFF'}
                  />
                  <Text
                    variant="meta"
                    style={{ color: isFriend ? currentTheme.colors.text : '#FFFFFF' }}
                  >
                    {isFriend ? 'Friends' : 'Add'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            /* Spacer keeps the "Profile" title centered by the space-between row. */
            <View style={[styles.friendButton, { backgroundColor: 'transparent' }]} />
          )}
        </View>

        <ScrollView style={layout.flex1} contentContainerStyle={styles.scrollContent}>
          {isLoading ? (
            <View style={styles.loadingStack}>
              <SkeletonCard variant="profile-header" />
              <SkeletonCard variant="stats" />
              <SkeletonCard variant="stats" />
            </View>
          ) : (
            <>
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
                        onPress={() => setSpotlight({ ...featured, earnedLabel: `@${user.username}` })}
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
                      onPress={() => setShowFullScreenPicture(true)}
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
                        {user.username.charAt(0).toUpperCase()}
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

              {percentileData && overallPercentile !== null && (
                <StrengthRadarCard
                  overallPercentile={Math.round(overallPercentile)}
                  muscleGroups={percentileData.muscle_groups}
                  topContributions={enhancedTopContributions}
                />
              )}

              {sparkHistory.length >= 2 && tierColor && (
                <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                  <View style={styles.cardHeader}>
                    <Text variant="body" weight="semiBold" tone="primary">
                      Strength Journey
                    </Text>
                    <Text
                      variant="meta"
                      weight="semiBold"
                      style={{ color: sparkDelta > 0 ? trend.up : sparkDelta < 0 ? trend.down : ink.muted }}
                    >
                      {sparkDelta >= 0 ? '+' : ''}{sparkDelta} since {sparkSince}
                    </Text>
                  </View>
                  <PercentileSparkline history={sparkHistory} color={tierColor} />
                </View>
              )}

              <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                <View style={styles.cardHeader}>
                  <Text variant="body" weight="semiBold" tone="primary">
                    1000lb Club
                  </Text>
                  <Text variant="emphasis" weight="bold">
                    {big3Total} lbs
                  </Text>
                </View>

                <View style={[styles.progressBarContainer, { backgroundColor: currentTheme.colors.border }]}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        backgroundColor: thousandPoundProgress >= 100 ? trend.up : currentTheme.colors.primary,
                        width: `${thousandPoundProgress}%`
                      }
                    ]}
                  />
                </View>
                <Text variant="meta" weight="regular" tone="muted" style={styles.progressText}>
                  {thousandPoundProgress >= 100 ? 'Member!' : `${thousandPoundProgress}% to 1000lbs`}
                </Text>

                <View style={styles.big3Container}>
                  <TouchableOpacity
                    style={[
                      styles.big3Item,
                      {
                        backgroundColor: selectedLiftId === MAIN_LIFTS.BENCH_PRESS ? tint(currentTheme.colors.primary) : currentTheme.colors.background,
                        borderColor: selectedLiftId === MAIN_LIFTS.BENCH_PRESS ? currentTheme.colors.primary : currentTheme.colors.border,
                      }
                    ]}
                    onPress={() => benchMax ? loadLiftHistory(MAIN_LIFTS.BENCH_PRESS) : null}
                    activeOpacity={benchMax ? 0.7 : 1}
                    disabled={!benchMax}
                  >
                    <Text variant="meta" weight="medium" tone="secondary">
                      Bench
                    </Text>
                    <Text variant="body" weight="semiBold" tone="primary">
                      {benchMax || '-'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.big3Item,
                      {
                        backgroundColor: selectedLiftId === MAIN_LIFTS.SQUAT ? tint(currentTheme.colors.primary) : currentTheme.colors.background,
                        borderColor: selectedLiftId === MAIN_LIFTS.SQUAT ? currentTheme.colors.primary : currentTheme.colors.border,
                      }
                    ]}
                    onPress={() => squatMax ? loadLiftHistory(MAIN_LIFTS.SQUAT) : null}
                    activeOpacity={squatMax ? 0.7 : 1}
                    disabled={!squatMax}
                  >
                    <Text variant="meta" weight="medium" tone="secondary">
                      Squat
                    </Text>
                    <Text variant="body" weight="semiBold" tone="primary">
                      {squatMax || '-'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.big3Item,
                      {
                        backgroundColor: selectedLiftId === MAIN_LIFTS.DEADLIFT ? tint(currentTheme.colors.primary) : currentTheme.colors.background,
                        borderColor: selectedLiftId === MAIN_LIFTS.DEADLIFT ? currentTheme.colors.primary : currentTheme.colors.border,
                      }
                    ]}
                    onPress={() => deadliftMax ? loadLiftHistory(MAIN_LIFTS.DEADLIFT) : null}
                    activeOpacity={deadliftMax ? 0.7 : 1}
                    disabled={!deadliftMax}
                  >
                    <Text variant="meta" weight="medium" tone="secondary">
                      Deadlift
                    </Text>
                    <Text variant="body" weight="semiBold" tone="primary">
                      {deadliftMax || '-'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedLiftId && BIG_3.includes(selectedLiftId as typeof MAIN_LIFTS.BENCH_PRESS) &&
                  renderLiftChart(selectedLiftId, "Estimated from your workout sessions")}
              </View>

              <StatStrip
                items={[
                  { value: workoutCount, label: 'Workouts' },
                  { value: showcase?.totalPRs ?? 0, label: 'PRs' },
                  { value: lifts.length, label: 'Exercises' },
                  { value: Math.round(totalVolume).toLocaleString(), label: 'Total 1RM' },
                ]}
              />

              {liftComparison && (
                <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                  <View style={styles.comparisonHeader}>
                    <Text variant="body" weight="semiBold" tone="primary">
                      You vs @{user.username}
                    </Text>
                    <View style={styles.comparisonSummary}>
                      <Text
                        variant="emphasis"
                        weight="bold"
                        style={{
                          color: liftComparison.myWins > liftComparison.theirWins
                            ? trend.up
                            : liftComparison.myWins < liftComparison.theirWins
                              ? trend.down
                              : ink.muted
                        }}
                      >
                        {liftComparison.myWins}-{liftComparison.theirWins}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.comparisonChips}>
                    <TouchableOpacity
                      style={[
                        styles.comparisonChip,
                        {
                          backgroundColor: comparisonMode === 'weight' ? currentTheme.colors.primary : currentTheme.colors.background,
                          borderColor: comparisonMode === 'weight' ? currentTheme.colors.primary : currentTheme.colors.border,
                        }
                      ]}
                      onPress={() => { setComparisonMode('weight'); setShowAllComparisons(false); }}
                      activeOpacity={0.7}
                    >
                      <Text
                        variant="meta"
                        weight="semiBold"
                        style={{ color: comparisonMode === 'weight' ? '#FFFFFF' : currentTheme.colors.text + '80' }}
                      >
                        By Weight
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.comparisonChip,
                        {
                          backgroundColor: comparisonMode === 'percentile' ? currentTheme.colors.primary : currentTheme.colors.background,
                          borderColor: comparisonMode === 'percentile' ? currentTheme.colors.primary : currentTheme.colors.border,
                        }
                      ]}
                      onPress={() => { setComparisonMode('percentile'); setShowAllComparisons(false); }}
                      activeOpacity={0.7}
                    >
                      <Text
                        variant="meta"
                        weight="semiBold"
                        style={{ color: comparisonMode === 'percentile' ? '#FFFFFF' : currentTheme.colors.text + '80' }}
                      >
                        By Percentile
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.comparisonHeaderRow, { borderBottomColor: currentTheme.colors.border }]}>
                    <Text variant="meta" weight="semiBold" tone="muted" style={styles.comparisonColumnHeader}>You</Text>
                    <Text variant="meta" weight="semiBold" tone="muted" style={[styles.comparisonColumnHeader, { flex: 1, textAlign: 'center' }]}>Exercise</Text>
                    <Text variant="meta" weight="semiBold" tone="muted" style={styles.comparisonColumnHeader}>Them</Text>
                  </View>
                  <View style={styles.comparisonList}>
                    {(showAllComparisons ? liftComparison.comparisons : liftComparison.comparisons.slice(0, 4)).map((comp) => {
                      const diff = comp.myValue - comp.theirValue;
                      const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                      return (
                        <View key={comp.exerciseId} style={styles.comparisonRow}>
                          <View style={[
                            styles.comparisonValuePill,
                            comp.iWin && !comp.isTie && { backgroundColor: tint(trend.up) }
                          ]}>
                            <Text
                              variant="meta"
                              weight="semiBold"
                              style={{ color: comp.iWin && !comp.isTie ? trend.up : currentTheme.colors.text }}
                            >
                              {comp.myValue}{comparisonMode === 'percentile' ? '%' : ''}
                            </Text>
                          </View>
                          <View style={styles.comparisonMiddle}>
                            <Text variant="meta" tone="secondary" style={styles.comparisonExercise} numberOfLines={1}>
                              {comp.name}
                            </Text>
                            {!comp.isTie && (
                              <Text
                                variant="meta"
                                weight="semiBold"
                                style={[
                                  styles.comparisonDiff,
                                  { color: diff > 0 ? trend.up : trend.down }
                                ]}
                              >
                                {diffText}{comparisonMode === 'percentile' ? '%' : ''}
                              </Text>
                            )}
                          </View>
                          <View style={styles.comparisonValuePill}>
                            <Text variant="meta" weight="semiBold" tone="primary">
                              {comp.theirValue}{comparisonMode === 'percentile' ? '%' : ''}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  {liftComparison.comparisons.length > 4 && (
                    <TouchableOpacity
                      style={[styles.showMoreButton, { borderColor: currentTheme.colors.border }]}
                      onPress={() => setShowAllComparisons(!showAllComparisons)}
                      activeOpacity={0.7}
                    >
                      <Text variant="meta" weight="semiBold">
                        {showAllComparisons ? 'Show less' : `Show ${liftComparison.comparisons.length - 4} more`}
                      </Text>
                      <Ionicons
                        name={showAllComparisons ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={currentTheme.colors.primary}
                      />
                    </TouchableOpacity>
                  )}
                  <Text variant="meta" tone="faint" style={styles.comparisonFooter}>
                    Comparing {liftComparison.comparisons.length} shared exercises ({comparisonMode === 'percentile' ? 'percentile' : '1RM lbs'})
                  </Text>
                </View>
              )}

              {showcase && showcase.rarest.length > 0 && (
                <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                  <View style={styles.cardHeader}>
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
                        onPress={() => setSpotlight({ ...m, earnedLabel: `@${user.username}` })}
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
              )}

              {otherLifts.length > 0 && (
                <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                  <Text variant="body" weight="semiBold" tone="primary">
                    Top Lifts
                  </Text>
                  <View style={styles.liftsList}>
                    {otherLifts.map((lift) => {
                      const isSelected = selectedLiftId === lift.exercise_id && !BIG_3.includes(selectedLiftId as typeof MAIN_LIFTS.BENCH_PRESS);
                      return (
                        <TouchableOpacity
                          key={lift.exercise_id}
                          style={[
                            styles.liftRowInteractive,
                            {
                              backgroundColor: currentTheme.colors.background,
                              borderColor: isSelected ? currentTheme.colors.primary : currentTheme.colors.border,
                              borderWidth: isSelected ? 1.5 : 1,
                            },
                          ]}
                          onPress={() => loadLiftHistory(lift.exercise_id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.liftRowLeft}>
                            <Text variant="meta" weight="medium" tone="primary">
                              {getExerciseName(lift.exercise_id)}
                            </Text>
                            <Text variant="meta" weight="semiBold" tone="secondary">
                              {Math.round(lift.estimated_1rm)} lbs
                            </Text>
                          </View>
                          <View style={[styles.liftChevron, { backgroundColor: isSelected ? tint(currentTheme.colors.primary) : currentTheme.colors.border + '50' }]}>
                            <Ionicons
                              name={isSelected ? 'chevron-up' : 'chevron-forward'}
                              size={16}
                              color={isSelected ? currentTheme.colors.primary : ink.muted}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {selectedLiftId && !BIG_3.includes(selectedLiftId as typeof MAIN_LIFTS.BENCH_PRESS) &&
                    renderLiftChart(selectedLiftId, "Tap points to see exact values")}
                </View>
              )}

              {recentWorkouts.length > 0 && (
                <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                  <Text variant="body" weight="semiBold" tone="primary">
                    Recent Workouts
                  </Text>
                  <View style={styles.workoutsList}>
                    {recentWorkouts.map((workout) => {
                      const isExpanded = expandedWorkoutId === workout.id;
                      return (
                        <View key={workout.id}>
                          <TouchableOpacity
                            style={[
                              styles.workoutRowInteractive,
                              {
                                backgroundColor: currentTheme.colors.background,
                                borderColor: isExpanded ? currentTheme.colors.primary : currentTheme.colors.border,
                                borderWidth: isExpanded ? 1.5 : 1,
                              }
                            ]}
                            onPress={() => setExpandedWorkoutId(isExpanded ? null : workout.id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.workoutRowContent}>
                              <View style={styles.workoutRowTop}>
                                <Text variant="body" weight="semiBold" tone="primary" style={styles.workoutTitle}>
                                  {workout.title}
                                </Text>
                                <Text variant="meta" weight="regular" tone="muted">
                                  {formatRelativeTime(workout.created_at)}
                                </Text>
                              </View>
                              <Text variant="meta" weight="regular" tone="secondary">
                                {workout.exercise_count} exercises · {formatDuration(workout.duration_seconds)} · {workout.total_volume.toLocaleString()} lbs
                              </Text>
                            </View>
                            <View style={[styles.workoutChevron, { backgroundColor: isExpanded ? tint(currentTheme.colors.primary) : currentTheme.colors.border + '50' }]}>
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color={isExpanded ? currentTheme.colors.primary : ink.muted}
                              />
                            </View>
                          </TouchableOpacity>

                          {isExpanded && workout.exercises && workout.exercises.length > 0 && (
                            <View style={[
                              styles.workoutExercisesExpanded,
                              {
                                backgroundColor: currentTheme.colors.background,
                                borderColor: currentTheme.colors.primary,
                              }
                            ]}>
                              {workout.exercises.map((exercise, exIndex) => (
                                <View
                                  key={exIndex}
                                  style={[
                                    styles.workoutExerciseRow,
                                    exIndex < workout.exercises.length - 1 && {
                                      borderBottomWidth: StyleSheet.hairlineWidth,
                                      borderBottomColor: currentTheme.colors.border + '50',
                                    }
                                  ]}
                                >
                                  <View style={styles.workoutExerciseLeft}>
                                    <Text variant="meta" weight="medium" tone="primary">
                                      {exercise.name}
                                    </Text>
                                    <Text variant="meta" weight="regular" tone="muted">
                                      {exercise.sets} sets
                                    </Text>
                                  </View>
                                  <View style={styles.workoutExerciseRight}>
                                    <Text variant="meta" weight="semiBold" tone="secondary">
                                      {exercise.bestSet}
                                    </Text>
                                    {exercise.isPR && (
                                      <View style={[styles.prBadge, { backgroundColor: '#FFD700' }]}>
                                        <Text variant="meta" weight="bold" style={styles.prBadgeText}>PR</Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {lifts.length === 0 && (
                <EmptyState
                  icon="barbell-outline"
                  title="No lifts yet"
                  subtitle={`@${user.username} hasn't logged any tracked lifts.`}
                />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {user?.profile_picture_url && (
        <Modal
          visible={showFullScreenPicture}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFullScreenPicture(false)}
        >
          <TouchableOpacity
            style={styles.fullScreenContainer}
            activeOpacity={1}
            onPress={() => setShowFullScreenPicture(false)}
          >
            <Image
              source={{ uri: user.profile_picture_url }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
            <View style={styles.fullScreenCloseButton}>
              <IconButton
                icon="close"
                onPress={() => setShowFullScreenPicture(false)}
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                iconColor="#FFFFFF"
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
    gap: space.lg,
  },
  loadingStack: {
    gap: space.lg,
  },
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
  ambientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
  ambientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
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
  card: {
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    textAlign: 'center',
  },
  big3Container: {
    flexDirection: 'row',
    marginTop: space.xs,
    gap: space.sm,
  },
  big3Item: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
  },
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
  liftsList: {
    gap: space.sm,
  },
  liftRowInteractive: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
  },
  liftRowLeft: {
    flex: 1,
    gap: space.xs,
  },
  liftChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContainer: {
    marginTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
  },
  chartLoading: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noHistoryContainer: {
    paddingVertical: space.section,
    alignItems: 'center',
    gap: space.sm,
  },
  noHistoryText: {
    textAlign: 'center',
  },
  workoutsList: {
    gap: space.sm,
  },
  workoutRowInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingLeft: space.lg,
    paddingRight: space.md,
    borderRadius: radius.card,
  },
  workoutRowContent: {
    flex: 1,
    gap: space.xs,
  },
  workoutRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutTitle: {
    flex: 1,
  },
  workoutChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: space.md,
  },
  workoutExercisesExpanded: {
    marginTop: -4,
    marginBottom: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  workoutExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  workoutExerciseLeft: {
    flex: 1,
    gap: space.xs,
  },
  workoutExerciseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  prBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  prBadgeText: {
    color: '#000',
  },
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  comparisonSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: space.sm,
    marginBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  comparisonColumnHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 56,
  },
  comparisonList: {
    gap: space.sm,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  comparisonValuePill: {
    width: 56,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.badge,
    alignItems: 'center',
  },
  comparisonMiddle: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: space.xs,
  },
  comparisonExercise: {
    textAlign: 'center',
  },
  comparisonDiff: {
    marginTop: space.xs,
  },
  comparisonFooter: {
    textAlign: 'center',
    marginTop: space.md,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    marginTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  comparisonChips: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  comparisonChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
