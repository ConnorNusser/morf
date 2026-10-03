import IconButton from '@/components/IconButton';
import {
  FlowStep,
  GeneratorColors,
  INPUT_STEPS,
} from '@/components/workout/routineGenerator/routineGeneratorShared';
import { screenGutter, space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface RoutineGeneratorHeaderProps {
  step: FlowStep;
  colors: GeneratorColors;
  onBack: () => void;
  onClose: () => void;
}

const RoutineGeneratorHeader: React.FC<RoutineGeneratorHeaderProps> = ({ step, colors, onBack, onClose }) => {
  const getStepNumber = () => {
    const idx = INPUT_STEPS.indexOf(step);
    return idx >= 0 ? idx + 1 : 0;
  };

  const showBackButton = step === 'focus' || step === 'experience' || step === 'days' ||
    step === 'duration' || step === 'exercises' || step === 'preview';

  return (
    <View style={[styles.header, { backgroundColor: colors.bg }]}>
      {showBackButton ? (
        <IconButton icon="chevron-back" onPress={onBack} />
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
};

const styles = StyleSheet.create({
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
});

export default RoutineGeneratorHeader;
