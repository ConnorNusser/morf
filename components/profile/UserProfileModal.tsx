import AchievementModal, { AchievementModalItem } from '@/components/gamification/AchievementModal';
import AchievementShowcaseCard from '@/components/profile/userProfile/AchievementShowcaseCard';
import FullScreenPictureModal from '@/components/profile/userProfile/FullScreenPictureModal';
import LiftComparisonCard from '@/components/profile/userProfile/LiftComparisonCard';
import ProfileHeaderBar from '@/components/profile/userProfile/ProfileHeaderBar';
import ProfileIdentity from '@/components/profile/userProfile/ProfileIdentity';
import RecentWorkoutsCard from '@/components/profile/userProfile/RecentWorkoutsCard';
import StrengthJourneyCard from '@/components/profile/userProfile/StrengthJourneyCard';
import ThousandPoundCard from '@/components/profile/userProfile/ThousandPoundCard';
import TopLiftsCard from '@/components/profile/userProfile/TopLiftsCard';
import { useLiftHistory } from '@/components/profile/userProfile/useLiftHistory';
import { useUserProfileData } from '@/components/profile/userProfile/useUserProfileData';
import SkeletonCard from '@/components/SkeletonCard';
import StrengthRadarCard from '@/components/StrengthRadarCard';
import { View } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import StatStrip from '@/components/ui/StatStrip';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ComparisonMode,
  buildLiftComparison,
  overallStanding,
  percentileTrend,
  summarizeLifts,
  withContributionWeights,
} from '@/lib/gamification/userProfileInsights';
import { layout } from '@/lib/ui/styles';
import { space, screenGutter, tint } from '@/lib/ui/tokens';
import { RemoteUser } from '@/types';
import { usePauseVideosWhileOpen } from '@/contexts/VideoPlayerContext';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: RemoteUser | null;
}

// Ambient gradient alpha: the 12% tint() token reads too faint across a full
// sheet, so the top wash gets its own slightly deeper stop.
const wash = (color: string): string => color + '2E';

export default function UserProfileModal({ visible, onClose, user }: UserProfileModalProps) {
  const { currentTheme } = useTheme();
  usePauseVideosWhileOpen(visible);
  const {
    lifts,
    userData,
    percentileData,
    recentWorkouts,
    workoutCount,
    showcase,
    myLifts,
    myUserData,
    currentUserId,
    memberSince,
    isLoading,
    isFriend,
    isFriendLoading,
    handleToggleFriend,
  } = useUserProfileData(visible, user);
  const { selectedLiftId, liftHistory, isLoadingHistory, loadLiftHistory } = useLiftHistory(user);
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('weight');
  const [showAllComparisons, setShowAllComparisons] = useState(false);
  const [showFullScreenPicture, setShowFullScreenPicture] = useState(false);
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  // Must be before early return to maintain consistent hook order
  const enhancedTopContributions = useMemo(
    () => withContributionWeights(percentileData?.top_contributions, lifts),
    [percentileData?.top_contributions, lifts],
  );

  // Must be before early return to maintain consistent hook order
  const liftComparison = useMemo(
    () => buildLiftComparison({ currentUserId, userId: user?.id, myLifts, lifts, comparisonMode, myUserData, userData }),
    [currentUserId, user?.id, myLifts, lifts, comparisonMode, myUserData, userData],
  );

  // Derived lift stats, memoized so they don't recompute on unrelated state changes.
  const { benchMax, squatMax, deadliftMax, big3Total, thousandPoundProgress, totalVolume, otherLifts } = useMemo(
    () => summarizeLifts(lifts),
    [lifts],
  );

  if (!user) return null;

  const { overallPercentile, overallTier, tierColor } = overallStanding(percentileData);
  const { sparkHistory, sparkDelta, sparkSince } = percentileTrend(percentileData?.percentile_history);

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
        <ProfileHeaderBar
          onClose={onClose}
          showFriendButton={currentUserId !== user?.id}
          isFriend={isFriend}
          isFriendLoading={isFriendLoading}
          onToggleFriend={handleToggleFriend}
        />

        <ScrollView style={layout.flex1} contentContainerStyle={styles.scrollContent}>
          {isLoading ? (
            <View style={styles.loadingStack}>
              <SkeletonCard variant="profile-header" />
              <SkeletonCard variant="stats" />
              <SkeletonCard variant="stats" />
            </View>
          ) : (
            <>
              <ProfileIdentity
                user={user}
                userData={userData}
                overallTier={overallTier}
                tierColor={tierColor}
                recentWorkouts={recentWorkouts}
                memberSince={memberSince}
                onSpotlight={setSpotlight}
                onPressPicture={() => setShowFullScreenPicture(true)}
              />

              {percentileData && overallPercentile !== null && (
                <StrengthRadarCard
                  overallPercentile={Math.round(overallPercentile)}
                  muscleGroups={percentileData.muscle_groups}
                  topContributions={enhancedTopContributions}
                />
              )}

              {sparkHistory.length >= 2 && tierColor && (
                <StrengthJourneyCard
                  sparkHistory={sparkHistory}
                  sparkDelta={sparkDelta}
                  sparkSince={sparkSince}
                  tierColor={tierColor}
                />
              )}

              <ThousandPoundCard
                benchMax={benchMax}
                squatMax={squatMax}
                deadliftMax={deadliftMax}
                big3Total={big3Total}
                thousandPoundProgress={thousandPoundProgress}
                selectedLiftId={selectedLiftId}
                liftHistory={liftHistory}
                isLoadingHistory={isLoadingHistory}
                onSelectLift={loadLiftHistory}
              />

              <StatStrip
                items={[
                  { value: workoutCount, label: 'Workouts' },
                  { value: showcase?.totalPRs ?? 0, label: 'PRs' },
                  { value: lifts.length, label: 'Exercises' },
                  { value: Math.round(totalVolume).toLocaleString(), label: 'Total 1RM' },
                ]}
              />

              {liftComparison && (
                <LiftComparisonCard
                  username={user.username}
                  liftComparison={liftComparison}
                  comparisonMode={comparisonMode}
                  showAllComparisons={showAllComparisons}
                  onChangeMode={(mode) => { setComparisonMode(mode); setShowAllComparisons(false); }}
                  onToggleShowAll={() => setShowAllComparisons(!showAllComparisons)}
                />
              )}

              {showcase && showcase.rarest.length > 0 && (
                <AchievementShowcaseCard
                  username={user.username}
                  showcase={showcase}
                  onSpotlight={setSpotlight}
                />
              )}

              {otherLifts.length > 0 && (
                <TopLiftsCard
                  otherLifts={otherLifts}
                  selectedLiftId={selectedLiftId}
                  liftHistory={liftHistory}
                  isLoadingHistory={isLoadingHistory}
                  onSelectLift={loadLiftHistory}
                />
              )}

              {recentWorkouts.length > 0 && (
                <RecentWorkoutsCard
                  recentWorkouts={recentWorkouts}
                  expandedWorkoutId={expandedWorkoutId}
                  onToggleWorkout={setExpandedWorkoutId}
                />
              )}

              {lifts.length === 0 && (
                <EmptyState
                  art={require('@/assets/achievements/barbell.png')}
                  title="No lifts yet"
                  subtitle={`@${user.username} hasn't logged any tracked lifts.`}
                />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {user?.profile_picture_url && (
        <FullScreenPictureModal
          visible={showFullScreenPicture}
          uri={user.profile_picture_url}
          onClose={() => setShowFullScreenPicture(false)}
        />
      )}

      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
    gap: space.lg,
  },
  loadingStack: {
    gap: space.lg,
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
});
