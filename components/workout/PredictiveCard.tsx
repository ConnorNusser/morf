// Predictive card: while you're typing in the composer but haven't sent yet,
// this previews what the text will become and lets you commit it in one tap.
//
// Timing is the whole game here:
//  - hide the instant the text changes (so it never lags a keystroke behind),
//  - re-show only after a brief pause (debounce), so it appears when you've
//    actually stopped typing,
//  - local parse only (no AI / no tokens while typing),
//  - render nothing unless the parse yields real sets, so partial text or prose
//    doesn't flash a bogus card.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getWorkoutById } from '@/lib/workout/workouts';
import { workoutNoteParser } from '@/lib/workout/workoutNoteParser';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { LayoutAnimation, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

const PAUSE_MS = 600;

interface PredictiveCardProps {
  text: string;
  weightUnit: WeightUnit;
  onCommit: () => void;
}

interface PreviewLine {
  name: string;
  summary: string;
}

function buildPreview(text: string, unit: WeightUnit): PreviewLine[] {
  const parsed = workoutNoteParser.parseLocal(text, unit);
  return parsed.exercises
    .filter(ex => ex.sets.length > 0)
    .map(ex => ({
      name: ex.matchedExerciseId ? getWorkoutById(ex.matchedExerciseId)?.name || ex.name : ex.name,
      summary: ex.sets.map(s => (s.weight > 0 ? `${s.weight}${unit}×${s.reps}` : `×${s.reps}`)).join(', '),
    }));
}

export default function PredictiveCard({ text, weightUnit, onCommit }: PredictiveCardProps) {
  const { currentTheme } = useTheme();
  const [lines, setLines] = useState<PreviewLine[]>([]);

  useEffect(() => {
    // Hide immediately on every change, then re-evaluate once typing pauses.
    setLines(prev => (prev.length ? [] : prev));
    if (!text.trim()) return;
    const handle = setTimeout(() => {
      const preview = buildPreview(text, weightUnit);
      LayoutAnimation.configureNext(LayoutAnimation.create(160, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
      setLines(preview);
    }, PAUSE_MS);
    return () => clearTimeout(handle);
  }, [text, weightUnit]);

  if (lines.length === 0) return null;

  return (
    <RNView style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => { playHapticFeedback('medium', false); onCommit(); }}
        style={[styles.card, { borderColor: currentTheme.colors.primary + '66', backgroundColor: currentTheme.colors.primary + '0F' }]}
      >
        <RNView style={styles.body}>
          {lines.map((line, i) => (
            <Text key={i} style={[styles.line, { color: currentTheme.colors.text }]} numberOfLines={1}>
              {line.name}  <Text style={{ color: currentTheme.colors.text + '99' }}>{line.summary}</Text>
            </Text>
          ))}
          <Text style={[styles.hint, { color: currentTheme.colors.primary }]}>Tap to add</Text>
        </RNView>
        <RNView style={[styles.addBtn, { backgroundColor: currentTheme.colors.primary }]}>
          <Ionicons name="add" size={22} color="#fff" />
        </RNView>
      </TouchableOpacity>
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 8, backgroundColor: 'transparent' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  body: { flex: 1, gap: 2 },
  line: { fontSize: 15 },
  hint: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
