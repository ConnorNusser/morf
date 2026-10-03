import { Text } from '@/components/Themed';
import { GeneratorColors } from '@/components/workout/routineGenerator/routineGeneratorShared';
import { space, track, withAlpha } from '@/lib/ui/tokens';
import React from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';

interface GeneratingStepProps {
  pulseAnim: Animated.Value;
  colors: GeneratorColors;
  statusMessage: string;
}

const GeneratingStep: React.FC<GeneratingStepProps> = ({ pulseAnim, colors, statusMessage }) => (
  <View style={styles.centerContent}>
    <Animated.View style={[styles.loadingCircle, { backgroundColor: colors.surface, borderColor: withAlpha(colors.accent, 'faint'), transform: [{ scale: pulseAnim }] }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </Animated.View>
    <Text variant="meta" weight="bold" style={styles.loadingLabel}>GENERATING</Text>
    <Text variant="body" tone="secondary">{statusMessage}</Text>
  </View>
);

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});

export default GeneratingStep;
