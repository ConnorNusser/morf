import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import { Text, useInk, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { getCountryFlag, geoService } from '@/lib/services/geoService';
import { getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { supabase } from '@/lib/services/supabase';
import { storageService } from '@/lib/storage/storage';
import { userSyncService } from '@/lib/services/userSyncService';
import { getWorkoutById } from '@/lib/workout/workouts';
import { LeaderboardEntry, MAIN_LIFTS, OverallLeaderboardEntry, RemoteUser } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import UserProfileModal from './UserProfileModal';

const FEATURED_EXERCISES: string[] = [
  MAIN_LIFTS.BENCH_PRESS,
  MAIN_LIFTS.SQUAT,
  MAIN_LIFTS.DEADLIFT,
  MAIN_LIFTS.OVERHEAD_PRESS,
  'hip-thrust-barbell',
];

type LeaderboardFilter = 'friends' | 'country' | 'global';

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LeaderboardModal({ visible, onClose }: LeaderboardModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [filter, setFilter] = useState<LeaderboardFilter>('global');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string>('overall');
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [overallLeaderboardData, setOverallLeaderboardData] = useState<OverallLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFriends, setHasFriends] = useState(false);
  const [availableExercises, setAvailableExercises] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  // Exercise ids the user has a record for (drives the exercise filter list).
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
      const [friends, myCountry] = await Promise.all([
        userSyncService.getFriends(),
        geoService.getStoredCountryCode(),
      ]);
      setHasFriends(friends.length > 0);
      setUserCountry(myCountry);

      const exerciseIds = getTrackedExerciseIds();
      setAvailableExercises(exerciseIds);

      if (selectedExercise === 'overall') {
        if (filter === 'friends') {
          const data = await userSyncService.getFriendsOverallLeaderboard();
          setOverallLeaderboardData(data);
        } else {
          const countryFilter = filter === 'country' ? myCountry : null;
          const data = await userSyncService.getOverallLeaderboard(countryFilter);
          setOverallLeaderboardData(data);
        }
        setLeaderboardData([]);
        return;
      }

      setOverallLeaderboardData([]);

      const exercisesToQuery = [selectedExercise];

      if (filter === 'friends') {
        const data = await userSyncService.getLeaderboard(exercisesToQuery);
        setLeaderboardData(data);
      } else if (filter === 'country' || filter === 'global') {
        if (!supabase) {
          setLeaderboardData([]);
          return;
        }

        const countryFilter = filter === 'country' ? myCountry : null;

        let query = supabase
          .from('exercise_leaderboard')
          .select('*')
          .in('exercise_id', exercisesToQuery)
          .order('estimated_1rm', { ascending: false })
          .limit(50);

        if (countryFilter) {
          query = query.eq('country_code', countryFilter);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error loading global leaderboard:', error);
          setLeaderboardData([]);
          return;
        }

        const entries: LeaderboardEntry[] = (data || []).map((row: {
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

        setLeaderboardData(entries);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter, selectedExercise, getTrackedExerciseIds]);

  useEffect(() => {
    if (visible) {
      loadLeaderboard();
    }
  }, [visible, loadLeaderboard]);

  const sortedEntries = useMemo(() =>
    [...leaderboardData]
      .filter(e => e.exercise_id === selectedExercise)
      .sort((a, b) => (b.estimated_1rm || 0) - (a.estimated_1rm || 0)),
    [leaderboardData, selectedExercise]
  );

  const getExerciseName = (id: string) => {
    if (id === 'overall') return 'Overall Strength';
    const workout = getWorkoutById(id);
    return workout?.name || id;
  };

  const handleUserPress = (user: RemoteUser) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const renderAvatar = (user: RemoteUser, size: number = 32) => {
    if (user.profile_picture_url) {
      return (
        <Image
          source={{ uri: user.profile_picture_url }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        />
      );
    }
    const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
    return (
      <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint(currentTheme.colors.primary) }]}>
        <Text style={{ fontSize: size * 0.45 }}>
          {initial}
        </Text>
      </View>
    );
  };

  const closeAllDropdowns = () => {
    setShowExerciseDropdown(false);
    setShowFilterDropdown(false);
  };

  const renderRank = (index: number) => {
    const isTop3 = index < 3;
    return (
      <View style={[
        styles.rankBadge,
        {
          backgroundColor: isTop3
            ? currentTheme.colors.primary + (index === 0 ? '30' : index === 1 ? '20' : '15')
            : 'transparent',
        }
      ]}>
        <Text variant="meta" tone={isTop3 ? undefined : 'muted'}>
          {index + 1}
        </Text>
      </View>
    );
  };

  const renderTierBadge = (tier?: string) => {
    if (!tier) return null;
    // Base tier (first char) drives the color lookup
    const baseTier = tier.charAt(0) as StrengthTier;
    const color = getTierColor(baseTier);
    return (
      <View style={[styles.tierBadge, { backgroundColor: color + '20' }]}>
        <Text style={{ color }} variant="meta" weight="semiBold">
          {tier}
        </Text>
      </View>
    );
  };

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

        <View style={styles.filtersRow}>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: currentTheme.colors.surface }]}
              onPress={() => {
                setShowExerciseDropdown(!showExerciseDropdown);
                setShowFilterDropdown(false);
              }}
            >
              <Text
                style={styles.dropdownText}
                variant="meta"
                weight="medium"
                tone="primary"
                numberOfLines={1}
              >
                {getExerciseName(selectedExercise)}
              </Text>
              <Ionicons
                name={showExerciseDropdown ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={ink.secondary}
              />
            </TouchableOpacity>

            {showExerciseDropdown && (
              <View style={[styles.dropdownMenu, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  {availableExercises.map((exerciseId) => {
                    const isFeatured = FEATURED_EXERCISES.includes(exerciseId);
                    return (
                      <TouchableOpacity
                        key={exerciseId}
                        style={[
                          styles.dropdownItem,
                          selectedExercise === exerciseId && { backgroundColor: tint(currentTheme.colors.primary) }
                        ]}
                        onPress={() => {
                          setSelectedExercise(exerciseId);
                          setShowExerciseDropdown(false);
                        }}
                      >
                        <Text
                          style={styles.dropdownItemText}
                          variant="meta"
                          tone={selectedExercise === exerciseId ? undefined : 'primary'}
                        >
                          {getExerciseName(exerciseId)}
                        </Text>
                        {isFeatured && (
                          <View style={[styles.featuredDot, { backgroundColor: currentTheme.colors.primary }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.filterDropdownContainer}>
            <TouchableOpacity
              style={[styles.filterDropdown, { backgroundColor: currentTheme.colors.surface }]}
              onPress={() => {
                setShowFilterDropdown(!showFilterDropdown);
                setShowExerciseDropdown(false);
              }}
            >
              {filter === 'country' && userCountry ? (
                <Text variant="meta">{getCountryFlag(userCountry)}</Text>
              ) : (
                <Ionicons
                  name={filter === 'friends' ? 'people' : 'globe-outline'}
                  size={14}
                  color={currentTheme.colors.primary}
                />
              )}
              <Text variant="meta" weight="medium" tone="primary">
                {filter === 'friends' ? 'Friends' : filter === 'country' ? 'Country' : 'Global'}
              </Text>
              <Ionicons
                name={showFilterDropdown ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={ink.secondary}
              />
            </TouchableOpacity>

            {showFilterDropdown && (
              <View style={[styles.filterDropdownMenu, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    filter === 'friends' && { backgroundColor: tint(currentTheme.colors.primary) }
                  ]}
                  onPress={() => {
                    setFilter('friends');
                    setShowFilterDropdown(false);
                  }}
                >
                  <Ionicons name="people" size={14} color={filter === 'friends' ? currentTheme.colors.primary : ink.secondary} />
                  <Text
                    style={styles.dropdownItemText}
                    variant="meta"
                    tone={filter === 'friends' ? undefined : 'primary'}
                  >
                    Friends
                  </Text>
                </TouchableOpacity>
                {userCountry && (
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      filter === 'country' && { backgroundColor: tint(currentTheme.colors.primary) }
                    ]}
                    onPress={() => {
                      setFilter('country');
                      setShowFilterDropdown(false);
                    }}
                  >
                    <Text variant="meta">{getCountryFlag(userCountry)}</Text>
                    <Text
                      style={styles.dropdownItemText}
                      variant="meta"
                      tone={filter === 'country' ? undefined : 'primary'}
                    >
                      Country
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    filter === 'global' && { backgroundColor: tint(currentTheme.colors.primary) }
                  ]}
                  onPress={() => {
                    setFilter('global');
                    setShowFilterDropdown(false);
                  }}
                >
                  <Ionicons name="globe-outline" size={14} color={filter === 'global' ? currentTheme.colors.primary : ink.secondary} />
                  <Text
                    style={styles.dropdownItemText}
                    variant="meta"
                    tone={filter === 'global' ? undefined : 'primary'}
                  >
                    Global
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          onScrollBeginDrag={closeAllDropdowns}
        >
          {isLoading ? (
            <View style={styles.leaderboardList}>
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonCard key={i} variant="leaderboard-row" />
              ))}
            </View>
          ) : isOverallSelected ? (
            overallLeaderboardData.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name={filter === 'friends' ? 'people-outline' : filter === 'country' ? 'flag-outline' : 'trophy-outline'}
                  size={32}
                  color={ink.ghost}
                />
                <Text style={styles.emptyTitle} variant="emphasis" weight="medium" tone="primary">
                  {filter === 'friends' && !hasFriends ? 'No friends yet' : 'No overall data yet'}
                </Text>
                <Text style={styles.emptyText} variant="meta" weight="regular" tone="faint">
                  {filter === 'friends' && !hasFriends
                    ? 'Add friends from your profile to compare strength'
                    : 'Users need to track workouts to appear here'}
                </Text>
              </View>
            ) : (
              <View style={styles.leaderboardList}>
                {overallLeaderboardData.map((entry, index) => (
                  <TouchableOpacity
                    key={`${entry.user.id}-${index}`}
                    style={[
                      styles.entryRow,
                      index === 0 && styles.topEntry,
                      { backgroundColor: index === 0 ? currentTheme.colors.surface : 'transparent' }
                    ]}
                    onPress={() => handleUserPress(entry.user)}
                    activeOpacity={0.7}
                  >
                    {renderRank(index)}
                    {renderAvatar(entry.user)}
                    <View style={styles.userInfo}>
                      <View style={styles.usernameRow}>
                        <Text
                          variant="body"
                          weight={index === 0 ? 'semiBold' : 'medium'}
                          tone="primary"
                        >
                          {entry.user.username}
                        </Text>
                        {entry.user.country_code && (
                          <Text variant="meta">{getCountryFlag(entry.user.country_code)}</Text>
                        )}
                      </View>
                      <Text
                        style={[styles.strengthLevel, { color: getTierColor(entry.strength_level as StrengthTier) }]}
                        variant="meta"
                        weight="semiBold"
                      >
                        {entry.strength_level} Tier
                      </Text>
                    </View>
                    <Text
                      variant="body"
                      tone={index === 0 ? undefined : 'primary'}
                    >
                      {Math.round(entry.overall_percentile)}
                      <Text variant="meta" weight="regular" tone="muted">
                        %
                      </Text>
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )
          ) : sortedEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={filter === 'friends' ? 'people-outline' : filter === 'country' ? 'flag-outline' : 'barbell-outline'}
                size={32}
                color={ink.ghost}
              />
              <Text style={styles.emptyTitle} variant="emphasis" weight="medium" tone="primary">
                {filter === 'friends' && !hasFriends ? 'No friends yet' : filter === 'country' ? 'No lifters in your country yet' : 'No entries yet'}
              </Text>
              <Text style={styles.emptyText} variant="meta" weight="regular" tone="faint">
                {filter === 'friends' && !hasFriends
                  ? 'Add friends from your profile to compare lifts'
                  : filter === 'country'
                  ? 'Be the first to post a lift from your country!'
                  : 'Complete workouts to appear on the leaderboard'}
              </Text>
            </View>
          ) : (
            <View style={styles.leaderboardList}>
              {sortedEntries.map((entry, index) => (
                <TouchableOpacity
                  key={`${entry.user.id}-${index}`}
                  style={[
                    styles.entryRow,
                    index === 0 && styles.topEntry,
                    { backgroundColor: index === 0 ? currentTheme.colors.surface : 'transparent' }
                  ]}
                  onPress={() => handleUserPress(entry.user)}
                  activeOpacity={0.7}
                >
                  {renderRank(index)}
                  {renderAvatar(entry.user)}
                  <View style={styles.userInfo}>
                    <View style={styles.usernameRow}>
                      {renderTierBadge(entry.strength_tier)}
                      <Text
                        variant="body"
                        weight={index === 0 ? 'semiBold' : 'medium'}
                        tone="primary"
                      >
                        {entry.user.username}
                      </Text>
                      {entry.user.country_code && (
                        <Text variant="meta">{getCountryFlag(entry.user.country_code)}</Text>
                      )}
                    </View>
                  </View>
                  <Text
                    variant="body"
                    tone={index === 0 ? undefined : 'primary'}
                  >
                    {Math.round(entry.estimated_1rm)}
                    <Text variant="meta" weight="regular" tone="muted">
                      {' '}lbs
                    </Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

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
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    gap: space.sm,
    zIndex: 100,
  },
  dropdownContainer: {
    flex: 1,
    zIndex: 101,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.control,
    gap: space.sm,
  },
  dropdownText: {
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  dropdownItemText: {
    flex: 1,
  },
  featuredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterDropdownContainer: {
    zIndex: 102,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.control,
    gap: space.sm,
  },
  filterDropdownMenu: {
    position: 'absolute',
    top: 46,
    right: 0,
    minWidth: 130,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.sm,
    paddingBottom: 40,
  },
  leaderboardList: {
    gap: space.xs,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    gap: space.md,
    marginHorizontal: -space.sm,
  },
  topEntry: {
    borderRadius: radius.card,
    marginBottom: space.sm,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  tierBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
  },
  strengthLevel: {
    marginTop: space.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: space.md,
  },
  emptyTitle: {
    marginTop: space.sm,
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  avatar: {
    backgroundColor: '#E5E5EA',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
