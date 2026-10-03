import DaysStep from '@/components/workout/routineGenerator/DaysStep';
import DurationStep from '@/components/workout/routineGenerator/DurationStep';
import ExercisesStep from '@/components/workout/routineGenerator/ExercisesStep';
import ExperienceStep from '@/components/workout/routineGenerator/ExperienceStep';
import FocusStep from '@/components/workout/routineGenerator/FocusStep';
import GeneratingStep from '@/components/workout/routineGenerator/GeneratingStep';
import GoalStep from '@/components/workout/routineGenerator/GoalStep';
import PreviewStep from '@/components/workout/routineGenerator/PreviewStep';
import RoutineGeneratorHeader from '@/components/workout/routineGenerator/RoutineGeneratorHeader';
import { useRoutineGenerator } from '@/components/workout/routineGenerator/useRoutineGenerator';
import { useTheme } from '@/contexts/ThemeContext';
import { screenGutter, space, trend, withAlpha } from '@/lib/ui/tokens';
import React, { useMemo } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet } from 'react-native';

export type { WorkoutDuration } from '@/lib/workout/routineGeneratorOptions';

interface RoutineGeneratorModalProps {
  visible: boolean;
  onClose: () => void;
  onRoutinesCreated: () => void;
}

const RoutineGeneratorModal: React.FC<RoutineGeneratorModalProps> = ({
  visible,
  onClose,
  onRoutinesCreated,
}) => {
  const { currentTheme } = useTheme();
  const {
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
  } = useRoutineGenerator({ visible, onClose, onRoutinesCreated });

  // Named exception: this modal's own palette; text-emphasis steps use the shared ink ramp.
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <RoutineGeneratorHeader step={step} colors={colors} onBack={handleBack} onClose={onClose} />
        {step === 'exercises' ? (
          <ExercisesStep
            colors={colors}
            filteredExercises={filteredExercises}
            includedExercises={includedExercises}
            excludedExercises={excludedExercises}
            exerciseSearchQuery={exerciseSearchQuery}
            onSearchQueryChange={setExerciseSearchQuery}
            selectedMuscleFilter={selectedMuscleFilter}
            onMuscleFilterChange={setSelectedMuscleFilter}
            onExerciseCycle={handleExerciseCycle}
            onContinue={handleExercisesContinue}
          />
        ) : step === 'preview' ? (
          <PreviewStep
            colors={colors}
            generatedProgram={generatedProgram}
            isRefining={isRefining}
            isSaving={isSaving}
            refineInstruction={refineInstruction}
            onRefineInstructionChange={setRefineInstruction}
            onRefine={handleRefine}
            onRegenerate={handleRegenerate}
            onSave={handleSaveProgram}
          />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {step === 'goal' && (
              <GoalStep fadeAnim={fadeAnim} colors={colors} onSelect={handleGoalSelect} />
            )}
            {step === 'focus' && (
              <FocusStep
                fadeAnim={fadeAnim}
                colors={colors}
                selectedFocus={selectedFocus}
                ignoredMuscles={ignoredMuscles}
                onToggle={handleBodyAreaToggle}
                onContinue={handleFocusContinue}
              />
            )}
            {step === 'experience' && (
              <ExperienceStep fadeAnim={fadeAnim} colors={colors} onSelect={handleExperienceSelect} />
            )}
            {step === 'days' && (
              <DaysStep fadeAnim={fadeAnim} colors={colors} onSelect={handleDaysSelect} />
            )}
            {step === 'duration' && (
              <DurationStep fadeAnim={fadeAnim} colors={colors} onSelect={handleDurationSelect} />
            )}
            {step === 'generating' && (
              <GeneratingStep pulseAnim={pulseAnim} colors={colors} statusMessage={statusMessage} />
            )}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: screenGutter,
    paddingVertical: space.section,
  },
});

export default RoutineGeneratorModal;
