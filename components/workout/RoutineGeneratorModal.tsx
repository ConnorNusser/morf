import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import {
  aiRoutineGenerator,
  ProgramTemplate,
  TrainingGoal,
  GeneratedRoutineProgram,
} from '@/lib/ai/aiRoutineGenerator';
import { storageService } from '@/lib/storage/storage';
import { validateGeneratedProgram } from '@/lib/workout/trainingAdvancement';
import { getAvailableWorkouts } from '@/lib/workout/workouts';
import { TrainingAdvancement } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface RoutineGeneratorModalProps {
  visible: boolean;
  onClose: () => void;
  onRoutinesCreated: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 48 - CARD_GAP) / 2; // 24px padding each side

type FlowStep = 'goal' | 'focus' | 'experience' | 'days' | 'duration' | 'exercises' | 'generating' | 'success';

// Workout duration options with exercise counts
export type WorkoutDuration = 30 | 60 | 90 | 120;

const DURATION_OPTIONS: { id: WorkoutDuration; label: string; exercises: string; min: number; max: number }[] = [
  { id: 30, label: '30 min', exercises: '3-4 exercises', min: 3, max: 4 },
  { id: 60, label: '1 hour', exercises: '~5 exercises', min: 5, max: 5 },
  { id: 90, label: '1.5 hours', exercises: '6-7 exercises', min: 6, max: 7 },
  { id: 120, label: '2 hours', exercises: '~8 exercises', min: 8, max: 8 },
];

// Training experience options
const EXPERIENCE_OPTIONS: { id: TrainingAdvancement; years: number; title: string; desc: string }[] = [
  { id: 'beginner', years: 0, title: 'Less than 1 year', desc: 'New to strength training or returning after a long break' },
  { id: 'intermediate', years: 2, title: '1-3 years', desc: 'Consistent training, comfortable with main lifts' },
  { id: 'advanced', years: 4, title: '3+ years', desc: 'Experienced lifter, pushing significant weight' },
];

// Training goals - proper technical terminology with detailed descriptions
const TRAINING_GOALS: { id: TrainingGoal; title: string; desc: string; icon: string }[] = [
  { id: 'hypertrophy', title: 'Hypertrophy', desc: 'Maximize muscle growth with optimal volume and intensity', icon: 'body-outline' },
  { id: 'strength', title: 'Strength', desc: 'Build maximal strength on compound lifts', icon: 'barbell-outline' },
  { id: 'powerbuilding', title: 'Powerbuilding', desc: 'Blend of heavy strength work and hypertrophy training', icon: 'fitness-outline' },
  { id: 'recomp', title: 'Recomposition', desc: 'Lose fat while building muscle with metabolic training', icon: 'flame-outline' },
  { id: 'athletic', title: 'Athletic', desc: 'Improve power, explosiveness, and functional performance', icon: 'flash-outline' },
  { id: 'general', title: 'General Fitness', desc: 'Well-rounded program for overall health and conditioning', icon: 'heart-outline' },
];

// Focus areas
const FOCUS_AREAS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
];

// Auto-select program template based on goal and days
function selectProgramTemplate(goal: TrainingGoal, days: number): ProgramTemplate {
  if (goal === 'strength') {
    return days <= 3 ? 'full_body' : 'strength';
  }
  if (goal === 'hypertrophy') {
    if (days <= 3) return 'ppl';
    if (days === 4) return 'upper_lower';
    return days >= 6 ? 'ppl' : 'bro_split';
  }
  if (goal === 'powerbuilding') {
    if (days <= 3) return 'full_body';
    if (days === 4) return 'upper_lower';
    return 'powerbuilding';
  }
  if (goal === 'recomp') {
    // Higher frequency for metabolic effect
    if (days <= 3) return 'full_body';
    if (days === 4) return 'upper_lower';
    return 'ppl';
  }
  if (goal === 'athletic') {
    // Full body or upper/lower for balanced athletic development
    if (days <= 3) return 'full_body';
    return days === 4 ? 'upper_lower' : 'ppl';
  }
  // general
  if (days <= 3) return 'full_body';
  if (days === 4) return 'upper_lower';
  return 'ppl';
}

