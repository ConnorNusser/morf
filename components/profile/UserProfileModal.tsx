import IconButton from '@/components/IconButton';
import InteractiveProgressChart from '@/components/InteractiveProgressChart';
import SkeletonCard from '@/components/SkeletonCard';
import StrengthRadarCard from '@/components/StrengthRadarCard';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getCountryName } from '@/lib/services/geoService';
import { gap, layout } from '@/lib/ui/styles';
import { supabase } from '@/lib/services/supabase';
import { userSyncService, WorkoutSummary } from '@/lib/services/userSyncService';
import { getWorkoutById } from '@/lib/workout/workouts';
import { RemoteUser, RemoteUserData, MAIN_LIFTS, UserPercentileData, UserProgress } from '@/types';
import { usePauseVideosWhileOpen } from '@/contexts/VideoPlayerContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
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

const BIG_3 = [MAIN_LIFTS.BENCH_PRESS, MAIN_LIFTS.SQUAT, MAIN_LIFTS.DEADLIFT];

// Format relative time (e.g., "2d ago", "1w ago")
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString();
};

// Format duration (e.g., "45min", "1h 15min")
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}min`;
};

export default function UserProfileModal({ visible, onClose, user }: UserProfileModalProps) {
  const { currentTheme } = useTheme();
  usePauseVideosWhileOpen(visible);
  const [lifts, setLifts] = useState<UserLiftData[]>([]);
  const [userData, setUserData] = useState<RemoteUserData | null>(null);
  const [percentileData, setPercentileData] = useState<UserPercentileData | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
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

    // Toggle off if same lift selected
    if (selectedLiftId === exerciseId) {
      setSelectedLiftId(null);
      setLiftHistory([]);
      return;
    }

    setSelectedLiftId(exerciseId);
    setIsLoadingHistory(true);

    try {
      const history = await userSyncService.getUserLiftHistory(user.id, exerciseId);

      // Convert to UserProgress format for InteractiveProgressChart
      const progressData: UserProgress[] = history.map(lift => ({
        workoutId: exerciseId,
        personalRecord: lift.estimated_1rm,
        lastUpdated: lift.recorded_at,
        percentileRanking: 0, // Not needed for chart display
        strengthLevel: '',    // Not needed for chart display
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
      // Get user data including profile info, percentile data, and workouts
      const [liftsResult, userResult, percentileResult, workoutsResult] = await Promise.all([
        supabase
          .from('user_best_lifts')
          .select('exercise_id, estimated_1rm, recorded_at')
          .eq('user_id', user.id),
        supabase
          .from('users')
          .select('user_data, country_code')
          .eq('id', user.id)
          .single(),
        userSyncService.getUserPercentileData(user.id),
        userSyncService.getUserWorkouts(user.id, 5)
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
        // Update user with country code
        if (userResult.data.country_code && user) {
          user.country_code = userResult.data.country_code;
        }
      } else {
        setUserData(null);
      }

      // Set percentile data
      setPercentileData(percentileResult);

      // Set recent workouts
      setRecentWorkouts(workoutsResult);
    } catch (error) {
      console.error('Error loading user data:', error);
      setLifts([]);
      setUserData(null);
      setPercentileData(null);
      setRecentWorkouts([]);
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

  if (!user) return null;

  // Calculate stats
  const getBig3Lift = (exerciseId: string) => {
    const lift = lifts.find(l => l.exercise_id === exerciseId);
    return lift ? Math.round(lift.estimated_1rm) : 0;
  };

  const benchMax = getBig3Lift(MAIN_LIFTS.BENCH_PRESS);
  const squatMax = getBig3Lift(MAIN_LIFTS.SQUAT);
  const deadliftMax = getBig3Lift(MAIN_LIFTS.DEADLIFT);
  const big3Total = benchMax + squatMax + deadliftMax;
  const thousandPoundProgress = Math.min(100, Math.round((big3Total / 1000) * 100));

  // Calculate total volume (sum of all 1RMs as a rough proxy)
  const totalVolume = lifts.reduce((sum, lift) => sum + lift.estimated_1rm, 0);

  // Get overall percentile from synced data
  const overallPercentile = percentileData?.overall_percentile ?? null;

  // Get top lifts (excluding Big 3)
  const otherLifts = lifts
    .filter(l => !BIG_3.includes(l.exercise_id as typeof MAIN_LIFTS.BENCH_PRESS))
    .filter(l => getWorkoutById(l.exercise_id) !== null)
    .sort((a, b) => b.estimated_1rm - a.estimated_1rm)
    .slice(0, 5);

  const getExerciseName = (id: string) => {
    const workout = getWorkoutById(id);
    return workout?.name || id;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <IconButton icon="chevron-back" onPress={onClose} />
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            Profile
          </Text>
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
                <Text style={[
                  styles.friendButtonText,
                  { color: isFriend ? currentTheme.colors.text : '#FFFFFF' }
                ]}>
                  {isFriend ? 'Friends' : 'Add'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={layout.flex1} contentContainerStyle={styles.scrollContent}>
          {isLoading ? (
            <View style={gap.gap16}>
              <SkeletonCard variant="profile-header" />
              <SkeletonCard variant="stats" />
              <SkeletonCard variant="stats" />
            </View>
          ) : (
            <>
              {/* User Info */}
              <View style={styles.userHeader}>
                <View style={styles.userInfoLeft}>
                  <Text style={[styles.username, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    @{user.username}
                  </Text>
                  {user.country_code && (
                    <Text style={[styles.countryName, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                      {getCountryName(user.country_code)}
                    </Text>
                  )}
                  {/* Social Links */}
                  {(userData?.instagram_username || userData?.tiktok_username) && (
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
                          style={[styles.socialButton, { backgroundColor: currentTheme.colors.text + '10' }]}
                          onPress={() => Linking.openURL(`https://tiktok.com/@${userData.tiktok_username}`)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="logo-tiktok" size={18} color={currentTheme.colors.text} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
                {user.profile_picture_url ? (
                  <TouchableOpacity
                    onPress={() => setShowFullScreenPicture(true)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: user.profile_picture_url }}
                      style={styles.avatarImage}
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.avatar, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                    <Text style={[styles.avatarText, { color: currentTheme.colors.primary }]}>
                      {user.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Strength Radar */}
              {percentileData && overallPercentile !== null && (
                <StrengthRadarCard
                  overallPercentile={Math.round(overallPercentile)}
                  muscleGroups={percentileData.muscle_groups}
                  topContributions={percentileData.top_contributions}
                />
              )}

              {/* 1000lb Club Progress */}
              <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                <View style={[styles.cardHeader, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.cardTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    1000lb Club
                  </Text>
                  <Text style={[styles.cardValue, { color: currentTheme.colors.primary, fontFamily: 'Raleway_700Bold' }]}>
                    {big3Total} lbs
                  </Text>
                </View>

                <View style={[styles.progressBarContainer, { backgroundColor: currentTheme.colors.border }]}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        backgroundColor: thousandPoundProgress >= 100 ? '#22C55E' : currentTheme.colors.primary,
                        width: `${thousandPoundProgress}%`
                      }
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                  {thousandPoundProgress >= 100 ? 'Member!' : `${thousandPoundProgress}% to 1000lbs`}
                </Text>

                {/* Big 3 Breakdown */}
                <View style={styles.big3Container}>
                  <TouchableOpacity
                    style={[
                      styles.big3Item,
                      {
                        backgroundColor: selectedLiftId === MAIN_LIFTS.BENCH_PRESS ? currentTheme.colors.primary + '15' : currentTheme.colors.background,
                        borderColor: selectedLiftId === MAIN_LIFTS.BENCH_PRESS ? currentTheme.colors.primary : currentTheme.colors.border,
                      }
                    ]}
                    onPress={() => benchMax ? loadLiftHistory(MAIN_LIFTS.BENCH_PRESS) : null}
                    activeOpacity={benchMax ? 0.7 : 1}
                    disabled={!benchMax}
                  >
                    <Text style={[styles.big3Label, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
                      Bench
                    </Text>
                    <Text style={[styles.big3Value, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      {benchMax || '-'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.big3Item,
                      {
                        backgroundColor: selectedLiftId === MAIN_LIFTS.SQUAT ? currentTheme.colors.primary + '15' : currentTheme.colors.background,
                        borderColor: selectedLiftId === MAIN_LIFTS.SQUAT ? currentTheme.colors.primary : currentTheme.colors.border,
                      }
                    ]}
                    onPress={() => squatMax ? loadLiftHistory(MAIN_LIFTS.SQUAT) : null}
                    activeOpacity={squatMax ? 0.7 : 1}
                    disabled={!squatMax}
                  >
                    <Text style={[styles.big3Label, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
                      Squat
                    </Text>
                    <Text style={[styles.big3Value, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      {squatMax || '-'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.big3Item,
                      {
                        backgroundColor: selectedLiftId === MAIN_LIFTS.DEADLIFT ? currentTheme.colors.primary + '15' : currentTheme.colors.background,
                        borderColor: selectedLiftId === MAIN_LIFTS.DEADLIFT ? currentTheme.colors.primary : currentTheme.colors.border,
                      }
                    ]}
                    onPress={() => deadliftMax ? loadLiftHistory(MAIN_LIFTS.DEADLIFT) : null}
                    activeOpacity={deadliftMax ? 0.7 : 1}
                    disabled={!deadliftMax}
                  >
                    <Text style={[styles.big3Label, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
                      Deadlift
                    </Text>
                    <Text style={[styles.big3Value, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      {deadliftMax || '-'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Big 3 Progression Chart */}
                {selectedLiftId && BIG_3.includes(selectedLiftId as typeof MAIN_LIFTS.BENCH_PRESS) && (
                  <View style={styles.chartContainer}>
                    {isLoadingHistory ? (
                      <View style={styles.chartLoading}>
                        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                      </View>
                    ) : liftHistory.length >= 2 ? (
                      <InteractiveProgressChart
                        data={liftHistory}
                        selectedMetric="oneRM"
                        weightUnit="lbs"
                        title={`${getExerciseName(selectedLiftId)} Progression`}
                        description="Tap points to see exact values"
                      />
                    ) : (
                      <View style={styles.noHistoryContainer}>
                        <Ionicons name="trending-up-outline" size={24} color={currentTheme.colors.text + '40'} />
                        <Text style={[styles.noHistoryText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                          Not enough data for progression chart
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Stats Card */}
              <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                <Text style={[styles.cardTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                  Stats
                </Text>
                <View style={styles.statsGrid}>
                  <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.statValue, { color: currentTheme.colors.primary, fontFamily: 'Raleway_700Bold' }]}>
                      {lifts.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
                      Exercises
                    </Text>
                  </View>
                  <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.statValue, { color: currentTheme.colors.primary, fontFamily: 'Raleway_700Bold' }]}>
                      {Math.round(totalVolume).toLocaleString()}
                    </Text>
                    <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
                      Total 1RM lbs
                    </Text>
                  </View>
                </View>
              </View>

              {/* Other Top Lifts */}
              {otherLifts.length > 0 && (
                <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                  <Text style={[styles.cardTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    Top Lifts
                  </Text>
                  <View style={styles.liftsList}>
                    {otherLifts.map((lift, index) => {
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
                            <Text style={[styles.liftName, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                              {getExerciseName(lift.exercise_id)}
                            </Text>
                            <Text style={[styles.liftValue, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_600SemiBold' }]}>
                              {Math.round(lift.estimated_1rm)} lbs
                            </Text>
                          </View>
                          <View style={[styles.liftChevron, { backgroundColor: isSelected ? currentTheme.colors.primary + '20' : currentTheme.colors.border + '50' }]}>
                            <Ionicons
                              name={isSelected ? 'chevron-up' : 'chevron-forward'}
                              size={16}
                              color={isSelected ? currentTheme.colors.primary : currentTheme.colors.text + '60'}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Progression Chart for selected lift (only for non-Big3 lifts) */}
                  {selectedLiftId && !BIG_3.includes(selectedLiftId as typeof MAIN_LIFTS.BENCH_PRESS) && (
                    <View style={styles.chartContainer}>
                      {isLoadingHistory ? (
                        <View style={styles.chartLoading}>
                          <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                        </View>
                      ) : liftHistory.length >= 2 ? (
                        <InteractiveProgressChart
                          data={liftHistory}
                          selectedMetric="oneRM"
                          weightUnit="lbs"
                          title={`${getExerciseName(selectedLiftId)} Progression`}
                          description="Tap points to see exact values"
                        />
                      ) : (
                        <View style={styles.noHistoryContainer}>
                          <Ionicons name="trending-up-outline" size={24} color={currentTheme.colors.text + '40'} />
                          <Text style={[styles.noHistoryText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                            Not enough data for progression chart
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Recent Workouts */}
              {recentWorkouts.length > 0 && (
                <View style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}>
                  <Text style={[styles.cardTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
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
                                <Text style={[styles.workoutTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                                  {workout.title}
                                </Text>
                                <Text style={[styles.workoutTime, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                                  {formatRelativeTime(workout.created_at)}
                                </Text>
                              </View>
                              <Text style={[styles.workoutStats, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_400Regular' }]}>
                                {workout.exercise_count} exercises · {formatDuration(workout.duration_seconds)} · {workout.total_volume.toLocaleString()} lbs
                              </Text>
                            </View>
                            <View style={[styles.workoutChevron, { backgroundColor: isExpanded ? currentTheme.colors.primary + '20' : currentTheme.colors.border + '50' }]}>
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color={isExpanded ? currentTheme.colors.primary : currentTheme.colors.text + '60'}
                              />
                            </View>
                          </TouchableOpacity>

                          {/* Expanded exercise details */}
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
                                    <Text style={[styles.workoutExerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                                      {exercise.name}
                                    </Text>
                                    <Text style={[styles.workoutExerciseSets, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                                      {exercise.sets} sets
                                    </Text>
                                  </View>
                                  <View style={styles.workoutExerciseRight}>
                                    <Text style={[styles.workoutExerciseBest, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_600SemiBold' }]}>
                                      {exercise.bestSet}
                                    </Text>
                                    {exercise.isPR && (
                                      <View style={[styles.prBadge, { backgroundColor: '#FFD700' }]}>
                                        <Text style={styles.prBadgeText}>PR</Text>
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
                <View style={styles.emptyState}>
                  <Ionicons name="barbell-outline" size={32} color={currentTheme.colors.text + '30'} />
                  <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                    No lift data available yet
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Full Screen Profile Picture Modal */}
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
                variant="surface"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                iconColor="#FFFFFF"
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  userInfoLeft: {
    flex: 1,
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginLeft: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
  },
  username: {
    fontSize: 20,
  },
  countryName: {
    fontSize: 14,
  },
  socialLinksRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  socialButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: -4,
  },
  cardValue: {
    fontSize: 18,
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
    fontSize: 13,
    textAlign: 'center',
  },
  big3Container: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 8,
  },
  big3Item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  big3Label: {
    fontSize: 12,
  },
  big3Value: {
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
  },
  statLabel: {
    fontSize: 12,
  },
  liftsList: {
    gap: 8,
  },
  liftRowInteractive: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  liftRowLeft: {
    flex: 1,
    gap: 2,
  },
  liftName: {
    fontSize: 14,
  },
  liftValue: {
    fontSize: 13,
  },
  liftChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContainer: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 8,
  },
  chartLoading: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noHistoryContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  noHistoryText: {
    fontSize: 13,
    textAlign: 'center',
  },
  workoutsList: {
    gap: 8,
  },
  workoutRowInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 10,
  },
  workoutRowContent: {
    flex: 1,
    gap: 4,
  },
  workoutRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutTitle: {
    fontSize: 15,
    flex: 1,
  },
  workoutTime: {
    fontSize: 12,
  },
  workoutStats: {
    fontSize: 12,
  },
  workoutChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  workoutExercisesExpanded: {
    marginTop: -4,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  workoutExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  workoutExerciseLeft: {
    flex: 1,
    gap: 2,
  },
  workoutExerciseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workoutExerciseName: {
    fontSize: 14,
  },
  workoutExerciseSets: {
    fontSize: 12,
  },
  workoutExerciseBest: {
    fontSize: 14,
  },
  prBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  prBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  friendButtonText: {
    fontSize: 14,
    fontFamily: 'Raleway_500Medium',
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
});
