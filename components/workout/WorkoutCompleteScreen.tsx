import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { getExerciseBadgeInfo } from '@/components/workout/ExerciseBadge';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { getWorkoutById } from '@/lib/workout/workouts';
import { convertWeightToLbs } from '@/lib/utils/utils';
import { ParsedExercise, ParsedExerciseSummary } from '@/lib/workout/workoutNoteParser';
import { UserProfile, UserProgress, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// PR info for celebration
interface PRInfo {
  exerciseName: string;
  exerciseId?: string;
  newPR: number;
  previousPR: number;
  improvement: number;
  percentile?: number;
}

interface WorkoutCompleteScreenProps {
  stats: {
    exercises: number;
    sets: number;
    volume: number;
    durationStr: string;
  };
  exercises: (ParsedExercise | ParsedExerciseSummary)[];
  userLifts: UserProgress[];
  userProfile: UserProfile | null;
  weightUnit: WeightUnit;
  templateSaved: boolean;
  onSaveAsTemplate: () => void;
  onDone: () => void;
  isSmallScreen?: boolean;
}

// Confetti particle
const Particle = ({ delay, startX, color }: { delay: number; startX: number; color: string }) => {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(startX);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 8 }));
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT + 100, { duration: 3000, easing: Easing.out(Easing.quad) })
    );
    const drift = (Math.random() - 0.5) * 100;
    translateX.value = withDelay(delay, withTiming(startX + drift, { duration: 3000 }));
    rotate.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 1000 }), -1, false)
    );
    opacity.value = withDelay(delay + 2000, withTiming(0, { duration: 1000 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Animation runs once on mount
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.particle, { backgroundColor: color }, animatedStyle]} />
  );
};

// Pulsing badge for PR header
const PulsingBadge = ({ text, color }: { text: string; color: string }) => {
  const { currentTheme } = useTheme();
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    opacity.value = withDelay(
      400,
      withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.prBadge, { backgroundColor: color }, animatedStyle]}>
      <Text style={[styles.prBadgeText, { fontFamily: currentTheme.fonts.bold }]}>
        {text}
      </Text>
    </Animated.View>
  );
};

// Animated counting number
const AnimatedCounter = ({
  value,
  suffix = '',
  duration = 1500,
  delay = 0,
  style,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  delay?: number;
  style?: any;
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    const updateDisplay = (val: number) => {
      setDisplayValue(Math.round(val));
    };

    animatedValue.value = withDelay(
      delay,
      withTiming(value, { duration, easing: Easing.out(Easing.cubic) }, () => {
        runOnJS(updateDisplay)(value);
      })
    );

    // Update display during animation
    const interval = setInterval(() => {
      const progress = (Date.now() - delay) / duration;
      if (progress >= 0 && progress <= 1) {
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(value * easedProgress));
      }
    }, 16);

    setTimeout(() => {
      clearInterval(interval);
      setDisplayValue(value);
    }, delay + duration + 100);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Text style={style}>
      {displayValue}{suffix}
    </Text>
  );
};