const RoutineGeneratorModal: React.FC<RoutineGeneratorModalProps> = ({
  visible,
  onClose,
  onRoutinesCreated,
}) => {
  const { currentTheme } = useTheme();
  const [step, setStep] = useState<FlowStep>('goal');
  const [selectedGoal, setSelectedGoal] = useState<TrainingGoal | null>(null);
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);
  const [selectedExperience, setSelectedExperience] = useState<TrainingAdvancement | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<WorkoutDuration | null>(null);
  const [includedExercises, setIncludedExercises] = useState<string[]>([]);
  const [excludedExercises, setExcludedExercises] = useState<string[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [generatedProgram, setGeneratedProgram] = useState<GeneratedRoutineProgram | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Get available exercises for the exercise preferences step
  const availableExercises = useMemo(() => {
    return getAvailableWorkouts(200).map(e => ({ id: e.id, name: e.name, muscleGroup: e.muscleGroup }));
  }, []);

  const filteredExercises = useMemo(() => {
    if (!exerciseSearchQuery.trim()) return availableExercises;
    const query = exerciseSearchQuery.toLowerCase().trim();
    return availableExercises.filter(e =>
      e.name.toLowerCase().includes(query) ||
      e.muscleGroup.toLowerCase().includes(query)
    );
  }, [availableExercises, exerciseSearchQuery]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Theme-based colors
  const colors = useMemo(() => ({
    bg: currentTheme.colors.background,
    surface: currentTheme.colors.surface,
    surfaceLight: currentTheme.colors.border,
    accent: currentTheme.colors.primary,
    text: currentTheme.colors.text,
    textDim: currentTheme.colors.text + '80',
    textMuted: currentTheme.colors.text + '50',
    border: currentTheme.colors.border,
    success: '#34d399',
  }), [currentTheme]);

  useEffect(() => {
    if (step === 'generating') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [step, pulseAnim]);

  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setStep('goal');
        setSelectedGoal(null);
        setSelectedFocus([]);
        setSelectedExperience(null);
        setSelectedDays(null);
        setSelectedDuration(null);
        setIncludedExercises([]);
        setExcludedExercises([]);
        setExerciseSearchQuery('');
        setGeneratedProgram(null);
        setStatusMessage('');
      }, 300);
    }
  }, [visible]);

  const animateTransition = (nextStep: FlowStep) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 80,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleGoalSelect = (goal: TrainingGoal) => {
    setSelectedGoal(goal);
    animateTransition('focus');
  };

  const handleFocusToggle = (focusId: string) => {
    setSelectedFocus(prev =>
      prev.includes(focusId)
        ? prev.filter(f => f !== focusId)
        : [...prev, focusId]
    );
  };

  const handleFocusContinue = () => {
    animateTransition('experience');
  };

  const handleExperienceSelect = (experience: TrainingAdvancement) => {
    setSelectedExperience(experience);
    animateTransition('days');
  };

  const handleDaysSelect = (days: number) => {
    setSelectedDays(days);
    animateTransition('duration');
  };

  const handleDurationSelect = (duration: WorkoutDuration) => {
    setSelectedDuration(duration);
    animateTransition('exercises');
  };

  const handleToggleIncludedExercise = useCallback((exerciseId: string) => {
    setIncludedExercises(prev => {
      if (prev.includes(exerciseId)) {
        return prev.filter(id => id !== exerciseId);
      }
      // Remove from excluded if adding to included
      setExcludedExercises(exc => exc.filter(id => id !== exerciseId));
      return [...prev, exerciseId];
    });
  }, []);

  const handleToggleExcludedExercise = useCallback((exerciseId: string) => {
    setExcludedExercises(prev => {
      if (prev.includes(exerciseId)) {
        return prev.filter(id => id !== exerciseId);
      }
      // Remove from included if adding to excluded
      setIncludedExercises(inc => inc.filter(id => id !== exerciseId));
      return [...prev, exerciseId];
    });
  }, []);

  const handleExercisesContinue = async () => {
    animateTransition('generating');
    setStatusMessage('Analyzing your goals...');

    try {
      const programTemplate = selectProgramTemplate(selectedGoal!, selectedDays!);
      const experienceLevel = selectedExperience || 'beginner';
      const durationConfig = DURATION_OPTIONS.find(d => d.id === selectedDuration);

      setTimeout(() => setStatusMessage('Designing program structure...'), 1000);
      setTimeout(() => setStatusMessage('Selecting exercises...'), 2500);

      const program = await aiRoutineGenerator.generateRoutineProgram({
        programTemplate,
        trainingGoal: selectedGoal!,
        weeklyDays: selectedDays!,
        focusMuscles: selectedFocus.length > 0 ? selectedFocus : undefined,
        trainingYears: EXPERIENCE_OPTIONS.find(e => e.id === experienceLevel)?.years,
        workoutDuration: selectedDuration!,
        exercisesPerWorkout: { min: durationConfig!.min, max: durationConfig!.max },
        includedExercises: includedExercises.length > 0 ? includedExercises : undefined,
        excludedExercises: excludedExercises.length > 0 ? excludedExercises : undefined,
      });
      setGeneratedProgram(program);

      // Validate the generated program and log results
      validateGeneratedProgram(program, experienceLevel);

      const routines = await aiRoutineGenerator.convertToRoutines(program);
      for (const routine of routines) {
        await storageService.saveRoutine(routine);
      }

      setStatusMessage('Complete');
      animateTransition('success');
    } catch (error) {
      console.error('Error generating routine:', error);
      setStatusMessage('Failed to generate');
      setTimeout(() => onClose(), 1500);
    }
  };

  const handleDone = () => {
    onRoutinesCreated();
    onClose();
  };

  const handleBack = () => {
    if (step === 'focus') {
      animateTransition('goal');
      setSelectedGoal(null);
    } else if (step === 'experience') {
      animateTransition('focus');
    } else if (step === 'days') {
      animateTransition('experience');
      setSelectedExperience(null);
    } else if (step === 'duration') {
      animateTransition('days');
      setSelectedDays(null);
    } else if (step === 'exercises') {
      animateTransition('duration');
      setSelectedDuration(null);
    }
  };

  const getStepNumber = () => {
    const steps: FlowStep[] = ['goal', 'focus', 'experience', 'days', 'duration', 'exercises'];
    const idx = steps.indexOf(step);
    return idx >= 0 ? idx + 1 : 0;
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.bg }]}>
      {(step === 'focus' || step === 'experience' || step === 'days' || step === 'duration' || step === 'exercises') ? (
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBtn} />
      )}

      {step !== 'generating' && step !== 'success' && (
        <View style={styles.progressBar}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <View
              key={n}
              style={[
                styles.progressDot,
                { backgroundColor: colors.surfaceLight },
                n <= getStepNumber() && { backgroundColor: colors.accent },
              ]}
            />
          ))}
        </View>
      )}

      {step !== 'generating' && step !== 'success' ? (
        <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBtn} />
      )}
    </View>
  );

  const renderGoalStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.stepLabel, { color: colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>STEP 1</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>What's your goal?</Text>
      </View>

      <View style={styles.goalGrid}>
        {TRAINING_GOALS.map((goal) => (
          <TouchableOpacity
            key={goal.id}
            style={[styles.goalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleGoalSelect(goal.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.goalIcon, { backgroundColor: colors.accent + '15' }]}>
              <Ionicons name={goal.icon as any} size={22} color={colors.accent} />
            </View>
            <Text style={[styles.goalTitle, { color: colors.text, fontFamily: currentTheme.fonts.semiBold }]}>{goal.title}</Text>
            <Text style={[styles.goalDesc, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>{goal.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderFocusStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.stepLabel, { color: colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>STEP 2</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>Any areas to focus on?</Text>
        <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>Select muscle groups to prioritize, or skip for a balanced program</Text>
      </View>

      <View style={styles.focusGrid}>
        {FOCUS_AREAS.map((area) => {
          const isSelected = selectedFocus.includes(area.id);
          return (
            <TouchableOpacity
              key={area.id}
              style={[
                styles.focusChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isSelected && { backgroundColor: colors.accent + '12', borderColor: colors.accent },
              ]}
              onPress={() => handleFocusToggle(area.id)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={styles.focusCheck} />
              )}
              <Text style={[
                styles.focusLabel,
                { color: colors.textDim, fontFamily: currentTheme.fonts.semiBold },
                isSelected && { color: colors.accent },
              ]}>
                {area.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={handleFocusContinue}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryBtnText, { color: colors.bg, fontFamily: currentTheme.fonts.semiBold }]}>
            {selectedFocus.length > 0 ? 'Continue' : 'Skip'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderExperienceStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.stepLabel, { color: colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>STEP 3</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>Training experience?</Text>
        <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>This helps us design appropriate volume and intensity</Text>
      </View>

      <View style={styles.experienceList}>
        {EXPERIENCE_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.experienceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleExperienceSelect(option.id)}
            activeOpacity={0.7}
          >
            <View style={styles.experienceContent}>
              <Text style={[styles.experienceTitle, { color: colors.text, fontFamily: currentTheme.fonts.semiBold }]}>{option.title}</Text>
              <Text style={[styles.experienceDesc, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>{option.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderDaysStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.stepLabel, { color: colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>STEP 4</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>How many days per week?</Text>
        <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>We'll design the optimal split for your schedule</Text>
      </View>

      <View style={styles.daysGrid}>
        {[3, 4, 5, 6].map((days) => (
          <TouchableOpacity
            key={days}
            style={[styles.dayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleDaysSelect(days)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayNumber, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>{days}</Text>
            <Text style={[styles.dayLabel, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>days</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderDurationStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.stepLabel, { color: colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>STEP 5</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>How long per workout?</Text>
        <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>This determines how many exercises we'll include</Text>
      </View>

      <View style={styles.durationGrid}>
        {DURATION_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.durationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleDurationSelect(option.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.durationLabel, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>{option.label}</Text>
            <Text style={[styles.durationExercises, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>{option.exercises}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderExerciseItem = ({ item }: { item: { id: string; name: string; muscleGroup: string } }) => {
    const isIncluded = includedExercises.includes(item.id);
    const isExcluded = excludedExercises.includes(item.id);

    return (
      <View style={[styles.exerciseRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.exerciseInfo}>
          <Text style={[styles.exerciseName, { color: colors.text, fontFamily: currentTheme.fonts.medium }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.exerciseMuscle, { color: colors.textMuted, fontFamily: currentTheme.fonts.regular }]}>
            {item.muscleGroup}
          </Text>
        </View>
        <View style={styles.exerciseActions}>
          <TouchableOpacity
            style={[
              styles.exerciseActionBtn,
              { backgroundColor: isIncluded ? colors.success + '20' : colors.bg, borderColor: isIncluded ? colors.success : colors.border },
            ]}
            onPress={() => handleToggleIncludedExercise(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={isIncluded ? colors.success : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.exerciseActionBtn,
              { backgroundColor: isExcluded ? '#EF444420' : colors.bg, borderColor: isExcluded ? '#EF4444' : colors.border },
            ]}
            onPress={() => handleToggleExcludedExercise(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={18} color={isExcluded ? '#EF4444' : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderExercisesStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim, flex: 1 }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.stepLabel, { color: colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>STEP 6</Text>
        <Text style={[styles.title, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>Exercise preferences</Text>
        <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>
          Tap + to include, - to exclude. Skip if no preference.
        </Text>
      </View>

      {/* Selection summary */}
      {(includedExercises.length > 0 || excludedExercises.length > 0) && (
        <View style={[styles.selectionSummary, { backgroundColor: colors.surface }]}>
          {includedExercises.length > 0 && (
            <Text style={[styles.selectionText, { color: colors.success, fontFamily: currentTheme.fonts.medium }]}>
              +{includedExercises.length} included
            </Text>
          )}
          {excludedExercises.length > 0 && (
            <Text style={[styles.selectionText, { color: '#EF4444', fontFamily: currentTheme.fonts.medium }]}>
              -{excludedExercises.length} excluded
            </Text>
          )}
        </View>
      )}

      {/* Search bar */}
      <View style={[styles.exerciseSearchContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.exerciseSearchInput, { color: colors.text, fontFamily: currentTheme.fonts.regular }]}
          placeholder="Search exercises..."
          placeholderTextColor={colors.textMuted}
          value={exerciseSearchQuery}
          onChangeText={setExerciseSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {exerciseSearchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setExerciseSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Exercise list */}
      <FlatList
        data={filteredExercises}
        renderItem={renderExerciseItem}
        keyExtractor={(item) => item.id}
        style={styles.exerciseList}
        contentContainerStyle={styles.exerciseListContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={handleExercisesContinue}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryBtnText, { color: colors.bg, fontFamily: currentTheme.fonts.semiBold }]}>
            {includedExercises.length === 0 && excludedExercises.length === 0 ? 'Skip & Generate' : 'Generate Routine'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderGeneratingStep = () => (
    <Animated.View style={[styles.centerContent, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.loadingCircle, { backgroundColor: colors.surface, borderColor: colors.accent + '30', transform: [{ scale: pulseAnim }] }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </Animated.View>
      <Text style={[styles.loadingLabel, { color: colors.accent, fontFamily: currentTheme.fonts.bold }]}>GENERATING</Text>
      <Text style={[styles.loadingMessage, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>{statusMessage}</Text>
    </Animated.View>
  );

  const renderSuccessStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.successHeader}>
        <View style={[styles.successIcon, { backgroundColor: colors.success + '15' }]}>
          <Ionicons name="checkmark" size={36} color={colors.success} />
        </View>
        <Text style={[styles.successTitle, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>{generatedProgram?.programName}</Text>
        <Text style={[styles.successDesc, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>{generatedProgram?.programDescription}</Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>{generatedProgram?.routines.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>Routines</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>{selectedDays}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>Days/Week</Text>
          </View>
          {selectedFocus.length > 0 && (
            <>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>{selectedFocus.length}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>Focus Areas</Text>
              </View>
            </>
          )}
        </View>

        {selectedFocus.length > 0 && (
          <View style={[styles.focusList, { borderTopColor: colors.border }]}>
            <Text style={[styles.focusListLabel, { color: colors.textMuted, fontFamily: currentTheme.fonts.regular }]}>Prioritizing: </Text>
            <Text style={[styles.focusListText, { color: colors.accent, fontFamily: currentTheme.fonts.medium }]}>
              {selectedFocus.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')}
            </Text>
          </View>
        )}

        <View style={[styles.progressionNote, { backgroundColor: colors.bg }]}>
          <Text style={[styles.progressionNoteText, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>{generatedProgram?.progressionNotes}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
        onPress={handleDone}
        activeOpacity={0.8}
      >
        <Text style={[styles.primaryBtnText, { color: colors.bg, fontFamily: currentTheme.fonts.semiBold }]}>View Routines</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {renderHeader()}
        {step === 'exercises' ? (
          <View style={styles.exercisesContainer}>
            {renderExercisesStep()}
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {step === 'goal' && renderGoalStep()}
            {step === 'focus' && renderFocusStep()}
            {step === 'experience' && renderExperienceStep()}
            {step === 'days' && renderDaysStep()}
            {step === 'duration' && renderDurationStep()}
            {step === 'generating' && renderGeneratingStep()}
            {step === 'success' && renderSuccessStep()}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

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
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  stepContent: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    marginBottom: 32,
  },
  stepLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  // Goal step
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  goalCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  goalTitle: {
    fontSize: 15,
    marginBottom: 4,
  },
  goalDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  // Focus step
  focusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  focusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  focusCheck: {
    marginRight: 8,
  },
  focusLabel: {
    fontSize: 15,
  },
  bottomActions: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryBtnText: {
    fontSize: 16,
  },
  // Experience step
  experienceList: {
    gap: 12,
  },
  experienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  experienceContent: {
    flex: 1,
  },
  experienceTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  experienceDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Days step
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  dayCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 1,
  },
  dayNumber: {
    fontSize: 48,
  },
  dayLabel: {
    fontSize: 15,
    marginTop: 4,
  },
  // Loading
  loadingCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
  },
  loadingLabel: {
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  loadingMessage: {
    fontSize: 15,
  },
  // Success
  successHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  summaryValue: {
    fontSize: 28,
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 40,
  },
  focusList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
    borderTopWidth: 1,
    marginBottom: 12,
  },
  focusListLabel: {
    fontSize: 13,
  },
  focusListText: {
    fontSize: 13,
  },
  progressionNote: {
    borderRadius: 8,
    padding: 12,
  },
  progressionNoteText: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Duration step
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  durationCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  durationLabel: {
    fontSize: 20,
    marginBottom: 4,
  },
  durationExercises: {
    fontSize: 13,
  },
  // Exercise preferences step
  exercisesContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  selectionSummary: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  selectionText: {
    fontSize: 14,
  },
  exerciseSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
  },
  exerciseSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  exerciseList: {
    flex: 1,
    marginBottom: 12,
  },
  exerciseListContent: {
    gap: 8,
    paddingBottom: 16,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 14,
    marginBottom: 2,
  },
  exerciseMuscle: {
    fontSize: 12,
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  exerciseActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

export default RoutineGeneratorModal;
