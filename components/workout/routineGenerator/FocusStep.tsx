import { Text } from '@/components/Themed';
import { GeneratorColors, stepStyles } from '@/components/workout/routineGenerator/routineGeneratorShared';
import { radius, space, tint, trend } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

const BODY_AREAS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
];

interface FocusStepProps {
  fadeAnim: Animated.Value;
  colors: GeneratorColors;
  selectedFocus: string[];
  ignoredMuscles: string[];
  onToggle: (areaId: string) => void;
  onContinue: () => void;
}

const FocusStep: React.FC<FocusStepProps> = ({
  fadeAnim,
  colors,
  selectedFocus,
  ignoredMuscles,
  onToggle,
  onContinue,
}) => (
  <Animated.View style={[stepStyles.stepContent, { opacity: fadeAnim }]}>
    <View style={stepStyles.titleBlock}>
      <Text variant="meta" weight="semiBold" style={stepStyles.stepLabel}>STEP 2</Text>
      <Text variant="screenTitle" tone="primary" weight="bold" style={stepStyles.title}>Focus or skip any areas?</Text>
      <Text variant="body" tone="secondary" style={stepStyles.subtitle}>
        Tap once to focus, tap again to skip, tap again to reset
      </Text>
    </View>

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
            onPress={() => onToggle(area.id)}
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
        style={[stepStyles.primaryBtn, { backgroundColor: colors.accent }]}
        onPress={onContinue}
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

const styles = StyleSheet.create({
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
});

export default FocusStep;
