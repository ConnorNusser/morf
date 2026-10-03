// State, effects, and handlers for the routine generator flow: the multi-step
// selections, the step transitions, and the generate / refine / save lifecycle.
import { FlowStep } from '@/components/workout/routineGenerator/routineGeneratorShared';
import {
  aiRoutineGenerator,
  GenerateRoutineOptions,
  TrainingGoal,
  GeneratedRoutineProgram,
} from '@/lib/ai/aiRoutineGenerator';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { getAvailableExercises, getExercisesByEquipment } from '@/lib/workout/exerciseCatalog';
import { buildRoutineOptions, filterBrowseExercises, WorkoutDuration } from '@/lib/workout/routineGeneratorOptions';
import { validateRoutines } from '@/lib/workout/trainingAdvancement';
import { Equipment, Program, TrainingAdvancement } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard } from 'react-native';

interface UseRoutineGeneratorParams {
  visible: boolean;
  onClose: () => void;
  onRoutinesCreated: () => void;
}

export function useRoutineGenerator({ visible, onClose, onRoutinesCreated }: UseRoutineGeneratorParams) {
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

  const availableExercises = useMemo(() => {
    const source = userEquipment.length > 0
      ? getExercisesByEquipment(userEquipment, 200)
      : getAvailableExercises(200);
    return source.map(e => ({ id: e.id, name: e.name, muscleGroup: e.primaryMuscles[0] || '' }));
  }, [userEquipment]);

  const filteredExercises = useMemo(
    () => filterBrowseExercises(availableExercises, selectedMuscleFilter, exerciseSearchQuery),
    [availableExercises, exerciseSearchQuery, selectedMuscleFilter]
  );

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  const buildOptions = (): GenerateRoutineOptions => buildRoutineOptions({
    selectedGoal,
    selectedDays,
    selectedDuration,
    selectedExperience,
    selectedFocus,
    ignoredMuscles,
    includedExercises,
    excludedExercises,
  });

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
      // Rare: generateRoutineProgram returns a fallback rather than throwing.
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

  return {
    step,
    fadeAnim,
    pulseAnim,
    selectedFocus,
    ignoredMuscles,
    includedExercises,
    excludedExercises,
    exerciseSearchQuery,
    setExerciseSearchQuery,
    selectedMuscleFilter,
    setSelectedMuscleFilter,
    filteredExercises,
    generatedProgram,
    statusMessage,
    refineInstruction,
    setRefineInstruction,
    isRefining,
    isSaving,
    handleGoalSelect,
    handleBodyAreaToggle,
    handleFocusContinue,
    handleExperienceSelect,
    handleDaysSelect,
    handleDurationSelect,
    handleExerciseCycle,
    handleExercisesContinue,
    handleRegenerate,
    handleRefine,
    handleSaveProgram,
    handleBack,
  };
}
