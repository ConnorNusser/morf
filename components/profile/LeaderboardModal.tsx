import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { getCountryFlag, geoService } from '@/lib/geoService';
import { getTierColor, StrengthTier } from '@/lib/strengthStandards';
import { supabase } from '@/lib/supabase';
import { userSyncService } from '@/lib/userSyncService';
import { getWorkoutById } from '@/lib/workouts';
import { LeaderboardEntry, MAIN_LIFTS, OverallLeaderboardEntry, RemoteUser } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import UserProfileModal from './UserProfileModal';

// Big 3 exercises to feature prominently
const BIG_3_EXERCISES: string[] = [
  MAIN_LIFTS.BENCH_PRESS,
  MAIN_LIFTS.SQUAT,
  MAIN_LIFTS.DEADLIFT,
];

type LeaderboardFilter = 'friends' | 'country' | 'global';

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LeaderboardModal({ visible, onClose }: LeaderboardModalProps) {
  const { currentTheme } = useTheme();
  const { userProfile } = useUser();
  const [filter, setFilter] = useState<LeaderboardFilter>('global');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string | null>('overall');
  const [showExerciseDropdown, setShowExerciseDropdown] = useState(false);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [overallLeaderboardData, setOverallLeaderboardData] = useState<OverallLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFriends, setHasFriends] = useState(false);
  const [availableExercises, setAvailableExercises] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Check if "Overall" is selected
  const isOverallSelected = selectedExercise === 'overall';

  // Get all exercise IDs that the user has tracked (excluding custom exercises)
  const getTrackedExerciseIds = useCallback(() => {
    if (!userProfile) return ['overall', ...BIG_3_EXERCISES];
    const allLifts = [...(userProfile.lifts || []), ...(userProfile.secondaryLifts || [])];
    // Filter out custom exercises (those not found in built-in workouts)
    const uniqueIds = [...new Set(
      allLifts
        .filter(lift => getWorkoutById(lift.id) !== null)
        .map(lift => lift.id)
    )];
    // Always include Big 3 even if not tracked
    BIG_3_EXERCISES.forEach(id => {
      if (!uniqueIds.includes(id)) uniqueIds.unshift(id);
    });
    // Add "Overall" as the first option
    return ['overall', ...uniqueIds];
  }, [userProfile]);

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

      // Set default exercise if not set
      if (!selectedExercise && exerciseIds.length > 0) {
        setSelectedExercise(exerciseIds[0]);
      }

      // Handle "Overall" leaderboard
      if (selectedExercise === 'overall') {
        try {
          if (filter === 'friends') {
            const data = await userSyncService.getFriendsOverallLeaderboard();
            setOverallLeaderboardData(data);
          } else {
            const countryFilter = filter === 'country' ? myCountry : null;
            const data = await userSyncService.getOverallLeaderboard(countryFilter);
            setOverallLeaderboardData(data);
          }
          setLeaderboardData([]);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Clear overall data when not selected
      setOverallLeaderboardData([]);

      const exercisesToQuery = selectedExercise ? [selectedExercise] : exerciseIds.filter(id => id !== 'overall');

      if (filter === 'friends') {
        const data = await userSyncService.getLeaderboard(exercisesToQuery);
        setLeaderboardData(data);
      } else if (filter === 'country' || filter === 'global') {
        if (!supabase) {
          setLeaderboardData([]);
          return;
        }

        // For country filter, use user's country; for global, no country filter
        const countryFilter = filter === 'country' ? myCountry : null;

        // Build query with optional country filter
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

  // Sort entries by 1RM
  const sortedEntries = [...leaderboardData]
    .filter(e => !selectedExercise || e.exercise_id === selectedExercise)
    .sort((a, b) => (b.estimated_1rm || 0) - (a.estimated_1rm || 0));

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
    return (
      <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: currentTheme.colors.surface }]}>
        <Ionicons name="person" size={size * 0.6} color={currentTheme.colors.text + '40'} />
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
        <Text style={[
          styles.rankText,
          {
            color: isTop3 ? currentTheme.colors.primary : currentTheme.colors.text + '60',
            fontFamily: 'Raleway_600SemiBold',
          }
        ]}>
          {index + 1}
        </Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <IconButton icon="chevron-back" onPress={onClose} />
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            Leaderboard
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Filters Row */}
        <View style={[styles.filtersRow, { backgroundColor: 'transparent' }]}>
          {/* Exercise Dropdown */}
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: currentTheme.colors.surface }]}
              onPress={() => {
                setShowExerciseDropdown(!showExerciseDropdown);
                setShowFilterDropdown(false);
              }}
            >
              <Text
                style={[styles.dropdownText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}
                numberOfLines={1}
              >
                {selectedExercise ? getExerciseName(selectedExercise) : 'All Exercises'}
              </Text>
              <Ionicons
                name={showExerciseDropdown ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={currentTheme.colors.text + '80'}
              />
            </TouchableOpacity>

            {showExerciseDropdown && (
              <View style={[styles.dropdownMenu, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  {availableExercises.map((exerciseId) => {
                    const isBig3 = BIG_3_EXERCISES.includes(exerciseId);
                    return (
                      <TouchableOpacity
                        key={exerciseId}
                        style={[
                          styles.dropdownItem,
                          selectedExercise === exerciseId && { backgroundColor: currentTheme.colors.primary + '15' }
                        ]}
                        onPress={() => {
                          setSelectedExercise(exerciseId);
                          setShowExerciseDropdown(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          {
                            color: selectedExercise === exerciseId ? currentTheme.colors.primary : currentTheme.colors.text,
                            fontFamily: 'Raleway_500Medium',
                          }
                        ]}>
                          {getExerciseName(exerciseId)}
                        </Text>
                        {isBig3 && (
                          <View style={[styles.big3Dot, { backgroundColor: currentTheme.colors.primary }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Filter Dropdown (Friends/Global) */}
          <View style={styles.filterDropdownContainer}>
            <TouchableOpacity
              style={[styles.filterDropdown, { backgroundColor: currentTheme.colors.surface }]}
              onPress={() => {
                setShowFilterDropdown(!showFilterDropdown);
                setShowExerciseDropdown(false);
              }}
            >
              {filter === 'country' && userCountry ? (
                <Text style={{ fontSize: 14 }}>{getCountryFlag(userCountry)}</Text>
              ) : (
                <Ionicons
                  name={filter === 'friends' ? 'people' : 'globe-outline'}
                  size={14}
                  color={currentTheme.colors.primary}
                />
              )}
              <Text style={[styles.filterDropdownText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                {filter === 'friends' ? 'Friends' : filter === 'country' ? 'Country' : 'Global'}
              </Text>
              <Ionicons
                name={showFilterDropdown ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={currentTheme.colors.text + '80'}
              />
            </TouchableOpacity>

            {showFilterDropdown && (
              <View style={[styles.filterDropdownMenu, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    filter === 'friends' && { backgroundColor: currentTheme.colors.primary + '15' }
                  ]}
                  onPress={() => {
                    setFilter('friends');
                    setShowFilterDropdown(false);
                  }}
                >
                  <Ionicons name="people" size={14} color={filter === 'friends' ? currentTheme.colors.primary : currentTheme.colors.text + '80'} />
                  <Text style={[
                    styles.dropdownItemText,
                    {
                      color: filter === 'friends' ? currentTheme.colors.primary : currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    Friends
                  </Text>
                </TouchableOpacity>
                {userCountry && (
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      filter === 'country' && { backgroundColor: currentTheme.colors.primary + '15' }
                    ]}
                    onPress={() => {
                      setFilter('country');
                      setShowFilterDropdown(false);
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{getCountryFlag(userCountry)}</Text>
                    <Text style={[
                      styles.dropdownItemText,
                      {
                        color: filter === 'country' ? currentTheme.colors.primary : currentTheme.colors.text,
                        fontFamily: 'Raleway_500Medium',
                      }
                    ]}>
                      Country
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    filter === 'global' && { backgroundColor: currentTheme.colors.primary + '15' }
                  ]}
                  onPress={() => {
                    setFilter('global');
                    setShowFilterDropdown(false);
                  }}
                >
                  <Ionicons name="globe-outline" size={14} color={filter === 'global' ? currentTheme.colors.primary : currentTheme.colors.text + '80'} />
                  <Text style={[
                    styles.dropdownItemText,
                    {
                      color: filter === 'global' ? currentTheme.colors.primary : currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    Global
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        </View>

        {/* Content */}
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
            // Overall Strength Leaderboard
            overallLeaderboardData.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name={filter === 'friends' ? 'people-outline' : filter === 'country' ? 'flag-outline' : 'trophy-outline'}
                  size={32}
                  color={currentTheme.colors.text + '30'}
                />
                <Text style={[styles.emptyTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                  {filter === 'friends' && !hasFriends ? 'No friends yet' : 'No overall data yet'}
                </Text>
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
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
                    <View style={[styles.userInfo, { backgroundColor: 'transparent' }]}>
                      <View style={styles.usernameRow}>
                        <Text style={[
                          styles.username,
                          {
                            color: currentTheme.colors.text,
                            fontFamily: index === 0 ? 'Raleway_600SemiBold' : 'Raleway_500Medium',
                          }
                        ]}>
                          {entry.user.username}
                        </Text>
                        {entry.user.country_code && (
                          <Text style={styles.entryFlag}>{getCountryFlag(entry.user.country_code)}</Text>
                        )}
                      </View>
                      <Text style={[styles.strengthLevel, {
                        color: getTierColor(entry.strength_level as StrengthTier),
                        fontFamily: 'Raleway_600SemiBold'
                      }]}>
                        {entry.strength_level} Tier
                      </Text>
                    </View>
                    <Text style={[
                      styles.liftValue,
                      {
                        color: index === 0 ? currentTheme.colors.primary : currentTheme.colors.text,
                        fontFamily: 'Raleway_600SemiBold',
                      }
                    ]}>
                      {Math.round(entry.overall_percentile)}
                      <Text style={[styles.liftUnit, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
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
                color={currentTheme.colors.text + '30'}
              />
              <Text style={[styles.emptyTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                {filter === 'friends' && !hasFriends ? 'No friends yet' : filter === 'country' ? 'No lifters in your country yet' : 'No entries yet'}
              </Text>
              <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
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
                  <View style={[styles.userInfo, { backgroundColor: 'transparent' }]}>
                    <View style={styles.usernameRow}>
                      <Text style={[
                        styles.username,
                        {
                          color: currentTheme.colors.text,
                          fontFamily: index === 0 ? 'Raleway_600SemiBold' : 'Raleway_500Medium',
                        }
                      ]}>
                        {entry.user.username}
                      </Text>
                      {entry.user.country_code && (
                        <Text style={styles.entryFlag}>{getCountryFlag(entry.user.country_code)}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={[
                    styles.liftValue,
                    {
                      color: index === 0 ? currentTheme.colors.primary : currentTheme.colors.text,
                      fontFamily: 'Raleway_600SemiBold',
                    }
                  ]}>
                    {Math.round(entry.estimated_1rm)}
                    <Text style={[styles.liftUnit, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                      {' '}lbs
                    </Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* User Profile Modal */}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  dropdownText: {
    fontSize: 14,
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 46,
    left: 0,
    right: 0,
    borderRadius: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownItemText: {
    fontSize: 14,
    flex: 1,
  },
  big3Dot: {
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  filterDropdownText: {
    fontSize: 13,
  },
  filterDropdownMenu: {
    position: 'absolute',
    top: 46,
    right: 0,
    minWidth: 130,
    borderRadius: 10,
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  leaderboardList: {
    gap: 2,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 12,
    marginHorizontal: -8,
  },
  topEntry: {
    borderRadius: 12,
    marginBottom: 8,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 13,
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryFlag: {
    fontSize: 14,
  },
  username: {
    fontSize: 15,
  },
  strengthLevel: {
    fontSize: 12,
    marginTop: 2,
  },
  liftValue: {
    fontSize: 16,
  },
  liftUnit: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
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
