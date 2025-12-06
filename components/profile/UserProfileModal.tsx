import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import StrengthRadarCard from '@/components/StrengthRadarCard';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getCountryName } from '@/lib/geoService';
import { supabase } from '@/lib/supabase';
import { userSyncService } from '@/lib/userSyncService';
import { getWorkoutById } from '@/lib/workouts';
import { RemoteUser, RemoteUserData, MAIN_LIFTS, UserPercentileData } from '@/types';
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

export default function UserProfileModal({ visible, onClose, user }: UserProfileModalProps) {
  const { currentTheme } = useTheme();
  const [lifts, setLifts] = useState<UserLiftData[]>([]);
  const [userData, setUserData] = useState<RemoteUserData | null>(null);
  const [percentileData, setPercentileData] = useState<UserPercentileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [isFriendLoading, setIsFriendLoading] = useState(false);
  const [showFullScreenPicture, setShowFullScreenPicture] = useState(false);

  const checkFriendStatus = useCallback(async () => {
    if (!user) return;
    const friendStatus = await userSyncService.isFriend(user.id);
    setIsFriend(friendStatus);
  }, [user]);

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
      // Get user data including profile info and percentile data
      const [liftsResult, userResult, percentileResult] = await Promise.all([
        supabase
          .from('user_best_lifts')
          .select('exercise_id, estimated_1rm, recorded_at')
          .eq('user_id', user.id),
        supabase
          .from('users')
          .select('user_data, country_code')
          .eq('id', user.id)
          .single(),
        userSyncService.getUserPercentileData(user.id)
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
    } catch (error) {
      console.error('Error loading user data:', error);
      setLifts([]);
      setUserData(null);
      setPercentileData(null);
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

  // Get overall percentile and strength level from synced data
  const overallPercentile = percentileData?.overall_percentile ?? null;
  const strengthLevel = percentileData?.strength_level ?? null;

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
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
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

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {isLoading ? (
            <View style={{ gap: 16 }}>
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
                  strengthLevel={strengthLevel || 'F'}
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
                  <View style={[styles.big3Item, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.big3Label, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
                      Bench
                    </Text>
                    <Text style={[styles.big3Value, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      {benchMax || '-'}
                    </Text>
                  </View>
                  <View style={[styles.big3Divider, { backgroundColor: currentTheme.colors.border }]} />
                  <View style={[styles.big3Item, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.big3Label, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
                      Squat
                    </Text>
                    <Text style={[styles.big3Value, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      {squatMax || '-'}
                    </Text>
                  </View>
                  <View style={[styles.big3Divider, { backgroundColor: currentTheme.colors.border }]} />
                  <View style={[styles.big3Item, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.big3Label, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
                      Deadlift
                    </Text>
                    <Text style={[styles.big3Value, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      {deadliftMax || '-'}
                    </Text>
                  </View>
                </View>
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
                    {otherLifts.map((lift) => (
                      <View key={lift.exercise_id} style={[styles.liftRow, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.liftName, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                          {getExerciseName(lift.exercise_id)}
                        </Text>
                        <Text style={[styles.liftValue, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_600SemiBold' }]}>
                          {Math.round(lift.estimated_1rm)} lbs
                        </Text>
                      </View>
                    ))}
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
  scrollView: {
    flex: 1,
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
  },
  big3Item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  big3Label: {
    fontSize: 12,
  },
  big3Value: {
    fontSize: 16,
  },
  big3Divider: {
    width: 1,
    height: '100%',
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
    gap: 10,
  },
  liftRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liftName: {
    fontSize: 14,
    flex: 1,
  },
  liftValue: {
    fontSize: 14,
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
