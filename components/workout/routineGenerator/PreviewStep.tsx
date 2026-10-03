import { Text } from '@/components/Themed';
import { GeneratorColors, stepStyles } from '@/components/workout/routineGenerator/routineGeneratorShared';
import { GeneratedRoutineProgram } from '@/lib/ai/aiRoutineGenerator';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface PreviewStepProps {
  colors: GeneratorColors;
  generatedProgram: GeneratedRoutineProgram | null;
  isRefining: boolean;
  isSaving: boolean;
  refineInstruction: string;
  onRefineInstructionChange: (instruction: string) => void;
  onRefine: () => void;
  onRegenerate: () => void;
  onSave: () => void;
}

const PreviewStep: React.FC<PreviewStepProps> = ({
  colors,
  generatedProgram,
  isRefining,
  isSaving,
  refineInstruction,
  onRefineInstructionChange,
  onRefine,
  onRegenerate,
  onSave,
}) => (
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

      <TouchableOpacity onPress={onRegenerate} style={styles.regenBtn} activeOpacity={0.7} disabled={isRefining}>
        <Ionicons name="refresh" size={15} color={colors.textDim} />
        <Text variant="meta" tone="secondary" weight="medium">Regenerate from scratch</Text>
      </TouchableOpacity>
    </ScrollView>

    <View style={[styles.previewBottomBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
      <View style={[styles.refineRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          style={[styles.refineInput, { color: colors.text }]}
          placeholder="Tell the coach what to change…"
          placeholderTextColor={colors.textMuted}
          value={refineInstruction}
          onChangeText={onRefineInstructionChange}
          editable={!isRefining}
          returnKeyType="send"
          onSubmitEditing={onRefine}
        />
        {/* Hand-rolled: the dense input row can't fit IconButton's 40pt square. */}
        <TouchableOpacity
          onPress={onRefine}
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
        style={[stepStyles.primaryBtn, { backgroundColor: colors.accent }, isSaving && { opacity: 0.6 }]}
        onPress={onSave}
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

const styles = StyleSheet.create({
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

export default PreviewStep;
