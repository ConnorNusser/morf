// Pending-set preview shown below the composer. As you type it shows a quiet
// "reading…" skeleton (so it's obvious the set is being picked up); when you
// pause it resolves to a plain card of what will be added — styled like a normal
// set, not an AI suggestion. Local parse only (no tokens while typing).
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getWorkoutById } from '@/lib/workout/workouts';
import { matchExerciseByName } from '@/lib/workout/localWorkoutParser';
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
  summary?: string; // set summary; absent = a recognized exercise to add (no sets yet)
}

function toLines(parsed: { exercises: { name: string; matchedExerciseId?: string; sets: ParsedSet[] }[] }, unit: WeightUnit): PreviewLine[] {
  return parsed.exercises
    // A real set has reps. The AI sometimes guesses an exercise name from a
    // fragment and returns a 0×0 set — drop those so they don't render as blanks.
    .map(ex => ({ ...ex, sets: ex.sets.filter(s => s.reps > 0) }))
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
      const settle = (next: PreviewLine[]) => { if (id === reqId.current) { setLines(next); setLoading(false); } };
      const refine = (next: PreviewLine[]) => { if (id === reqId.current && next.length > 0) setLines(next); };

      const local = workoutNoteParser.parseLocal(text, weightUnit);
      const localLines = toLines(local, weightUnit);
      const looksLikeSet = /\d/.test(text);
      const trimmed = text.trim();

      // 1) Local read sets — show them now, and refine names via AI in the
      //    background (never blanking what we already showed).
      if (localLines.length > 0) {
        settle(localLines);
        if (!localIsReasonable(local)) {
          try { refine(toLines(await workoutNoteParser.parseWorkoutNote(text, weightUnit), weightUnit)); } catch { /* keep local */ }
        }
        return;
      }

      // 2) Looks like a set we couldn't read (e.g. "DL 225x5", odd phrasing) —
      //    let the AI interpret it once.
      if (looksLikeSet) {
        try { settle(toLines(await workoutNoteParser.parseWorkoutNote(text, weightUnit), weightUnit)); }
        catch { settle([]); }
        return;
      }

      // 3) Name only, no sets yet — recognize the exercise so it can be added
      //    (its sets autofill from last time). Local abbreviations resolve free;
      //    fall back to AI for names the matcher doesn't know.
      const localId = matchExerciseByName(trimmed);
      if (localId) { settle([{ name: getWorkoutById(localId)?.name || trimmed }]); return; }
      if (/[a-z]/i.test(trimmed) && trimmed.length >= 3) {
        try {
          const first = (await workoutNoteParser.parseWorkoutNote(text, weightUnit)).exercises[0];
          const nm = first ? (first.matchedExerciseId ? getWorkoutById(first.matchedExerciseId)?.name || first.name : first.name) : null;
          settle(nm ? [{ name: nm }] : []);
        } catch { settle([]); }
        return;
      }
      settle([]);
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
              {line.name}  <Text style={{ color: colors.text + (line.summary ? '99' : '66') }}>{line.summary || 'add exercise'}</Text>
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
