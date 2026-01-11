import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import {
  aiRoutineGenerator,
  ProgramTemplate,
  TrainingGoal,
  GeneratedRoutineProgram,
} from '@/lib/ai/aiRoutineGenerator';
import { storageService } from '@/lib/storage/storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
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

type FlowStep = 'goal' | 'focus' | 'days' | 'generating' | 'success';

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
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [generatedProgram, setGeneratedProgram] = useState<GeneratedRoutineProgram | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

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
        setSelectedDays(null);
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
    animateTransition('days');
  };

  const handleDaysSelect = async (days: number) => {
    setSelectedDays(days);
    animateTransition('generating');
    setStatusMessage('Analyzing your goals...');

    try {
      const programTemplate = selectProgramTemplate(selectedGoal!, days);

      setTimeout(() => setStatusMessage('Designing program structure...'), 1000);
      setTimeout(() => setStatusMessage('Selecting exercises...'), 2500);

      const program = await aiRoutineGenerator.generateRoutineProgram({
        programTemplate,
        trainingGoal: selectedGoal!,
        weeklyDays: days,
        focusMuscles: selectedFocus.length > 0 ? selectedFocus : undefined,
      });
      setGeneratedProgram(program);

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
    } else if (step === 'days') {
      animateTransition('focus');
    }
  };

  const getStepNumber = () => {
    const steps: FlowStep[] = ['goal', 'focus', 'days'];
    const idx = steps.indexOf(step);
    return idx >= 0 ? idx + 1 : 0;
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.bg }]}>
      {(step === 'focus' || step === 'days') ? (
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBtn} />
      )}

      {step !== 'generating' && step !== 'success' && (
        <View style={styles.progressBar}>
          {[1, 2, 3].map((n) => (
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

  const renderDaysStep = () => (
    <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.stepLabel, { color: colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>STEP 3</Text>
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {step === 'goal' && renderGoalStep()}
          {step === 'focus' && renderFocusStep()}
          {step === 'days' && renderDaysStep()}
          {step === 'generating' && renderGeneratingStep()}
          {step === 'success' && renderSuccessStep()}
        </ScrollView>
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
});

export default RoutineGeneratorModal;
