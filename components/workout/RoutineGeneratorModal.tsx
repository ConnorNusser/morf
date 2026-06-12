import Chip from '@/components/Chip';
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
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 48 - CARD_GAP) / 2; // 24px padding each side

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
  if (goal === 'recomp') {
    if (days <= 3) return 'full_body';
    if (days === 4) return 'upper_lower';
    return 'ppl';
  }
  if (goal === 'athletic') {
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

  // Muscle group filter categories
  const muscleCategories = useMemo(() => ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'], []);

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
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBtn} />
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
        <Text style={[styles.title, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>What&apos;s your goal?</Text>
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
        <Text style={[styles.title, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>Focus or skip any areas?</Text>
        <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>
          Tap once to focus, tap again to skip, tap again to reset
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.bodyAreaLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.legendText, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>Focus</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={[styles.legendText, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>Skip</Text>
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
                isFocused && { backgroundColor: colors.success + '20', borderColor: colors.success },
                isIgnored && { backgroundColor: '#EF444420', borderColor: '#EF4444' },
              ]}
              onPress={() => handleBodyAreaToggle(area.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.bodyAreaLabel,
                  { color: colors.text, fontFamily: currentTheme.fonts.medium },
                  isFocused && { color: colors.success },
                  isIgnored && { color: '#EF4444' },
                ]}
              >
                {area.label}
              </Text>
              {isFocused && <Ionicons name="add-circle" size={16} color={colors.success} style={{ marginLeft: 4 }} />}
              {isIgnored && <Ionicons name="remove-circle" size={16} color="#EF4444" style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Summary */}
      {(selectedFocus.length > 0 || ignoredMuscles.length > 0) && (
        <View style={[styles.bodyAreaSummary, { backgroundColor: colors.surface }]}>
          {selectedFocus.length > 0 && (
            <Text style={[styles.bodyAreaSummaryText, { color: colors.success, fontFamily: currentTheme.fonts.medium }]}>
              Focusing: {selectedFocus.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')}
            </Text>
          )}
          {ignoredMuscles.length > 0 && (
            <Text style={[styles.bodyAreaSummaryText, { color: '#EF4444', fontFamily: currentTheme.fonts.medium }]}>
              Skipping: {ignoredMuscles.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')}
            </Text>
          )}
        </View>
      )}

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={handleFocusContinue}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryBtnText, { color: colors.bg, fontFamily: currentTheme.fonts.semiBold }]}>
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
        <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>We&apos;ll design the optimal split for your schedule</Text>
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
        <Text style={[styles.subtitle, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>This determines how many exercises we&apos;ll include</Text>
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
      <TouchableOpacity
        style={[
          styles.exerciseRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isIncluded && { backgroundColor: colors.success + '10', borderColor: colors.success },
          isExcluded && { backgroundColor: '#EF444410', borderColor: '#EF4444' },
        ]}
        onPress={() => handleExerciseCycle(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseInfo}>
          <Text
            style={[
              styles.exerciseName,
              { color: colors.text, fontFamily: currentTheme.fonts.medium },
              isIncluded && { color: colors.success },
              isExcluded && { color: '#EF4444' },
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={[styles.exerciseMuscle, { color: colors.textMuted, fontFamily: currentTheme.fonts.regular }]}>
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
            <View style={[styles.statusBadge, { backgroundColor: '#EF4444' }]}>
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
    <Text style={[styles.exercisesHint, { color: colors.textMuted, fontFamily: currentTheme.fonts.regular }]}>
      Optionally pick exercises — tap to cycle: include → exclude → reset
    </Text>
  );

  const renderExercisesStep = () => (
    <View style={styles.exercisesContainer}>
      {/* Compact header */}
      <View style={styles.exercisesHeader}>
        <View>
          <Text style={[styles.stepLabel, { color: colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>STEP 6</Text>
          <Text style={[styles.exercisesTitle, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>Exercise preferences</Text>
        </View>
        {(includedExercises.length > 0 || excludedExercises.length > 0) && (
          <View style={[styles.selectionPill, { backgroundColor: colors.surface }]}>
            {includedExercises.length > 0 && (
              <Text style={[styles.pillText, { color: colors.success, fontFamily: currentTheme.fonts.semiBold }]}>
                +{includedExercises.length}
              </Text>
            )}
            {includedExercises.length > 0 && excludedExercises.length > 0 && (
              <Text style={[styles.pillDivider, { color: colors.textMuted }]}>/</Text>
            )}
            {excludedExercises.length > 0 && (
              <Text style={[styles.pillText, { color: '#EF4444', fontFamily: currentTheme.fonts.semiBold }]}>
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
            style={[styles.exerciseSearchInput, { color: colors.text, fontFamily: currentTheme.fonts.regular }]}
            placeholder="Search..."
            placeholderTextColor={colors.textMuted}
            value={exerciseSearchQuery}
            onChangeText={setExerciseSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {exerciseSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setExerciseSearchQuery('')}>
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
        {muscleCategories.map((muscle) => (
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
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={handleExercisesContinue}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryBtnText, { color: colors.bg, fontFamily: currentTheme.fonts.semiBold }]}>
            Generate Routine
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGeneratingStep = () => (
    <View style={styles.centerContent}>
      <Animated.View style={[styles.loadingCircle, { backgroundColor: colors.surface, borderColor: colors.accent + '30', transform: [{ scale: pulseAnim }] }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </Animated.View>
      <Text style={[styles.loadingLabel, { color: colors.accent, fontFamily: currentTheme.fonts.bold }]}>GENERATING</Text>
      <Text style={[styles.loadingMessage, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>{statusMessage}</Text>
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
        <Text style={[styles.previewProgramName, { color: colors.text, fontFamily: currentTheme.fonts.bold }]}>
          {generatedProgram?.programName}
        </Text>
        <Text style={[styles.previewMeta, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>
          {generatedProgram?.routines.length} days/week · {generatedProgram?.trainingGoal}
        </Text>

        {generatedProgram?.source && (
          <TouchableOpacity
            style={styles.sourceRow}
            onPress={() => Linking.openURL(generatedProgram.source!.url)}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={13} color={colors.accent} />
            <Text style={[styles.sourceText, { color: colors.accent, fontFamily: currentTheme.fonts.medium }]} numberOfLines={1}>
              Based on {generatedProgram.source.program}
            </Text>
            <Ionicons name="open-outline" size={12} color={colors.accent} />
          </TouchableOpacity>
        )}

        {isRefining && (
          <View style={[styles.updatingRow, { backgroundColor: colors.accent + '12' }]}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.updatingText, { color: colors.accent, fontFamily: currentTheme.fonts.medium }]}>
              Updating your program…
            </Text>
          </View>
        )}

        <View style={[{ opacity: isRefining ? 0.4 : 1 }]}>
          {generatedProgram?.routines.map((day) => (
            <View key={day.dayNumber} style={[styles.previewDayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.dayCardHeader}>
                <Text style={[styles.dayName, { color: colors.text, fontFamily: currentTheme.fonts.semiBold }]}>{day.name}</Text>
                {!!day.estimatedTime && (
                  <Text style={[styles.dayTime, { color: colors.textMuted, fontFamily: currentTheme.fonts.regular }]}>{day.estimatedTime}</Text>
                )}
              </View>
              {!!day.focus && (
                <Text style={[styles.dayFocus, { color: colors.textDim, fontFamily: currentTheme.fonts.regular }]}>{day.focus}</Text>
              )}
              {day.exercises.map((ex, i) => (
                <View key={`${day.dayNumber}-${i}`} style={[styles.exerciseLine, { borderTopColor: colors.border }]}>
                  <View style={styles.exerciseLineMain}>
                    <Text style={[styles.exerciseLineName, { color: colors.text, fontFamily: currentTheme.fonts.regular }]} numberOfLines={2}>
                      {ex.name}
                    </Text>
                    {!!ex.notes && (
                      <Text style={[styles.exerciseNote, { color: colors.textMuted, fontFamily: currentTheme.fonts.regular }]} numberOfLines={2}>
                        {ex.notes}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.exerciseLineScheme, { color: colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>
                    {ex.sets} × {ex.reps}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={handleRegenerate} style={styles.regenBtn} activeOpacity={0.7} disabled={isRefining}>
          <Ionicons name="refresh" size={15} color={colors.textDim} />
          <Text style={[styles.regenText, { color: colors.textDim, fontFamily: currentTheme.fonts.medium }]}>Regenerate from scratch</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Refine + Save bar */}
      <View style={[styles.previewBottomBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <View style={[styles.refineRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.refineInput, { color: colors.text, fontFamily: currentTheme.fonts.regular }]}
            placeholder="Tell the coach what to change…"
            placeholderTextColor={colors.textMuted}
            value={refineInstruction}
            onChangeText={setRefineInstruction}
            editable={!isRefining}
            returnKeyType="send"
            onSubmitEditing={handleRefine}
          />
          <TouchableOpacity
            onPress={handleRefine}
            disabled={isRefining || !refineInstruction.trim()}
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
                <Text style={[styles.primaryBtnText, { color: colors.bg, fontFamily: currentTheme.fonts.semiBold }]}>Save Program</Text>
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
  bodyAreaLegend: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
  },
  bodyAreaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bodyAreaLabel: {
    fontSize: 15,
  },
  bodyAreaSummary: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    gap: 6,
  },
  bodyAreaSummaryText: {
    fontSize: 14,
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
    paddingTop: 16,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exercisesTitle: {
    fontSize: 22,
  },
  exercisesHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  selectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
  },
  pillText: {
    fontSize: 14,
  },
  pillDivider: {
    fontSize: 14,
  },
  searchFilterRow: {
    marginBottom: 8,
  },
  muscleFilterContainer: {
    flexGrow: 0,
    marginBottom: 10,
    marginHorizontal: -24,
  },
  muscleFilterContent: {
    paddingHorizontal: 24,
    gap: 6,
  },
  exerciseSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  exerciseSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  exerciseList: {
    flex: 1,
    marginBottom: 0,
  },
  exerciseListContent: {
    gap: 6,
    paddingBottom: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 15,
    marginBottom: 2,
  },
  exerciseMuscle: {
    fontSize: 12,
  },
  exerciseStatus: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisesBottomBar: {
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  // Preview / refine step
  previewContainer: {
    flex: 1,
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  previewProgramName: {
    fontSize: 24,
    marginBottom: 4,
  },
  previewMeta: {
    fontSize: 14,
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  sourceText: {
    fontSize: 13,
    flexShrink: 1,
  },
  updatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  updatingText: {
    fontSize: 14,
  },
  previewDayCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayName: {
    fontSize: 17,
    flex: 1,
  },
  dayTime: {
    fontSize: 13,
    marginLeft: 8,
  },
  dayFocus: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 4,
  },
  exerciseLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    marginTop: 6,
    gap: 12,
  },
  exerciseLineMain: {
    flex: 1,
  },
  exerciseLineName: {
    fontSize: 15,
  },
  exerciseNote: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  exerciseLineScheme: {
    fontSize: 14,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  regenText: {
    fontSize: 14,
  },
  previewBottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    gap: 12,
  },
  refineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  refineInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RoutineGeneratorModal;