// Interactive stat card
const StatCard = ({
  icon,
  value,
  label,
  suffix = '',
  delay = 0,
  onPress,
  isSmallScreen,
  primaryColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  suffix?: string;
  delay?: number;
  onPress?: () => void;
  isSmallScreen?: boolean;
  primaryColor: string;
}) => {
  const scale = useSharedValue(1);
  const { currentTheme } = useTheme();

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const content = (
    <Animated.View
      style={[
        styles.statCard,
        { backgroundColor: 'rgba(255,255,255,0.1)' },
        isSmallScreen && styles.statCardSmall,
        animatedStyle,
      ]}
    >
      <Ionicons name={icon} size={isSmallScreen ? 20 : 24} color={primaryColor} />
      {typeof value === 'number' ? (
        <AnimatedCounter
          value={value}
          suffix={suffix}
          delay={delay}
          style={[
            styles.statCardValue,
            { color: '#fff', fontFamily: currentTheme.fonts.bold },
            isSmallScreen && styles.statCardValueSmall,
          ]}
        />
      ) : (
        <Text style={[
          styles.statCardValue,
          { color: '#fff', fontFamily: currentTheme.fonts.bold },
          isSmallScreen && styles.statCardValueSmall,
        ]}>
          {value}
        </Text>
      )}
      <Text style={[styles.statCardLabel, { color: 'rgba(255,255,255,0.6)', fontFamily: currentTheme.fonts.regular }]}>
        {label}
      </Text>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={1}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export default function WorkoutCompleteScreen({
  stats,
  exercises,
  userLifts,
  userProfile,
  weightUnit,
  templateSaved,
  onSaveAsTemplate,
  onDone,
  isSmallScreen = false,
}: WorkoutCompleteScreenProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showExerciseDetails, setShowExerciseDetails] = useState(false);

  // Simple scale animation for checkmark
  const checkScale = useSharedValue(0);

  // Generate confetti particles
  const particles = useMemo(() => {
    const colors = [
      currentTheme.colors.primary,
      currentTheme.colors.accent,
      '#FFD700',
      '#FF6B6B',
      '#4ECDC4',
      '#A78BFA',
    ];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      delay: Math.random() * 500,
      startX: Math.random() * SCREEN_WIDTH,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, [currentTheme]);

  // Detect PRs from exercises
  const prs = useMemo((): PRInfo[] => {
    const detectedPRs: PRInfo[] = [];
    const bodyWeightLbs = userProfile ? convertWeightToLbs(userProfile.weight.value, userProfile.weight.unit) : undefined;

    for (const exercise of exercises) {
      if (!exercise.matchedExerciseId || exercise.isCustom) continue;

      const sets = exercise.sets || [];
      if (sets.length === 0) continue;

      const badgeInfo = getExerciseBadgeInfo(
        exercise.matchedExerciseId,
        exercise.isCustom,
        sets,
        userLifts,
        bodyWeightLbs,
        userProfile?.gender
      );

      if (badgeInfo?.type === 'tier' && badgeInfo.isPR) {
        const exerciseInfo = getWorkoutById(exercise.matchedExerciseId);
        const userLift = userLifts.find(l => l.workoutId === exercise.matchedExerciseId);

        // Calculate best 1RM from this workout
        const best1RM = Math.max(
          ...sets.map(set => {
            if (set.reps === 0) return 0;
            return OneRMCalculator.estimate(set.weight, set.reps);
          }),
          0
        );

        const previousPR = userLift?.personalRecord || 0;
        const improvement = previousPR > 0 ? best1RM - previousPR : 0;

        detectedPRs.push({
          exerciseName: exerciseInfo?.name || exercise.name,
          exerciseId: exercise.matchedExerciseId,
          newPR: Math.round(best1RM),
          previousPR: Math.round(previousPR),
          improvement: Math.round(improvement),
          percentile: badgeInfo.percentile,
        });
      }
    }

    return detectedPRs;
  }, [exercises, userLifts, userProfile]);

  // Start celebration animation on mount
  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 12, stiffness: 100 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const handleStatPress = useCallback((type: 'exercises' | 'sets') => {
    setShowExerciseDetails(!showExerciseDetails);
  }, [showExerciseDetails]);

  return (
    <Animated.View entering={FadeIn} style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Confetti particles */}
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          delay={particle.delay}
          startX={particle.startX}
          color={particle.color}
        />
      ))}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Logo */}
          <Animated.View style={[styles.logoHeader, checkAnimatedStyle]}>
            <Image
              source={require('@/assets/images/icon-original.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={[styles.logoText, { color: 'rgba(255,255,255,0.4)', fontFamily: currentTheme.fonts.medium }]}>
              morf
            </Text>
          </Animated.View>

          <Animated.Text
            entering={FadeIn.delay(200)}
            style={[styles.title, { color: '#fff', fontFamily: currentTheme.fonts.bold }]}
          >
            Workout Complete!
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.delay(300)}
            style={[styles.subtitle, { color: 'rgba(255,255,255,0.6)', fontFamily: currentTheme.fonts.regular }]}
          >
            Great job crushing it today
          </Animated.Text>

          {/* PR Highlights Section */}
          {prs.length > 0 && (
            <View style={styles.prSection}>
              <View style={[styles.prBadge, { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}>
                <Text style={[styles.prBadgeText, { color: '#fff', fontFamily: currentTheme.fonts.bold }]}>
                  {prs.length === 1 ? 'NEW PR' : `${prs.length} NEW PRs`}
                </Text>
              </View>
              <Animated.View
                entering={FadeIn.delay(500)}
                style={[
                  styles.prCard,
                  {
                    backgroundColor: 'rgba(255,255,255,0.06)',
                  }
                ]}
              >
                {prs.map((pr, index) => (
                  <Animated.View
                    key={pr.exerciseId || index}
                    entering={FadeIn.delay(600 + index * 100)}
                    style={styles.prRow}
                  >
                    <View style={[styles.prCardContent, { backgroundColor: 'transparent' }]}>
                      <Text style={[styles.prExerciseName, { color: 'rgba(255,255,255,0.7)', fontFamily: currentTheme.fonts.regular }]}>
                        {pr.exerciseName}
                      </Text>
                      <View style={[styles.prValueRow, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.prValue, { color: '#fff', fontFamily: currentTheme.fonts.bold }]}>
                          {pr.newPR}
                        </Text>
                        <Text style={[styles.prUnit, { color: 'rgba(255,255,255,0.5)', fontFamily: currentTheme.fonts.regular }]}>
                          {weightUnit}
                        </Text>
                        {pr.improvement > 0 && (
                          <Text style={[styles.improvementText, { color: '#4ADE80', fontFamily: currentTheme.fonts.semiBold }]}>
                            ↑{pr.improvement}
                          </Text>
                        )}
                      </View>
                    </View>
                    {pr.percentile && (
                      <TierBadge percentile={pr.percentile} size="small" />
                    )}
                  </Animated.View>
                ))}
              </Animated.View>
            </View>
          )}

          {/* Interactive Stats */}
          <Animated.View entering={FadeIn.delay(500)} style={[styles.statsContainer, isSmallScreen && styles.statsContainerSmall]}>
            <StatCard
              icon="time-outline"
              value={stats.durationStr}
              label="Duration"
              delay={600}
              isSmallScreen={isSmallScreen}
              primaryColor={currentTheme.colors.primary}
            />
            <StatCard
              icon="barbell-outline"
              value={stats.exercises}
              label="Exercises"
              delay={700}
              onPress={() => handleStatPress('exercises')}
              isSmallScreen={isSmallScreen}
              primaryColor={currentTheme.colors.primary}
            />
            <StatCard
              icon="flame-outline"
              value={stats.sets}
              label="Sets"
              delay={800}
              onPress={() => handleStatPress('sets')}
              isSmallScreen={isSmallScreen}
              primaryColor={currentTheme.colors.primary}
            />
          </Animated.View>

          {/* Exercise Details (expandable) */}
          {showExerciseDetails && (
            <Animated.View entering={FadeIn} style={styles.exerciseDetailsContainer}>
              <Text style={[styles.exerciseDetailsTitle, { color: 'rgba(255,255,255,0.8)', fontFamily: currentTheme.fonts.semiBold }]}>
                Exercises
              </Text>
              {exercises.map((exercise, index) => {
                const exerciseInfo = exercise.matchedExerciseId
                  ? getWorkoutById(exercise.matchedExerciseId)
                  : null;
                const setCount = exercise.sets?.length || (exercise as ParsedExerciseSummary).setCount || 0;

                return (
                  <View
                    key={index}
                    style={[styles.exerciseDetailRow, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}
                  >
                    <Text style={[styles.exerciseDetailName, { color: '#fff', fontFamily: currentTheme.fonts.medium }]}>
                      {exerciseInfo?.name || exercise.name}
                    </Text>
                    <Text style={[styles.exerciseDetailSets, { color: 'rgba(255,255,255,0.6)', fontFamily: currentTheme.fonts.regular }]}>
                      {setCount} {setCount === 1 ? 'set' : 'sets'}
                    </Text>
                  </View>
                );
              })}
            </Animated.View>
          )}

        </View>
      </ScrollView>

      {/* Action buttons - pinned to bottom */}
      <Animated.View
        entering={FadeIn.delay(700)}
        style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        {/* Save as Template button */}
        <TouchableOpacity
          style={[
            styles.saveTemplateButton,
            {
              backgroundColor: templateSaved
                ? currentTheme.colors.accent + '20'
                : 'rgba(255,255,255,0.15)',
              borderColor: templateSaved
                ? currentTheme.colors.accent
                : 'rgba(255,255,255,0.3)',
            }
          ]}
          onPress={onSaveAsTemplate}
          activeOpacity={0.8}
          disabled={templateSaved}
        >
          <Ionicons
            name={templateSaved ? "checkmark-circle" : "bookmark-outline"}
            size={20}
            color={templateSaved ? currentTheme.colors.accent : '#fff'}
          />
          <Text style={[
            styles.saveTemplateButtonText,
            {
              color: templateSaved ? currentTheme.colors.accent : '#fff',
            }
          ]}>
            {templateSaved ? 'Saved to Templates' : 'Save as Template'}
          </Text>
        </TouchableOpacity>

        {/* Done button */}
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: currentTheme.colors.primary }]}
          onPress={onDone}
          activeOpacity={0.8}
        >
          <Text style={[styles.doneButtonText, { fontFamily: currentTheme.fonts.semiBold }]}>
            Done
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

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
    paddingTop: 60,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerLogo: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  logoText: {
    fontSize: 15,
    letterSpacing: 1,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 36,
  },
  // PR Section
  prSection: {
    width: '100%',
    marginBottom: 32,
    gap: 12,
  },
  prHeader: {
    alignItems: 'center',
  },
  prBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#C15F3C',
  },
  prBadgeText: {
    fontSize: 14,
    color: '#000',
    letterSpacing: 0.5,
  },
  prCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  prCardContent: {
    flex: 1,
    gap: 2,
  },
  prExerciseName: {
    fontSize: 14,
  },
  prValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prValue: {
    fontSize: 18,
  },
  prUnit: {
    fontSize: 14,
  },
  improvementText: {
    fontSize: 13,
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 36,
  },
  statsContainerSmall: {
    gap: 8,
  },
  statCard: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 90,
  },
  statCardSmall: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 75,
  },
  statCardValue: {
    fontSize: 24,
    marginTop: 8,
  },
  statCardValueSmall: {
    fontSize: 20,
    marginTop: 6,
  },
  statCardLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  // Exercise Details
  exerciseDetailsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  exerciseDetailsTitle: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  exerciseDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  exerciseDetailName: {
    fontSize: 14,
    flex: 1,
  },
  exerciseDetailSets: {
    fontSize: 13,
  },
  // Buttons
  buttonContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  saveTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  saveTemplateButtonText: {
    fontSize: 16,
  },
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 18,
    color: '#fff',
  },
  // Confetti
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
