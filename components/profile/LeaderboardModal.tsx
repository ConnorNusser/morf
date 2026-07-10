import Chip from '@/components/Chip';
import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import TierBadge from '@/components/TierBadge';
import { Text, useInk, View } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor, StrengthTier, StrengthTierBase, TIER_COLORS } from '@/lib/data/strengthStandards';
import {
  cutoffDateISO,
  gapToAhead,
  groupByTierBand,
  liftMovement,
  percentileAsOf,
} from '@/lib/gamification/leaderboardInsights';
import { getCountryFlag, geoService } from '@/lib/services/geoService';
import { supabase } from '@/lib/services/supabase';
import { userSyncService } from '@/lib/services/userSyncService';
import { storageService } from '@/lib/storage/storage';
import { radius, screenGutter, space, tint, track, trend } from '@/lib/ui/tokens';
import { getWorkoutById } from '@/lib/workout/workouts';
import { LeaderboardEntry, MAIN_LIFTS, RemoteUser } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import UserProfileModal from './UserProfileModal';

const FEATURED_EXERCISES: string[] = [
  MAIN_LIFTS.BENCH_PRESS,
  MAIN_LIFTS.SQUAT,
  MAIN_LIFTS.DEADLIFT,
  MAIN_LIFTS.OVERHEAD_PRESS,
  'hip-thrust-barbell',
];

// Window for the ▲/▼ movement indicators (rank, 1RM, percentile).
const DELTA_DAYS = 90;

type LeaderboardFilter = 'friends' | 'country' | 'global';

