import { Text } from '@/components/Themed';
import {
  CARD_GAP,
  CARD_WIDTH,
  GeneratorColors,
  stepStyles,
} from '@/components/workout/routineGenerator/routineGeneratorShared';
import { TrainingGoal } from '@/lib/ai/aiRoutineGenerator';
import { radius, space, tint } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

const TRAINING_GOALS: { id: TrainingGoal; title: string; desc: string; icon: string }[] = [
  { id: 'hypertrophy', title: 'Hypertrophy', desc: 'Maximize muscle growth with optimal volume and intensity', icon: 'body-outline' },
  { id: 'strength', title: 'Strength', desc: 'Build maximal strength on compound lifts', icon: 'barbell-outline' },
  { id: 'powerbuilding', title: 'Powerbuilding', desc: 'Blend of heavy strength work and hypertrophy training', icon: 'fitness-outline' },
  { id: 'recomp', title: 'Recomposition', desc: 'Lose fat while building muscle with metabolic training', icon: 'flame-outline' },
  { id: 'athletic', title: 'Athletic', desc: 'Improve power, explosiveness, and functional performance', icon: 'flash-outline' },
  { id: 'general', title: 'General Fitness', desc: 'Well-rounded program for overall health and conditioning', icon: 'heart-outline' },
];

interface GoalStepProps {
  fadeAnim: Animated.Value;
  colors: GeneratorColors;
  onSelect: (goal: TrainingGoal) => void;
}

const GoalStep: React.FC<GoalStepProps> = ({ fadeAnim, colors, onSelect }) => (
  <Animated.View style={[stepStyles.stepContent, { opacity: fadeAnim }]}>
    <View style={stepStyles.titleBlock}>
      <Text variant="meta" weight="semiBold" style={stepStyles.stepLabel}>STEP 1</Text>
      <Text variant="screenTitle" tone="primary" weight="bold" style={stepStyles.title}>What&apos;s your goal?</Text>
    </View>

    <View style={styles.goalGrid}>
      {TRAINING_GOALS.map((goal) => (
        <TouchableOpacity
          key={goal.id}
          style={[styles.goalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onSelect(goal.id)}
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

const styles = StyleSheet.create({
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
});

export default GoalStep;
