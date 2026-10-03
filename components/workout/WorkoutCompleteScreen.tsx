// Post-workout celebration. The hero is a shareable recap card (ViewShot →
// system share sheet): brand, session title + stats, top lift, PRs, and the
// lifter's overall standing. Below it: the career-style percentile progression
// this session earned, plus any unlocked achievements.
// White-alpha palette throughout is a named exception — this screen is always
// dark regardless of theme.
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space } from '@/lib/ui/tokens';
import { type } from '@/lib/ui/typography';
import { getStrengthTier } from '@/lib/data/strengthStandards';
import CareerModal from '@/components/gamification/CareerModal';
import { BurstGlow, RisingEmbers } from '@/components/workout/workoutComplete/CelebrationEffects';
import ProgressionSection, { PercentileMove } from '@/components/workout/workoutComplete/ProgressionSection';
import RewardsSection from '@/components/workout/workoutComplete/RewardsSection';
import ShareActionBar from '@/components/workout/workoutComplete/ShareActionBar';
import ShareCard, { ShareModeToggle } from '@/components/workout/workoutComplete/ShareCard';
import { useSessionPRs } from '@/components/workout/workoutComplete/useSessionPRs';
import { useShareCard } from '@/components/workout/workoutComplete/useShareCard';
import { SessionRewards } from '@/lib/gamification/sessionRewards';
import {
  buildCardVariants,
  buildWinsLine,
  findLiftSpotlight,
  formatVolumeDisplay,
  pickSpotlightAchievement,
} from '@/lib/gamification/sessionShareCard';
import { ParsedExercise, ParsedExerciseSummary } from '@/lib/workout/workoutTextParser';
import { UserProfile, UserProgress, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import playHapticFeedback from '@/lib/utils/haptic';

export type { PercentileMove };

interface WorkoutCompleteScreenProps {
  stats: {
    exercises: number;
    sets: number;
    durationStr: string;
    volume?: number; // lbs
  };
  exercises: (ParsedExercise | ParsedExerciseSummary)[];
  userLifts: UserProgress[];
  userProfile: UserProfile | null;
  weightUnit: WeightUnit;
  onDone: () => void;
  isSmallScreen?: boolean;
  rewards?: SessionRewards | null;
  // Generated title of the just-saved session ("Push Day"); null until it lands.
  title?: string | null;
  // Overall strength percentile before → after this session.
  percentileMove?: PercentileMove | null;
}

export default function WorkoutCompleteScreen({
  stats,
  exercises,
  userLifts,
  userProfile,
  weightUnit,
  onDone,
  isSmallScreen = false,
  rewards,
  title,
  percentileMove,
}: WorkoutCompleteScreenProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  const prs = useSessionPRs({ rewards, exercises, userLifts, userProfile });

  // The single-lift brag: the highest-percentile featured lift trained this
  // session ("stronger than 85% of Bench Press lifters") — the share moment.
  const liftSpotlight = useMemo(
    () => findLiftSpotlight(exercises, userLifts, weightUnit),
    [exercises, userLifts, weightUnit],
  );

  // "2 PRs · 1 achievement unlocked" — the session's wins, or nothing at all.
  const winsLine = useMemo(
    () => buildWinsLine(prs.length, rewards?.newAchievements.length ?? 0),
    [prs, rewards],
  );

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const volumeDisplay = formatVolumeDisplay(stats.volume, weightUnit);
  const overallAfter = percentileMove?.after ?? 0;
  const overallTier = overallAfter > 0 ? getStrengthTier(overallAfter) : null;

  // The rarest achievement earned this session fronts the achievement card.
  const spotlightAchievement = useMemo(
    () => pickSpotlightAchievement(rewards?.newAchievements ?? []),
    [rewards],
  );

  // Card layouts on offer — tap the card to flip through them:
  // identity, lift brag, PR haul, achievement unlock, and the session's workload.
  const cardVariants = useMemo(
    () =>
      buildCardVariants({
        lift: !!liftSpotlight,
        prs: prs.length > 0,
        achievement: !!spotlightAchievement,
        volume: !!volumeDisplay,
      }),
    [liftSpotlight, prs, spotlightAchievement, volumeDisplay],
  );

  const share = useShareCard({
    cardVariants,
    liftSpotlight,
    overallTier,
    overallAfter,
    volumeDisplay,
    weightUnit,
  });

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      <BurstGlow />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + space.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, isSmallScreen && styles.contentSmall]}>
          <Animated.Text
            entering={FadeIn.delay(150)}
            style={[styles.title, !winsLine && styles.titleSolo]}
          >
            Workout Complete
          </Animated.Text>
          {winsLine && (
            <Animated.Text entering={FadeIn.delay(250)} style={styles.subtitle}>
              {winsLine}
            </Animated.Text>
          )}

          {/* ---- Shareable recap card ---- */}
          <ShareCard
            shareRef={share.shareRef}
            shareMode={share.shareMode}
            cardVariants={cardVariants}
            cardIndex={share.cardIndex}
            flipStyle={share.flipStyle}
            onFlip={share.flipCard}
            dateStr={dateStr}
            activeVariant={share.activeVariant}
            liftSpotlight={liftSpotlight}
            prs={prs}
            spotlightAchievement={spotlightAchievement}
            volumeDisplay={volumeDisplay}
            overallTier={overallTier}
            overallAfter={overallAfter}
            stats={stats}
            title={title}
            weightUnit={weightUnit}
          />

          <ShareModeToggle shareMode={share.shareMode} onChange={share.setShareMode} />

          {percentileMove && percentileMove.after > 0 && <ProgressionSection move={percentileMove} />}

          {rewards?.hasRewards && <RewardsSection rewards={rewards} />}

          <Animated.View entering={FadeIn.delay(550)} style={styles.viewAllWrap}>
            <TouchableOpacity
              style={[styles.viewAllButton, { borderColor: 'rgba(255,255,255,0.18)' }]}
              onPress={() => {
                playHapticFeedback('light', false);
                setShowAllAchievements(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="trophy-outline" size={16} color="#fff" />
              <Text variant="meta" weight="semiBold" style={styles.viewAllText}>
                View all achievements
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Above the content so the rise is visible; pointerEvents none in style
          keeps them from swallowing taps while they float. */}
      <RisingEmbers />

      <ShareActionBar
        paddingBottom={Math.max(insets.bottom, space.lg)}
        copied={share.copied}
        saved={share.saved}
        onInstagram={share.handleInstagram}
        onPost={share.handlePost}
        onCopy={share.handleCopy}
        onSave={share.handleSave}
        onDone={onDone}
      />

      <CareerModal visible={showAllAchievements} onClose={() => setShowAllAchievements(false)} />
    </Animated.View>
  );
}

// White-alpha palette is a named exception (screen is always dark); 28/32/36 rhythm is structural.
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  content: {
    paddingHorizontal: space.section,
    paddingBottom: 40,
  },
  contentSmall: {
    paddingHorizontal: space.lg,
  },
  title: {
    fontSize: type.statHero,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: space.sm,
  },
  titleSolo: {
    marginBottom: space.section,
  },
  subtitle: {
    fontSize: type.body,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: space.section,
  },
  viewAllWrap: {
    width: '100%',
  },
  // White-alpha border is the dark-screen palette exception.
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  viewAllText: {
    color: '#fff',
  },
});