/** Both board types normalized to one renderable row. */
interface BoardRow {
  user: RemoteUser;
  /** estimated 1RM (lift boards) or overall percentile. */
  value: number;
  tier?: StrengthTier;
  /** 90-day change in `value`; null = no data old enough. */
  delta: number | null;
  /** 90-day rank movement (global lift boards only — the one scope where history covers everyone). */
  rankDelta: number | null;
}

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LeaderboardModal({ visible, onClose }: LeaderboardModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [filter, setFilter] = useState<LeaderboardFilter>('global');
  const [selectedExercise, setSelectedExercise] = useState<string>('overall');
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFriends, setHasFriends] = useState(false);
  const [availableExercises, setAvailableExercises] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [myUser, setMyUser] = useState<RemoteUser | null>(null);
  // Own standing fetched separately so the You bar works below the top 50.
  const [myStanding, setMyStanding] = useState<{ rank: number; value: number } | null>(null);
  // Exercise ids the user has a record for (drives the exercise chip list).
  const [trackedRecordIds, setTrackedRecordIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible) storageService.getExerciseRecords().then(r => setTrackedRecordIds(Object.keys(r)));
  }, [visible]);

  const isOverallSelected = selectedExercise === 'overall';

  const getTrackedExerciseIds = useCallback(() => {
    const trackedIds = new Set(trackedRecordIds.filter(id => getWorkoutById(id) !== null));

    const orderedIds: string[] = [...FEATURED_EXERCISES];

    trackedIds.forEach(id => {
      if (!FEATURED_EXERCISES.includes(id)) {
        orderedIds.push(id);
      }
    });

    return ['overall', ...orderedIds];
  }, [trackedRecordIds]);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [friends, myCountry, me] = await Promise.all([
        userSyncService.getFriends(),
        geoService.getStoredCountryCode(),
        userSyncService.getCurrentUser(),
      ]);
      setHasFriends(friends.length > 0);
      setUserCountry(myCountry);
      setMyUser(me);
      setAvailableExercises(getTrackedExerciseIds());

      const countryFilter = filter === 'country' ? myCountry : null;
      const now = new Date();
      const cutoffDate = cutoffDateISO(now, DELTA_DAYS);
      const cutoffIso = new Date(now.getTime() - DELTA_DAYS * 24 * 60 * 60 * 1000).toISOString();

      if (isOverallSelected) {
        const data = filter === 'friends'
          ? await userSyncService.getFriendsOverallLeaderboard()
          : await userSyncService.getOverallLeaderboard(countryFilter);

        const sorted = [...data].sort((a, b) => b.overall_percentile - a.overall_percentile);
        const [histories, standing] = await Promise.all([
          userSyncService.getPercentileHistories(sorted.map(e => e.user.id)),
          filter === 'friends' ? null : userSyncService.getMyOverallStanding(countryFilter),
        ]);

        setRows(sorted.map(entry => {
          const asOf = percentileAsOf(histories[entry.user.id], cutoffDate);
          return {
            user: entry.user,
            value: Math.round(entry.overall_percentile),
            tier: entry.strength_level as StrengthTier | undefined,
            delta: asOf == null ? null : Math.round(entry.overall_percentile) - asOf,
            rankDelta: null,
          };
        }));
        setMyStanding(standing ? { rank: standing.rank, value: Math.round(standing.percentile) } : null);
        return;
      }

      let entries: LeaderboardEntry[] = [];
      if (filter === 'friends') {
        entries = await userSyncService.getLeaderboard([selectedExercise]);
      } else if (supabase) {
        let query = supabase
          .from('exercise_leaderboard')
          .select('*')
          .eq('exercise_id', selectedExercise)
          .order('estimated_1rm', { ascending: false })
          .limit(50);

        if (countryFilter) {
          query = query.eq('country_code', countryFilter);
        }

        const { data, error } = await query;
        if (error) {
          console.error('Error loading global leaderboard:', error);
        } else {
          entries = (data || []).map((row: {
            user_id: string;
            username: string;
            country_code?: string;
            profile_picture_url?: string;
            exercise_id: string;
            estimated_1rm: number;
            recorded_at: string;
            rank: number;
            strength_tier?: string;
          }) => ({
            user: {
              id: row.user_id,
              device_id: '',
              username: row.username,
              country_code: row.country_code,
              profile_picture_url: row.profile_picture_url,
            },
            exercise_id: row.exercise_id,
            estimated_1rm: row.estimated_1rm,
            weight: 0,
            reps: 0,
            recorded_at: new Date(row.recorded_at),
            rank: row.rank,
            strength_tier: row.strength_tier,
          }));
        }
      }

      const sorted = [...entries].sort((a, b) => (b.estimated_1rm || 0) - (a.estimated_1rm || 0));
      const [oldRows, standing] = await Promise.all([
        userSyncService.getLiftRowsAsOf(selectedExercise, cutoffIso),
        filter === 'friends' ? null : userSyncService.getMyLiftStanding(selectedExercise, countryFilter),
      ]);

      // Rank movement is only meaningful when the visible board covers the same
      // population as the history (global). Country/friends still get 1RM deltas.
      const movement = liftMovement(
        sorted.map((e, i) => ({
          userId: e.user.id,
          oneRm: e.estimated_1rm,
          rank: filter === 'global' ? i + 1 : undefined,
        })),
        oldRows,
      );

      setRows(sorted.map(entry => {
        const m = movement[entry.user.id];
        const rmDelta = m?.rmDelta == null ? null : Math.round(m.rmDelta);
        return {
          user: entry.user,
          value: Math.round(entry.estimated_1rm),
          tier: entry.strength_tier as StrengthTier | undefined,
          delta: rmDelta,
          rankDelta: m?.rankDelta ?? null,
        };
      }));
      setMyStanding(standing ? { rank: standing.rank, value: Math.round(standing.oneRm) } : null);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter, selectedExercise, isOverallSelected, getTrackedExerciseIds]);

  useEffect(() => {
    if (visible) {
      loadLeaderboard();
    }
  }, [visible, loadLeaderboard]);

  const getExerciseName = (id: string) => {
    if (id === 'overall') return 'Overall';
    const workout = getWorkoutById(id);
    return workout?.name || id;
  };

  const handleUserPress = (user: RemoteUser) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const scopeTabs = useMemo(() => {
    const tabs: { key: LeaderboardFilter; label: string }[] = [
      { key: 'global', label: 'Global' },
    ];
    if (userCountry) tabs.push({ key: 'country', label: `${getCountryFlag(userCountry)} Country` });
    tabs.push({ key: 'friends', label: 'Friends' });
    return tabs;
  }, [userCountry]);

  // Tier bands only make sense where the sort follows tier (the percentile
  // board). Lift boards sort by absolute 1RM while tiers are bodyweight-
  // relative, so there the tier shows per-row instead.
  const bands = useMemo(
    () => (isOverallSelected ? groupByTierBand(rows, r => r.tier) : null),
    [rows, isOverallSelected],
  );
  const maxValue = rows[0]?.value || 0;
  const unitSuffix = isOverallSelected ? '%' : ' lbs';

  // The viewer's line at the bottom: in-list position wins (it knows who's ahead);
  // the fetched standing covers ranks below the visible top 50.
  const you = useMemo(() => {
    if (!myUser) return null;
    const index = rows.findIndex(r => r.user.id === myUser.id);
    if (index >= 0) {
      const gap = gapToAhead(rows, index, r => r.value);
      return {
        rank: index + 1,
        value: rows[index].value,
        gap,
        aheadName: index > 0 ? rows[index - 1].user.username : null,
      };
    }
    if (myStanding) {
      return { rank: myStanding.rank, value: myStanding.value, gap: null, aheadName: null };
    }
    return null;
  }, [rows, myUser, myStanding]);

  const renderAvatar = (user: RemoteUser, size: number) => {
    if (user.profile_picture_url) {
      return (
        <Image
          source={{ uri: user.profile_picture_url }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      );
    }
    const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
    return (
      <RNView
        style={[
          styles.avatarPlaceholder,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: tint(currentTheme.colors.primary) },
        ]}
      >
        <Text variant="meta" weight="semiBold">{initial}</Text>
      </RNView>
    );
  };

  const renderMovement = (delta: number | null) => {
    if (delta == null || delta === 0) return null;
    const up = delta > 0;
    return (
      <Text variant="meta" weight="semiBold" style={{ color: up ? trend.up : trend.down }}>
        {up ? '▲' : '▼'} {Math.abs(delta)}
      </Text>
    );
  };

  const renderRow = (row: BoardRow, globalIndex: number) => {
    const tierColor = row.tier ? getTierColor(row.tier) : currentTheme.colors.primary;
    const isHero = globalIndex === 0;
    const isYou = myUser != null && row.user.id === myUser.id;
    const barPct = maxValue > 0 ? Math.max(4, Math.round((row.value / maxValue) * 100)) : 0;

    return (
      <Animated.View
        key={`${filter}-${selectedExercise}-${row.user.id}`}
        entering={FadeInDown.duration(220).delay(Math.min(globalIndex, 12) * 35)}
      >
        <TouchableOpacity
          style={[styles.entryRow, isHero && styles.heroRow]}
          onPress={() => handleUserPress(row.user)}
          activeOpacity={0.7}
        >
          {isHero ? (
            // One deliberate moment for the leader: a tier-colored wash, nothing louder.
            <LinearGradient
              colors={[tint(tierColor), 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, styles.rowRound]}
            />
          ) : (
            // Faint bar scaled to the leader's number gives the column shape at a glance.
            <RNView
              pointerEvents="none"
              style={[styles.relativeBar, styles.rowRound, { width: `${barPct}%`, backgroundColor: ink.hairline }]}
            />
          )}

          <RNView style={styles.rankCell}>
            <Text variant={isHero ? 'emphasis' : 'body'} weight={globalIndex < 3 ? 'semiBold' : 'regular'} tone={globalIndex < 3 ? 'primary' : 'muted'}>
              {globalIndex + 1}
            </Text>
            {row.rankDelta != null && row.rankDelta !== 0 && (
              <Text variant="meta" weight="semiBold" style={{ color: row.rankDelta > 0 ? trend.up : trend.down }}>
                {row.rankDelta > 0 ? '▲' : '▼'}{Math.abs(row.rankDelta)}
              </Text>
            )}
          </RNView>

          {renderAvatar(row.user, isHero ? 44 : 32)}

          <RNView style={styles.userInfo}>
            <RNView style={styles.usernameRow}>
              <Text variant="body" weight={isHero || isYou ? 'semiBold' : 'medium'} tone="primary" numberOfLines={1} style={styles.usernameText}>
                {row.user.username}
              </Text>
              {!isOverallSelected && row.tier && (
                <TierBadge tier={row.tier} size="tiny" bordered={false} showTooltip={false} />
              )}
              {row.user.country_code && (
                <Text variant="meta">{getCountryFlag(row.user.country_code)}</Text>
              )}
              {isYou && (
                <Text variant="meta" tone="faint">you</Text>
              )}
            </RNView>
          </RNView>

          <RNView style={styles.valueCell}>
            <Text variant={isHero ? 'emphasis' : 'body'} weight={isHero ? 'semiBold' : 'medium'} tone="primary">
              {row.value}
              <Text variant="meta" weight="regular" tone="muted">{unitSuffix}</Text>
            </Text>
            {renderMovement(row.delta)}
          </RNView>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderBandHeader = (tier: StrengthTierBase) => {
    const color = TIER_COLORS[tier];
    return (
      <RNView style={styles.bandHeader}>
        <RNView style={[styles.bandRule, { backgroundColor: color }]} />
        <Text variant="meta" weight="semiBold" style={[styles.bandLabel, { color }]}>
          {tier} TIER
        </Text>
        <RNView style={[styles.bandRuleFill, { backgroundColor: ink.hairline }]} />
      </RNView>
    );
  };

  const renderEmpty = () => (
    <EmptyState
      icon={filter === 'friends' ? 'people-outline' : filter === 'country' ? 'flag-outline' : 'trophy-outline'}
      title={filter === 'friends' && !hasFriends ? 'No friends yet' : 'No entries yet'}
      subtitle={
        filter === 'friends' && !hasFriends
          ? 'Add friends from your profile to compare strength'
          : filter === 'country'
          ? 'Be the first to post a lift from your country'
          : 'Complete workouts to appear on the leaderboard'
      }
    />
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={styles.headerSpacer} />
          <Text variant="emphasis" weight="semiBold" tone="primary">
            Leaderboard
          </Text>
          <IconButton icon="close" onPress={onClose} />
        </View>

        <View style={styles.controls}>
          <SegmentedTabs tabs={scopeTabs} active={filter} onChange={setFilter} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {availableExercises.map(exerciseId => (
              <Chip
                key={exerciseId}
                label={getExerciseName(exerciseId)}
                selected={selectedExercise === exerciseId}
                onPress={() => setSelectedExercise(exerciseId)}
                size="small"
              />
            ))}
          </ScrollView>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {isLoading ? (
            <View style={styles.leaderboardList}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <SkeletonCard key={i} variant="leaderboard-row" />
              ))}
            </View>
          ) : rows.length === 0 ? (
            renderEmpty()
          ) : (
            <View style={styles.leaderboardList}>
              {bands
                ? bands.map(band => (
                    <React.Fragment key={`${band.tier ?? 'untiered'}-${band.startIndex}`}>
                      {band.tier != null && renderBandHeader(band.tier)}
                      {band.entries.map((row, i) => renderRow(row, band.startIndex + i))}
                    </React.Fragment>
                  ))
                : rows.map((row, i) => renderRow(row, i))}
            </View>
          )}
        </ScrollView>

        {you && !isLoading && (
          <TouchableOpacity
            style={[styles.youBar, { backgroundColor: currentTheme.colors.surface, borderTopColor: currentTheme.colors.border }]}
            onPress={() => myUser && handleUserPress(myUser)}
            activeOpacity={0.8}
          >
            <Text variant="body" weight="semiBold" tone="primary" style={styles.youRank}>
              #{you.rank}
            </Text>
            {myUser && renderAvatar(myUser, 28)}
            <RNView style={styles.userInfo}>
              <Text variant="body" weight="semiBold" tone="primary">You</Text>
              {you.rank === 1 ? (
                <Text variant="meta" tone="secondary">Top of the board</Text>
              ) : you.gap != null && you.aheadName ? (
                <Text variant="meta" tone="secondary" numberOfLines={1}>
                  {`+${Math.max(1, Math.ceil(you.gap))}${unitSuffix} to pass @${you.aheadName}`}
                </Text>
              ) : null}
            </RNView>
            <Text variant="body" weight="semiBold" tone="primary">
              {you.value}
              <Text variant="meta" weight="regular" tone="muted">{unitSuffix}</Text>
            </Text>
          </TouchableOpacity>
        )}

        <UserProfileModal
          visible={showUserProfile}
          onClose={() => setShowUserProfile(false)}
          user={selectedUser}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: {
    width: 40,
  },
  controls: {
    paddingHorizontal: screenGutter,
    paddingTop: space.lg,
    gap: space.lg,
  },
  chipRow: {
    gap: space.sm,
    paddingBottom: space.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.sm,
    paddingBottom: space.section,
  },
  leaderboardList: {
    gap: space.xs,
  },
  bandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  bandRule: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  bandRuleFill: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  bandLabel: {
    letterSpacing: track.caps,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
    overflow: 'hidden',
  },
  heroRow: {
    paddingVertical: space.lg,
  },
  rowRound: {
    borderRadius: radius.card,
  },
  relativeBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  rankCell: {
    width: 36,
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  usernameText: {
    flexShrink: 1,
  },
  valueCell: {
    alignItems: 'flex-end',
  },
  youBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  youRank: {
    minWidth: 36,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
