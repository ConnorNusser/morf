import Button from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { storageService } from '@/lib/storage';
import { ParsedWorkout, workoutNoteParser } from '@/lib/workoutNoteParser';
import { getWorkoutById } from '@/lib/workouts';
import { convertWeight, WeightUnit, WorkoutTemplate } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ModalState = 'parsing' | 'confirmation' | 'celebration';

interface WorkoutFinishModalProps {
  visible: boolean;
  noteText: string;
  duration: number; // in seconds
  weightUnit: WeightUnit;
  onSave: (parsedWorkout: ParsedWorkout) => Promise<void>;
  onCancel: () => void;
  onComplete: () => void;
}

// Static Morph logo
const Logo = () => (
  <Image
    source={require('@/assets/images/icon.png')}
    style={styles.logoImage}
    resizeMode="contain"
  />
);

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

const WorkoutFinishModal: React.FC<WorkoutFinishModalProps> = ({
  visible,
  noteText,
  duration,
  weightUnit,
  onSave,
  onCancel,
  onComplete,
}) => {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 380; // iPhone SE, iPhone 12/13 mini

  // Sound effects
  const { play: playSuccess } = useSound('selectionComplete');
  const { play: playTap } = useSound('tapVariant1');
  const { play: playUnlock } = useSound('unlock');

  const [modalState, setModalState] = useState<ModalState>('parsing');
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState(false);

  // Celebration animation values
  const checkScale = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

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

  // Parse workout when modal opens
  useEffect(() => {
    if (visible && noteText.trim()) {
      setModalState('parsing');
      setParsedWorkout(null);
      setError(null);
      setTemplateSaved(false);

      const parseWorkout = async () => {
        try {
          const parsed = await workoutNoteParser.parseWorkoutNote(noteText);
          setParsedWorkout(parsed);
          setModalState('confirmation');
        } catch (err) {
          console.error('Error parsing workout:', err);
          setError('Failed to parse workout. Please try again.');
        }
      };

      parseWorkout();
    }
  }, [visible, noteText]);

  // Start celebration animations
  const startCelebration = useCallback(() => {
    playUnlock();
    playHapticFeedback('medium', false);

    checkScale.value = 0;
    ringScale.value = 0;
    ringOpacity.value = 0;

    ringScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.5, { damping: 8 }),
      withTiming(2, { duration: 300 })
    );
    ringOpacity.value = withSequence(
      withTiming(0.8, { duration: 200 }),
      withDelay(200, withTiming(0, { duration: 300 }))
    );
    checkScale.value = withDelay(100, withSpring(1, { damping: 6, stiffness: 100 }));
    pulseScale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Animation runs once, sound hooks are stable
  }, [playUnlock]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!parsedWorkout) return;

    playHapticFeedback('light', false);
    setIsSaving(true);
    try {
      await onSave(parsedWorkout);
      setModalState('celebration');
      startCelebration();
    } catch (err) {
      console.error('Error saving workout:', err);
      setError('Failed to save workout. Please try again.');
      playHapticFeedback('error', false);
    } finally {
      setIsSaving(false);
    }
  }, [parsedWorkout, onSave, startCelebration]);

  // Handle cancel with haptic
  const handleCancel = useCallback(() => {
    playTap();
    playHapticFeedback('light', false);
    onCancel();
  }, [onCancel, playTap]);

  // Handle done with haptic
  const handleDone = useCallback(() => {
    playTap();
    playHapticFeedback('light', false);
    onComplete();
  }, [onComplete, playTap]);

  // Handle save as template
  const handleSaveAsTemplate = useCallback(async () => {
    if (templateSaved) return;

    playTap();
    playHapticFeedback('medium', false);

    // Generate a name based on date and exercises
    const date = new Date();
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const exerciseNames = parsedWorkout?.exercises.slice(0, 2).map(e => {
      const info = e.matchedExerciseId ? getWorkoutById(e.matchedExerciseId) : null;
      return info?.name || e.name;
    }).join(', ') || 'Workout';
    const suffix = (parsedWorkout?.exercises.length || 0) > 2 ? '...' : '';

    const template: WorkoutTemplate = {
      id: `template_${Date.now()}`,
      name: `${exerciseNames}${suffix} - ${dateStr}`,
      noteText: noteText,
      createdAt: new Date(),
    };

    try {
      await storageService.saveWorkoutTemplate(template);
      setTemplateSaved(true);
      playSuccess();
    } catch (err) {
      console.error('Error saving template:', err);
      playHapticFeedback('error', false);
    }
  }, [templateSaved, parsedWorkout, noteText, playTap, playSuccess]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!parsedWorkout) {
      return { exercises: 0, sets: 0, volume: 0, durationStr: '' };
    }

    const exercises = parsedWorkout.exercises.length;
    const sets = parsedWorkout.exercises.reduce((total, ex) => total + ex.sets.length, 0);
    const volume = parsedWorkout.exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => {
        const weightInPreferredUnit = convertWeight(set.weight, set.unit, weightUnit);
        return setTotal + (weightInPreferredUnit * set.reps);
      }, 0);
    }, 0);

    const hrs = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

    return { exercises, sets, volume: Math.round(volume), durationStr };
  }, [parsedWorkout, weightUnit, duration]);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Render parsing state
  const renderParsing = () => (
    <View style={[styles.centerContainer, { backgroundColor: 'transparent' }]}>
      <Logo />
      <ActivityIndicator
        size="large"
        color={currentTheme.colors.primary}
        style={styles.loadingIndicator}
      />
      <Text style={[styles.parsingText, { color: '#fff', fontFamily: 'Raleway_600SemiBold' }]}>
        Analyzing your workout...
      </Text>
      {error && (
        <Animated.View entering={FadeIn} style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: '#FF6B6B', fontFamily: 'Raleway_500Medium' }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={onCancel}
          >
            <Text style={[styles.retryButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );

  // Render confirmation state
  const renderConfirmation = () => (
    <View
      style={[styles.confirmationContainer, { backgroundColor: currentTheme.colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: currentTheme.colors.border, paddingTop: Math.max(16, insets.top) }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="close" size={28} color={currentTheme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
          Workout Summary
        </Text>
        <View style={styles.headerButton} />
      </View>

      {/* Stats Section */}
      <View style={[
        styles.statsContainer,
        { backgroundColor: currentTheme.colors.surface },
        isSmallScreen && styles.statsContainerSmall
      ]}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={isSmallScreen ? 20 : 24} color={currentTheme.colors.accent} />
          <Text style={[
            styles.statValue,
            { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' },
            isSmallScreen && styles.statValueSmall
          ]}>
            {stats.durationStr}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
            Duration
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
        <View style={styles.statItem}>
          <Ionicons name="barbell-outline" size={isSmallScreen ? 20 : 24} color={currentTheme.colors.accent} />
          <Text style={[
            styles.statValue,
            { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' },
            isSmallScreen && styles.statValueSmall
          ]}>
            {stats.exercises}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
            Exercises
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
        <View style={styles.statItem}>
          <Ionicons name="repeat-outline" size={isSmallScreen ? 20 : 24} color={currentTheme.colors.accent} />
          <Text style={[
            styles.statValue,
            { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' },
            isSmallScreen && styles.statValueSmall
          ]}>
            {stats.sets}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
            Sets
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
        <View style={styles.statItem}>
          <Ionicons name="trending-up-outline" size={isSmallScreen ? 20 : 24} color={currentTheme.colors.accent} />
          <Text style={[
            styles.statValue,
            { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' },
            isSmallScreen && styles.statValueSmall
          ]}>
            {stats.volume.toLocaleString()}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
            {weightUnit}
          </Text>
        </View>
      </View>

      {/* Exercises List */}
      <ScrollView style={styles.exercisesList} contentContainerStyle={styles.exercisesContent}>
        {parsedWorkout?.exercises.map((exercise, index) => {
          const exerciseInfo = exercise.matchedExerciseId
            ? getWorkoutById(exercise.matchedExerciseId)
            : null;

          return (
            <View
              key={index}
              style={[styles.exerciseCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
            >
              <View style={styles.exerciseHeader}>
                <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                  {exerciseInfo?.name || exercise.name}
                </Text>
                {exercise.isCustom && (
                  <View style={[styles.customBadge, { backgroundColor: currentTheme.colors.accent + '20' }]}>
                    <Text style={[styles.customBadgeText, { color: currentTheme.colors.accent, fontFamily: 'Raleway_500Medium' }]}>
                      Custom
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.setsContainer}>
                {exercise.sets.map((set, setIndex) => (
                  <View key={setIndex} style={styles.setRow}>
                    <Text style={[styles.setNumber, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
                      Set {setIndex + 1}
                    </Text>
                    <Text style={[styles.setDetails, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                      {set.weight > 0 ? `${set.weight} ${set.unit} × ${set.reps}` : `${set.reps} reps`}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[
        styles.actionsContainer,
        { backgroundColor: currentTheme.colors.background, borderTopColor: currentTheme.colors.border, paddingBottom: Math.max(16, insets.bottom) }
      ]}>
        <Button
          title={isSaving ? "Saving..." : "Finish Workout"}
          onPress={handleSave}
          variant="primary"
          size="large"
          style={styles.confirmButton}
          disabled={isSaving}
        />
      </View>
    </View>
  );

  // Render celebration state
  const renderCelebration = () => (
    <Animated.View entering={FadeIn} style={[styles.celebrationContainer, { backgroundColor: 'transparent' }]}>
      {/* Confetti particles */}
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          delay={particle.delay}
          startX={particle.startX}
          color={particle.color}
        />
      ))}

      <View style={styles.celebrationContent}>
        {/* Success icon with ring burst */}
        <View style={styles.iconContainer}>
          <Animated.View
            style={[styles.ring, { borderColor: currentTheme.colors.primary }, ringAnimatedStyle]}
          />
          <Animated.View style={pulseAnimatedStyle}>
            <Animated.View
              style={[styles.checkCircle, { backgroundColor: currentTheme.colors.primary }, checkAnimatedStyle]}
            >
              <Ionicons name="checkmark" size={48} color="#fff" />
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.Text
          entering={FadeIn.delay(300)}
          style={[styles.celebrationTitle, { color: '#fff', fontFamily: 'Raleway_700Bold' }]}
        >
          Workout Complete!
        </Animated.Text>
        <Animated.Text
          entering={FadeIn.delay(400)}
          style={[styles.celebrationSubtitle, { color: 'rgba(255,255,255,0.7)', fontFamily: 'Raleway_400Regular' }]}
        >
          Great job crushing it today
        </Animated.Text>

        {/* Stats */}
        <Animated.View entering={FadeIn.delay(500)} style={[styles.celebrationStats, isSmallScreen && styles.celebrationStatsSmall]}>
          <View style={[styles.celebrationStatItem, { backgroundColor: 'rgba(255,255,255,0.1)' }, isSmallScreen && styles.celebrationStatItemSmall]}>
            <Ionicons name="time-outline" size={isSmallScreen ? 20 : 24} color={currentTheme.colors.primary} />
            <Text style={[styles.celebrationStatValue, { color: '#fff', fontFamily: 'Raleway_700Bold' }, isSmallScreen && styles.celebrationStatValueSmall]}>
              {stats.durationStr}
            </Text>
            <Text style={[styles.celebrationStatLabel, { color: 'rgba(255,255,255,0.6)', fontFamily: 'Raleway_400Regular' }]}>
              Duration
            </Text>
          </View>
          <View style={[styles.celebrationStatItem, { backgroundColor: 'rgba(255,255,255,0.1)' }, isSmallScreen && styles.celebrationStatItemSmall]}>
            <Ionicons name="barbell-outline" size={isSmallScreen ? 20 : 24} color={currentTheme.colors.primary} />
            <Text style={[styles.celebrationStatValue, { color: '#fff', fontFamily: 'Raleway_700Bold' }, isSmallScreen && styles.celebrationStatValueSmall]}>
              {stats.exercises}
            </Text>
            <Text style={[styles.celebrationStatLabel, { color: 'rgba(255,255,255,0.6)', fontFamily: 'Raleway_400Regular' }]}>
              Exercises
            </Text>
          </View>
          <View style={[styles.celebrationStatItem, { backgroundColor: 'rgba(255,255,255,0.1)' }, isSmallScreen && styles.celebrationStatItemSmall]}>
            <Ionicons name="flame-outline" size={isSmallScreen ? 20 : 24} color={currentTheme.colors.primary} />
            <Text style={[styles.celebrationStatValue, { color: '#fff', fontFamily: 'Raleway_700Bold' }, isSmallScreen && styles.celebrationStatValueSmall]}>
              {stats.sets}
            </Text>
            <Text style={[styles.celebrationStatLabel, { color: 'rgba(255,255,255,0.6)', fontFamily: 'Raleway_400Regular' }]}>
              Sets
            </Text>
          </View>
        </Animated.View>

        {/* Action buttons */}
        <Animated.View entering={FadeIn.delay(700)} style={styles.celebrationButtonContainer}>
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
            onPress={handleSaveAsTemplate}
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
                fontFamily: 'Raleway_500Medium',
                color: templateSaved ? currentTheme.colors.accent : '#fff',
              }
            ]}>
              {templateSaved ? 'Saved to Templates' : 'Save as Template'}
            </Text>
          </TouchableOpacity>

          {/* Done button */}
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={handleDone}
            activeOpacity={0.8}
          >
            <Text style={[styles.doneButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
              Done
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View style={[
        styles.modalContainer,
        { backgroundColor: modalState === 'confirmation' ? currentTheme.colors.background : 'rgba(0,0,0,0.95)' },
      ]}>
        {modalState === 'parsing' && renderParsing()}
        {modalState === 'confirmation' && renderConfirmation()}
        {modalState === 'celebration' && renderCelebration()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingIndicator: {
    marginVertical: 24,
  },
  parsingText: {
    fontSize: 20,
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  confirmationContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  exerciseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 16,
    flex: 1,
  },
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  customBadgeText: {
    fontSize: 11,
  },
  setsContainer: {
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setNumber: {
    width: 50,
    fontSize: 13,
  },
  setDetails: {
    fontSize: 14,
  },
  actionsContainer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  confirmButton: {
    width: '100%',
  },
  celebrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  ring: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationTitle: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 8,
  },
  celebrationSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  celebrationStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  celebrationStatsSmall: {
    gap: 8,
  },
  celebrationStatItem: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 90,
  },
  celebrationStatItemSmall: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 75,
  },
  celebrationStatValue: {
    fontSize: 24,
    marginTop: 8,
  },
  celebrationStatValueSmall: {
    fontSize: 20,
    marginTop: 6,
  },
  celebrationStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  celebrationButtonContainer: {
    width: '100%',
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
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  // Logo image style
  logoImage: {
    width: 80,
    height: 80,
  },
  // Responsive styles for small screens
  statsContainerSmall: {
    paddingVertical: 14,
    marginHorizontal: 12,
  },
  statValueSmall: {
    fontSize: 18,
    marginTop: 6,
  },
});

export default WorkoutFinishModal;
