import { Text } from '@/components/Themed';
import { GeneratorColors, stepStyles } from '@/components/workout/routineGenerator/routineGeneratorShared';
import { radius, space } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { EXPERIENCE_OPTIONS } from '@/lib/workout/routineGeneratorOptions';
import { TrainingAdvancement } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

interface ExperienceStepProps {
  fadeAnim: Animated.Value;
  colors: GeneratorColors;
  onSelect: (experience: TrainingAdvancement) => void;
}

const ExperienceStep: React.FC<ExperienceStepProps> = ({ fadeAnim, colors, onSelect }) => (
  <Animated.View style={[stepStyles.stepContent, { opacity: fadeAnim }]}>
    <View style={stepStyles.titleBlock}>
      <Text variant="meta" weight="semiBold" style={stepStyles.stepLabel}>STEP 3</Text>
      <Text variant="screenTitle" tone="primary" weight="bold" style={stepStyles.title}>Training experience?</Text>
      <Text variant="body" tone="secondary" style={stepStyles.subtitle}>This helps us design appropriate volume and intensity</Text>
    </View>

    <View style={styles.experienceList}>
      {EXPERIENCE_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[styles.experienceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onSelect(option.id)}
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

const styles = StyleSheet.create({
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
});

export default ExperienceStep;
