import Button from '@/components/Button';
import Chip from '@/components/Chip';
import IconButton from '@/components/IconButton';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import {
  aiRoutineGenerator,
  GenerateRoutineOptions,
  ProgramTemplate,
  TrainingGoal,
  GeneratedRoutineProgram,
} from '@/lib/ai/aiRoutineGenerator';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { radius, screenGutter, space, tint, track, trend, withAlpha } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { validateRoutines } from '@/lib/workout/trainingAdvancement';
import { getAvailableWorkouts, getWorkoutsByEquipment } from '@/lib/workout/workouts';
import { Equipment, Program, TrainingAdvancement } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
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
const CARD_GAP = space.md;
const CARD_WIDTH = (SCREEN_WIDTH - screenGutter * 2 - CARD_GAP) / 2;

type FlowStep = 'goal' | 'focus' | 'experience' | 'days' | 'duration' | 'exercises' | 'generating' | 'preview';

const INPUT_STEPS: FlowStep[] = ['goal', 'focus', 'experience', 'days', 'duration', 'exercises'];

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

// Muscle group filter categories
const MUSCLE_CATEGORIES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'];

// Body part areas (for focus/ignore)
const BODY_AREAS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
];

// Suggested split based on goal and days. Handed to the AI as a starting hint — the
// freeform prompt lets the model adapt the structure to the lifter's choices.
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
  // recomp, athletic, and general all share the default split mapping
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
  const [ignoredMuscles, setIgnoredMuscles] = useState<string[]>([]);
  const [selectedExperience, setSelectedExperience] = useState<TrainingAdvancement | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<WorkoutDuration | null>(null);
  const [includedExercises, setIncludedExercises] = useState<string[]>([]);
  const [excludedExercises, setExcludedExercises] = useState<string[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<string | null>(null);
  const [userEquipment, setUserEquipment] = useState<Equipment[]>([]);
  const [generatedProgram, setGeneratedProgram] = useState<GeneratedRoutineProgram | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [refineInstruction, setRefineInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Options used for the current generation — reused when refining/regenerating.
  const optionsRef = useRef<GenerateRoutineOptions | null>(null);

  // Load the user's equipment once so the browse list only shows what they can actually do.
  useEffect(() => {
    let active = true;
    (async () => {
      const profile = await userService.getRealUserProfile();
      const equipment = profile?.equipmentFilter?.includedEquipment;
      if (active && equipment && equipment.length > 0) {
        setUserEquipment(equipment);
      }
    })();
    return () => { active = false; };
  }, []);

  // Available exercises for the exercise preferences step (filtered to the user's equipment)
  const availableExercises = useMemo(() => {
    const source = userEquipment.length > 0
      ? getWorkoutsByEquipment(userEquipment, 200)
      : getAvailableWorkouts(200);
    return source.map(e => ({ id: e.id, name: e.name, muscleGroup: e.primaryMuscles[0] || '' }));
  }, [userEquipment]);

  const filteredExercises = useMemo(() => {
    let exercises = availableExercises;

    if (selectedMuscleFilter) {
      exercises = exercises.filter(e => e.muscleGroup === selectedMuscleFilter);
    }

    if (exerciseSearchQuery.trim()) {
      const query = exerciseSearchQuery.toLowerCase().trim();
      exercises = exercises.filter(e =>
        e.name.toLowerCase().includes(query) ||
        (e.muscleGroup && e.muscleGroup.toLowerCase().includes(query))
      );
    }

    return exercises;
  }, [availableExercises, exerciseSearchQuery, selectedMuscleFilter]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Theme-based colors — this modal's own palette (named exception), with the
  // text-emphasis steps drawn from the shared ink ramp.
  const colors = useMemo(() => ({
    bg: currentTheme.colors.background,
    surface: currentTheme.colors.surface,
    surfaceLight: currentTheme.colors.border,
    accent: currentTheme.colors.primary,
    text: currentTheme.colors.text,
    textDim: withAlpha(currentTheme.colors.text, 'secondary'),
    textMuted: withAlpha(currentTheme.colors.text, 'faint'),
    border: currentTheme.colors.border,
    success: trend.up,
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
        setIgnoredMuscles([]);
        setSelectedExperience(null);
        setSelectedDays(null);
        setSelectedDuration(null);
        setIncludedExercises([]);
        setExcludedExercises([]);
        setExerciseSearchQuery('');
        setSelectedMuscleFilter(null);
        setGeneratedProgram(null);
        setStatusMessage('');
        setRefineInstruction('');
        setIsRefining(false);
        setIsSaving(false);
        optionsRef.current = null;
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

  const handleBodyAreaToggle = (areaId: string) => {
    const isFocused = selectedFocus.includes(areaId);
    const isIgnored = ignoredMuscles.includes(areaId);

    if (!isFocused && !isIgnored) {
      setSelectedFocus(prev => [...prev, areaId]);
    } else if (isFocused) {
      setSelectedFocus(prev => prev.filter(f => f !== areaId));
      setIgnoredMuscles(prev => [...prev, areaId]);
    } else {
      setIgnoredMuscles(prev => prev.filter(i => i !== areaId));
    }
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

  // Cycle through: neutral -> included -> excluded -> neutral
  const handleExerciseCycle = useCallback((exerciseId: string) => {
    const isIncluded = includedExercises.includes(exerciseId);
    const isExcluded = excludedExercises.includes(exerciseId);

    if (!isIncluded && !isExcluded) {
      setIncludedExercises(prev => [...prev, exerciseId]);
    } else if (isIncluded) {
      setIncludedExercises(prev => prev.filter(id => id !== exerciseId));
      setExcludedExercises(prev => [...prev, exerciseId]);
    } else {
      setExcludedExercises(prev => prev.filter(id => id !== exerciseId));
    }
  }, [includedExercises, excludedExercises]);

  const buildOptions = (): GenerateRoutineOptions => {
    const experienceLevel = selectedExperience || 'beginner';
    const durationConfig = DURATION_OPTIONS.find(d => d.id === selectedDuration);
    return {
      programTemplate: selectProgramTemplate(selectedGoal!, selectedDays!),
      trainingGoal: selectedGoal!,
      weeklyDays: selectedDays!,
      focusMuscles: selectedFocus.length > 0 ? selectedFocus : undefined,
      ignoredMuscles: ignoredMuscles.length > 0 ? ignoredMuscles : undefined,
      trainingYears: EXPERIENCE_OPTIONS.find(e => e.id === experienceLevel)?.years,
      experienceLevel,
      workoutDuration: selectedDuration!,
      exercisesPerWorkout: durationConfig ? { min: durationConfig.min, max: durationConfig.max } : undefined,
      includedExercises: includedExercises.length > 0 ? includedExercises : undefined,
      excludedExercises: excludedExercises.length > 0 ? excludedExercises : undefined,
    };
  };

  const runGeneration = async (options: GenerateRoutineOptions) => {
    optionsRef.current = options;
    setStatusMessage('Designing your program…');
    setStep('generating');
    try {
      const program = await aiRoutineGenerator.generateRoutineProgram(options);
      setGeneratedProgram(program);
      setStep('preview');
    } catch (error) {
      console.error('Error generating routine:', error);
      // generateRoutineProgram returns a fallback rather than throwing, so this is rare —
      // bounce back to the exercises step if it ever happens.
      setStep('exercises');
    }
  };

  const handleExercisesContinue = () => {
    Keyboard.dismiss();
    runGeneration(buildOptions());
  };

  const handleRegenerate = () => {
    if (optionsRef.current) runGeneration(optionsRef.current);
  };

  const handleRefine = async () => {
    const instruction = refineInstruction.trim();
    if (!instruction || !generatedProgram || !optionsRef.current || isRefining) return;
    Keyboard.dismiss();
    setIsRefining(true);
    try {
      const updated = await aiRoutineGenerator.refineRoutineProgram(
        generatedProgram,
        instruction,
        optionsRef.current
      );
      setGeneratedProgram(updated);
      setRefineInstruction('');
    } catch (error) {
      console.error('Error refining routine:', error);
    } finally {
      setIsRefining(false);
    }
  };

  const handleSaveProgram = async () => {
    if (!generatedProgram || isSaving) return;
    setIsSaving(true);
    try {
      const programId = `prog-${Date.now()}`;
      const routines = await aiRoutineGenerator.convertToRoutines(generatedProgram, {
        excludedExerciseIds: excludedExercises.length > 0 ? excludedExercises : undefined,
        programId,
      });
      validateRoutines(routines, selectedExperience || 'beginner');

      const program: Program = {
        id: programId,
        name: generatedProgram.programName,
        programStyle: generatedProgram.programStyle,
        trainingGoal: generatedProgram.trainingGoal,
        source: generatedProgram.source,
        createdAt: new Date(),
        status: 'active',
        days: routines.length,
      };
      await storageService.saveProgram(program);
      for (const routine of routines) {
        await storageService.saveRoutine(routine);
      }
      // Make this the active program — pauses whatever was active before.
      await storageService.setActiveProgram(programId);

      onRoutinesCreated();
      onClose();
    } catch (error) {
      console.error('Error saving routine:', error);
      setIsSaving(false);
    }
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
    } else if (step === 'preview') {
      setGeneratedProgram(null);
      setRefineInstruction('');
      animateTransition('exercises');
    }
  };

  const getStepNumber = () => {
    const idx = INPUT_STEPS.indexOf(step);
    return idx >= 0 ? idx + 1 : 0;
  };

  const showBackButton = step === 'focus' || step === 'experience' || step === 'days' ||
    step === 'duration' || step === 'exercises' || step === 'preview';

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.bg }]}>
      {showBackButton ? (
        <IconButton icon="chevron-back" onPress={handleBack} />
      ) : (
        <View style={styles.headerSpacer} />
      )}

      {INPUT_STEPS.includes(step) && (
        <View style={styles.progressBar}>
          {INPUT_STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                { backgroundColor: colors.surfaceLight },
                i + 1 <= getStepNumber() && { backgroundColor: colors.accent },
              ]}
            />
          ))}
        </View>
      )}

      {step !== 'generating' ? (
        <IconButton icon="close" onPress={onClose} iconColor={colors.textMuted} />
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  const renderGoalStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text variant="meta" weight="semiBold" style={styles.stepLabel}>STEP 1</Text>
        <Text variant="screenTitle" tone="primary" weight="bold" style={styles.title}>What&apos;s your goal?</Text>
      </View>

      <View style={styles.goalGrid}>
        {TRAINING_GOALS.map((goal) => (
          <TouchableOpacity
            key={goal.id}
            style={[styles.goalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleGoalSelect(goal.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.goalIcon, { backgroundColor: tint(colors.accent) }]}>
              <Ionicons name={goal.icon as any} size={22} color={colors.accent} />
            </View>
            <Text variant="body" tone="primary" weight="semiBold" style={styles.goalTitle}>{goal.title}</Text>
            <Text variant="meta" tone="secondary" style={styles.goalDesc}>{goal.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderFocusStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text variant="meta" weight="semiBold" style={styles.stepLabel}>STEP 2</Text>
        <Text variant="screenTitle" tone="primary" weight="bold" style={styles.title}>Focus or skip any areas?</Text>
        <Text variant="body" tone="secondary" style={styles.subtitle}>
          Tap once to focus, tap again to skip, tap again to reset
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.bodyAreaLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text variant="meta" tone="secondary">Focus</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: trend.down }]} />
          <Text variant="meta" tone="secondary">Skip</Text>
        </View>
      </View>

      <View style={styles.focusGrid}>
        {BODY_AREAS.map((area) => {
          const isFocused = selectedFocus.includes(area.id);
          const isIgnored = ignoredMuscles.includes(area.id);

          return (
            <TouchableOpacity
              key={area.id}
              style={[
                styles.bodyAreaChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isFocused && { backgroundColor: tint(colors.success), borderColor: colors.success },
                isIgnored && { backgroundColor: tint(trend.down), borderColor: trend.down },
              ]}
              onPress={() => handleBodyAreaToggle(area.id)}
              activeOpacity={0.7}
            >
              <Text
                variant="body"
                tone="primary"
                weight="medium"
                style={[
                  isFocused && { color: colors.success },
                  isIgnored && { color: trend.down },
                ]}
              >
                {area.label}
              </Text>
              {isFocused && <Ionicons name="add-circle" size={16} color={colors.success} style={styles.bodyAreaIcon} />}
              {isIgnored && <Ionicons name="remove-circle" size={16} color={trend.down} style={styles.bodyAreaIcon} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Summary */}
      {(selectedFocus.length > 0 || ignoredMuscles.length > 0) && (
        <View style={[styles.bodyAreaSummary, { backgroundColor: colors.surface }]}>
          {selectedFocus.length > 0 && (
            <Text variant="meta" weight="medium" style={{ color: colors.success }}>
              Focusing: {selectedFocus.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')}
            </Text>
          )}
          {ignoredMuscles.length > 0 && (
            <Text variant="meta" weight="medium" style={{ color: trend.down }}>
              Skipping: {ignoredMuscles.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')}
            </Text>
          )}
        </View>
      )}

      <View style={styles.bottomActions}>
        {/* Icon + label CTA keeps the hand-rolled pill (C1 grammar). */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={handleFocusContinue}
          activeOpacity={0.8}
        >
          <Text variant="body" weight="semiBold" style={{ color: colors.bg }}>
            {selectedFocus.length > 0 || ignoredMuscles.length > 0 ? 'Continue' : 'Skip'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderExperienceStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text variant="meta" weight="semiBold" style={styles.stepLabel}>STEP 3</Text>
        <Text variant="screenTitle" tone="primary" weight="bold" style={styles.title}>Training experience?</Text>
        <Text variant="body" tone="secondary" style={styles.subtitle}>This helps us design appropriate volume and intensity</Text>
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
              <Text variant="body" tone="primary" weight="semiBold" style={styles.experienceTitle}>{option.title}</Text>
              <Text variant="meta" tone="secondary" style={styles.experienceDesc}>{option.desc}</Text>
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
        <Text variant="meta" weight="semiBold" style={styles.stepLabel}>STEP 4</Text>
        <Text variant="screenTitle" tone="primary" weight="bold" style={styles.title}>How many days per week?</Text>
        <Text variant="body" tone="secondary" style={styles.subtitle}>We&apos;ll design the optimal split for your schedule</Text>
      </View>

      <View style={styles.daysGrid}>
        {[3, 4, 5, 6].map((days) => (
          <TouchableOpacity
            key={days}
            style={[styles.dayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleDaysSelect(days)}
            activeOpacity={0.7}
          >
            <Text tone="primary" weight="bold" style={styles.dayNumber}>{days}</Text>
            <Text variant="body" tone="secondary" style={styles.dayLabel}>days</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderDurationStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text variant="meta" weight="semiBold" style={styles.stepLabel}>STEP 5</Text>
        <Text variant="screenTitle" tone="primary" weight="bold" style={styles.title}>How long per workout?</Text>
        <Text variant="body" tone="secondary" style={styles.subtitle}>This determines how many exercises we&apos;ll include</Text>
      </View>

      <View style={styles.durationGrid}>
        {DURATION_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.durationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleDurationSelect(option.id)}
            activeOpacity={0.7}
          >
            <Text variant="title" tone="primary" weight="bold" style={styles.durationLabel}>{option.label}</Text>
            <Text variant="meta" tone="secondary">{option.exercises}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderExerciseItem = ({ item }: { item: { id: string; name: string; muscleGroup: string } }) => {
    const isIncluded = includedExercises.includes(item.id);
    const isExcluded = excludedExercises.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.exerciseRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isIncluded && { backgroundColor: tint(colors.success), borderColor: colors.success },
          isExcluded && { backgroundColor: tint(trend.down), borderColor: trend.down },
        ]}
        onPress={() => handleExerciseCycle(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseInfo}>
          <Text
            variant="body"
            tone="primary"
            weight="medium"
            style={[
              styles.exerciseName,
              isIncluded && { color: colors.success },
              isExcluded && { color: trend.down },
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text variant="meta" tone="faint">
            {item.muscleGroup}
          </Text>
        </View>
        <View style={styles.exerciseStatus}>
          {isIncluded && (
            <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          )}
          {isExcluded && (
            <View style={[styles.statusBadge, { backgroundColor: trend.down }]}>
              <Ionicons name="remove" size={14} color="#fff" />
            </View>
          )}
          {!isIncluded && !isExcluded && (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Cycling hint, rendered above the exercise list.
  const renderExercisesHeader = () => (
    <Text variant="meta" tone="faint" style={styles.exercisesHint}>
      Optionally pick exercises — tap to cycle: include → exclude → reset
    </Text>
  );

  const renderExercisesStep = () => (
    <View style={styles.exercisesContainer}>
      {/* Compact header */}
      <View style={styles.exercisesHeader}>
        <View>
          <Text variant="meta" weight="semiBold" style={styles.stepLabel}>STEP 6</Text>
          <Text variant="heading" tone="primary" weight="bold">Exercise preferences</Text>
        </View>
        {(includedExercises.length > 0 || excludedExercises.length > 0) && (
          <View style={[styles.selectionPill, { backgroundColor: colors.surface }]}>
            {includedExercises.length > 0 && (
              <Text variant="meta" weight="semiBold" style={{ color: colors.success }}>
                +{includedExercises.length}
              </Text>
            )}
            {includedExercises.length > 0 && excludedExercises.length > 0 && (
              <Text variant="meta" tone="faint">/</Text>
            )}
            {excludedExercises.length > 0 && (
              <Text variant="meta" weight="semiBold" style={{ color: trend.down }}>
                -{excludedExercises.length}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchFilterRow}>
        <View style={[styles.exerciseSearchContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.exerciseSearchInput, { color: colors.text }]}
            placeholder="Search..."
            placeholderTextColor={colors.textMuted}
            value={exerciseSearchQuery}
            onChangeText={setExerciseSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {exerciseSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setExerciseSearchQuery('')} hitSlop={12}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Muscle group filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.muscleFilterContainer}
        contentContainerStyle={styles.muscleFilterContent}
      >
        <Chip
          label="All"
          selected={selectedMuscleFilter === null}
          onPress={() => setSelectedMuscleFilter(null)}
        />
        {MUSCLE_CATEGORIES.map((muscle) => (
          <Chip
            key={muscle}
            label={muscle.charAt(0).toUpperCase() + muscle.slice(1)}
            selected={selectedMuscleFilter === muscle}
            onPress={() => setSelectedMuscleFilter(selectedMuscleFilter === muscle ? null : muscle)}
          />
        ))}
      </ScrollView>

      {/* Exercise list */}
      <FlatList
        data={filteredExercises}
        renderItem={renderExerciseItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderExercisesHeader}
        style={styles.exerciseList}
        contentContainerStyle={styles.exerciseListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        windowSize={7}
      />

      {/* Sticky bottom button */}
      <View style={[styles.exercisesBottomBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <Button title="Generate Routine" onPress={handleExercisesContinue} />
      </View>
    </View>
  );

  const renderGeneratingStep = () => (
    <View style={styles.centerContent}>
      <Animated.View style={[styles.loadingCircle, { backgroundColor: colors.surface, borderColor: withAlpha(colors.accent, 'faint'), transform: [{ scale: pulseAnim }] }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </Animated.View>
      <Text variant="meta" weight="bold" style={styles.loadingLabel}>GENERATING</Text>
      <Text variant="body" tone="secondary">{statusMessage}</Text>
    </View>
  );

  const renderPreviewStep = () => (
    <KeyboardAvoidingView
      style={styles.previewContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.previewScroll}
        contentContainerStyle={styles.previewScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text variant="screenTitle" tone="primary" weight="bold" style={styles.previewProgramName}>
          {generatedProgram?.programName}
        </Text>
        <Text variant="meta" tone="secondary" style={styles.previewMeta}>
          {generatedProgram?.routines.length} days/week · {generatedProgram?.trainingGoal}
        </Text>

        {generatedProgram?.source && (
          <TouchableOpacity
            style={styles.sourceRow}
            onPress={() => Linking.openURL(generatedProgram.source!.url)}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={13} color={colors.accent} />
            <Text variant="meta" weight="medium" style={styles.sourceText} numberOfLines={1}>
              Based on {generatedProgram.source.program}
            </Text>
            <Ionicons name="open-outline" size={12} color={colors.accent} />
          </TouchableOpacity>
        )}

        {isRefining && (
          <View style={[styles.updatingRow, { backgroundColor: tint(colors.accent) }]}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text variant="meta" weight="medium">
              Updating your program…
            </Text>
          </View>
        )}

        <View style={[{ opacity: isRefining ? 0.4 : 1 }]}>
          {generatedProgram?.routines.map((day) => (
            <View key={day.dayNumber} style={[styles.previewDayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.dayCardHeader}>
                <Text variant="emphasis" tone="primary" weight="semiBold" style={styles.dayName}>{day.name}</Text>
                {!!day.estimatedTime && (
                  <Text variant="meta" tone="faint" style={styles.dayTime}>{day.estimatedTime}</Text>
                )}
              </View>
              {!!day.focus && (
                <Text variant="meta" tone="secondary" style={styles.dayFocus}>{day.focus}</Text>
              )}
              {day.exercises.map((ex, i) => (
                <View key={`${day.dayNumber}-${i}`} style={[styles.exerciseLine, { borderTopColor: colors.border }]}>
                  <View style={styles.exerciseLineMain}>
                    <Text variant="body" tone="primary" numberOfLines={2}>
                      {ex.name}
                    </Text>
                    {!!ex.notes && (
                      <Text variant="meta" tone="faint" style={styles.exerciseNote} numberOfLines={2}>
                        {ex.notes}
                      </Text>
                    )}
                  </View>
                  <Text variant="meta" weight="semiBold">
                    {ex.sets} × {ex.reps}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={handleRegenerate} style={styles.regenBtn} activeOpacity={0.7} disabled={isRefining}>
          <Ionicons name="refresh" size={15} color={colors.textDim} />
          <Text variant="meta" tone="secondary" weight="medium">Regenerate from scratch</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Refine + Save bar */}
      <View style={[styles.previewBottomBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <View style={[styles.refineRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.refineInput, { color: colors.text }]}
            placeholder="Tell the coach what to change…"
            placeholderTextColor={colors.textMuted}
            value={refineInstruction}
            onChangeText={setRefineInstruction}
            editable={!isRefining}
            returnKeyType="send"
            onSubmitEditing={handleRefine}
          />
          {/* Circular send control stays hand-rolled: the dense input row can't
              fit IconButton's 40pt square, so it keeps geometry + hitSlop. */}
          <TouchableOpacity
            onPress={handleRefine}
            disabled={isRefining || !refineInstruction.trim()}
            hitSlop={8}
            style={[
              styles.sendBtn,
              { backgroundColor: colors.accent },
              (isRefining || !refineInstruction.trim()) && { opacity: 0.4 },
            ]}
            activeOpacity={0.8}
          >
            {isRefining
              ? <ActivityIndicator size="small" color={colors.bg} />
              : <Ionicons name="arrow-up" size={18} color={colors.bg} />}
          </TouchableOpacity>
        </View>

        {/* Icon + label + spinner CTA keeps the hand-rolled pill (C1 grammar). */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent }, isSaving && { opacity: 0.6 }]}
          onPress={handleSaveProgram}
          disabled={isSaving || isRefining}
          activeOpacity={0.8}
        >
          {isSaving
            ? <ActivityIndicator size="small" color={colors.bg} />
            : (
              <>
                <Ionicons name="checkmark" size={18} color={colors.bg} />
                <Text variant="body" weight="semiBold" style={{ color: colors.bg }}>Save Program</Text>
              </>
            )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {renderHeader()}
        {step === 'exercises' ? (
          renderExercisesStep()
        ) : step === 'preview' ? (
          renderPreviewStep()
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
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  progressBar: {
    flexDirection: 'row',
    gap: space.sm,
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
    paddingHorizontal: screenGutter,
    paddingVertical: space.section,
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
    marginBottom: space.section,
  },
  stepLabel: {
    letterSpacing: track.caps,
    marginBottom: space.sm,
  },
  title: {
    lineHeight: lineHeightFor(type.screenTitle),
    marginBottom: space.xs,
  },
  subtitle: {
    marginTop: space.sm,
    lineHeight: lineHeightFor(type.body),
  },
  // Goal step
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  goalCard: {
    width: CARD_WIDTH,
    borderRadius: radius.card,
    padding: space.lg,
    borderWidth: 1,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  goalTitle: {
    marginBottom: space.xs,
  },
  goalDesc: {
    lineHeight: lineHeightFor(type.meta),
  },
  // Focus step
  focusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  bodyAreaLegend: {
    flexDirection: 'row',
    gap: space.xl,
    marginBottom: space.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bodyAreaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  bodyAreaIcon: {
    marginLeft: space.xs,
  },
  bodyAreaSummary: {
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.card,
    gap: space.sm,
  },
  bottomActions: {
    marginTop: 'auto',
    paddingTop: space.section,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    borderRadius: radius.pill,
  },
  // Experience step
  experienceList: {
    gap: space.md,
  },
  experienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  experienceContent: {
    flex: 1,
  },
  experienceTitle: {
    marginBottom: space.xs,
  },
  experienceDesc: {
    lineHeight: lineHeightFor(type.meta),
  },
  // Days step
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  dayCard: {
    width: CARD_WIDTH,
    borderRadius: radius.card,
    paddingVertical: space.section,
    alignItems: 'center',
    borderWidth: 1,
  },
  // The day-count display number is a named exception to the type scale (48).
  dayNumber: {
    fontSize: 48,
    letterSpacing: track.display,
  },
  dayLabel: {
    marginTop: space.xs,
  },
  // Loading
  loadingCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.section,
    borderWidth: 2,
  },
  loadingLabel: {
    letterSpacing: track.caps,
    marginBottom: space.sm,
  },
  // Duration step
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  durationCard: {
    width: CARD_WIDTH,
    borderRadius: radius.card,
    paddingVertical: space.section,
    alignItems: 'center',
    borderWidth: 1,
  },
  durationLabel: {
    marginBottom: space.xs,
  },
  // Exercise preferences step
  exercisesContainer: {
    flex: 1,
    paddingHorizontal: screenGutter,
    paddingTop: space.lg,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.md,
  },
  exercisesHint: {
    marginBottom: space.md,
  },
  selectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    gap: space.xs,
  },
  searchFilterRow: {
    marginBottom: space.sm,
  },
  muscleFilterContainer: {
    flexGrow: 0,
    marginBottom: space.md,
    marginHorizontal: -screenGutter,
  },
  muscleFilterContent: {
    paddingHorizontal: screenGutter,
    gap: space.sm,
  },
  exerciseSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.control,
    gap: space.sm,
  },
  exerciseSearchInput: {
    flex: 1,
    fontSize: type.meta,
    paddingVertical: 0,
  },
  exerciseList: {
    flex: 1,
    marginBottom: 0,
  },
  exerciseListContent: {
    gap: space.sm,
    paddingBottom: space.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: space.md,
  },
  exerciseName: {
    marginBottom: space.xs,
  },
  exerciseStatus: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisesBottomBar: {
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Preview / refine step
  previewContainer: {
    flex: 1,
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.sm,
    paddingBottom: space.section,
  },
  previewProgramName: {
    lineHeight: lineHeightFor(type.screenTitle),
    marginBottom: space.xs,
  },
  previewMeta: {
    marginBottom: space.md,
    textTransform: 'capitalize',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xl,
  },
  sourceText: {
    flexShrink: 1,
  },
  updatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    marginBottom: space.lg,
  },
  previewDayCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    marginBottom: space.md,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayName: {
    flex: 1,
  },
  dayTime: {
    marginLeft: space.sm,
  },
  dayFocus: {
    marginTop: space.xs,
    marginBottom: space.xs,
  },
  exerciseLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.sm,
    gap: space.md,
  },
  exerciseLineMain: {
    flex: 1,
  },
  exerciseNote: {
    marginTop: space.xs,
    lineHeight: lineHeightFor(type.meta),
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    marginTop: space.xs,
  },
  previewBottomBar: {
    paddingHorizontal: screenGutter,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.md,
  },
  refineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  refineInput: {
    flex: 1,
    fontSize: type.body,
    paddingVertical: space.sm,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RoutineGeneratorModal;
