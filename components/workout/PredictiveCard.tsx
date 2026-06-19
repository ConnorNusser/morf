// Pending-set preview shown below the composer. As you type it shows a quiet
// "reading…" skeleton (so it's obvious the set is being picked up); when you
// pause it resolves to a plain card of what will be added — styled like a normal
// set, not an AI suggestion. Local parse only (no tokens while typing).
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getWorkoutById } from '@/lib/workout/workouts';
import { ParsedSet, workoutNoteParser } from '@/lib/workout/workoutNoteParser';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

const PAUSE_MS = 500;

interface PredictiveCardProps {
  text: string;
  weightUnit: WeightUnit;
  onCommit: () => void;
}

interface PreviewLine {
  name: string;
  summary: string;
}

function toLines(parsed: { exercises: { name: string; matchedExerciseId?: string; sets: ParsedSet[] }[] }, unit: WeightUnit): PreviewLine[] {
  return parsed.exercises
    .filter(ex => ex.sets.length > 0)
    .map(ex => ({
      name: ex.matchedExerciseId ? getWorkoutById(ex.matchedExerciseId)?.name || ex.name : ex.name,
      summary: ex.sets.map((s: ParsedSet) => (s.weight > 0 ? `${s.weight} ${unit} × ${s.reps}` : `${s.reps} reps`)).join(',  '),
    }));
}

// The local parse is "good enough" only if it recognized the exercise and got
// real sets; otherwise we let the AI interpret it (abbreviations like "DL").
function localIsReasonable(parsed: { exercises: { matchedExerciseId?: string; sets: ParsedSet[] }[] }): boolean {
  return parsed.exercises.length > 0 &&
    parsed.exercises.every(ex => !!ex.matchedExerciseId && ex.sets.length > 0 && ex.sets.every(s => s.reps > 0));
}

export default function PredictiveCard({ text, weightUnit, onCommit }: PredictiveCardProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const [lines, setLines] = useState<PreviewLine[]>([]);
  const [loading, setLoading] = useState(false);
  const pulse = useRef(new Animated.Value(0.5)).current;
  const reqId = useRef(0);

  useEffect(() => {
    if (!text.trim()) {
      setLines([]);
      setLoading(false);
      return;
    }
    setLoading(true); // typing → show the skeleton until we settle
    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      const local = workoutNoteParser.parseLocal(text, weightUnit);
      const localLines = toLines(local, weightUnit);

      // Show whatever local could read right away — a typed set should never
      // vanish (or hang on "reading…") just because the name didn't match the
      // catalog. Local is best-effort but always honest about the sets it found.
      if (id === reqId.current && localLines.length > 0) {
        setLines(localLines);
        setLoading(false);
      }

      // Escalate to AI only when local wasn't confident (e.g. "DL"), purely to
      // refine the names. A failed or empty AI result must never blank a preview
      // local already produced.
      if (!localIsReasonable(local)) {
        try {
          const ai = await workoutNoteParser.parseWorkoutNote(text, weightUnit);
          const aiLines = toLines(ai, weightUnit);
          if (id === reqId.current && aiLines.length > 0) setLines(aiLines);
        } catch {
          // keep the local preview
        }
      }
      if (id === reqId.current) setLoading(false);
    }, PAUSE_MS);
    return () => clearTimeout(handle);
  }, [text, weightUnit]);

  useEffect(() => {
    if (!loading) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 550, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [loading, pulse]);

  if (!text.trim()) return null;

  if (loading) {
    return (
      <RNView style={styles.wrap}>
        <RNView style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <RNView style={styles.body}>
            <Animated.View style={[styles.barWide, { backgroundColor: colors.text + '22', opacity: pulse }]} />
            <Animated.View style={[styles.barNarrow, { backgroundColor: colors.text + '18', opacity: pulse }]} />
          </RNView>
          <Text style={[styles.reading, { color: colors.text + '66' }]}>reading…</Text>
        </RNView>
      </RNView>
    );
  }

  if (lines.length === 0) return null;

  return (
    <RNView style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { playHapticFeedback('medium', false); onCommit(); }}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <RNView style={styles.body}>
          {lines.map((line, i) => (
            <Text key={i} style={[styles.line, { color: colors.text }]} numberOfLines={1}>
              {line.name}  <Text style={{ color: colors.text + '99' }}>{line.summary}</Text>
            </Text>
          ))}
        </RNView>
        <RNView style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={20} color="#fff" />
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  body: { flex: 1, gap: 4, justifyContent: 'center' },
  line: { fontSize: 15 },
  reading: { fontSize: 12 },
  barWide: { height: 11, borderRadius: 6, width: '70%' },
  barNarrow: { height: 9, borderRadius: 5, width: '45%' },
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
