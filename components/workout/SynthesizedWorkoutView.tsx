// The "synthesized workout" that sits below the composer: every line of the
// note feed is folded into one consolidated, structured workout shown here as
// the user types or dictates. Local parsing is instant and free (cached per
// line); lines the local parser can't read are escalated to the AI parser once
// each, so tokens are spent only on genuinely ambiguous input — never per
// keystroke and never on the whole sheet.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ParsedSet } from '@/lib/workout/workoutNoteParser';
import {
  SynthesizedWorkout,
  synthesize,
  upgradeEntryWithAI,
} from '@/lib/workout/workoutSynthesis';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View as RNView } from 'react-native';

interface SynthesizedWorkoutViewProps {
  noteText: string;
  weightUnit: WeightUnit;
}

const DEBOUNCE_MS = 350;
const EMPTY: SynthesizedWorkout = { exercises: [], totalSets: 0, lowConfidenceLines: [] };

function setToken(set: ParsedSet): string {
  if (set.duration && set.duration > 0) {
    const mins = Math.round(set.duration / 60);
    return mins >= 1 ? `${mins}min` : `${set.duration}s`;
  }
  if (set.weight > 0) return `${set.weight}×${set.reps}`;
  return `×${set.reps}`;
}

export default function SynthesizedWorkoutView({ noteText, weightUnit }: SynthesizedWorkoutViewProps) {
  const { currentTheme } = useTheme();
  const [synth, setSynth] = useState<SynthesizedWorkout>(EMPTY);
  const [interpreting, setInterpreting] = useState(false);
  // Lines we've already sent to the AI parser, so we never re-escalate them.
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!noteText.trim()) {
      setSynth(EMPTY);
      return;
    }
    const handle = setTimeout(async () => {
      const local = synthesize(noteText, weightUnit);
      setSynth(local);

      const fresh = local.lowConfidenceLines.filter(l => !attempted.current.has(l));
      if (fresh.length === 0) return;
      fresh.forEach(l => attempted.current.add(l));

      setInterpreting(true);
      let changed = false;
      for (const line of fresh) {
        changed = (await upgradeEntryWithAI(line, weightUnit)) || changed;
      }
      setInterpreting(false);
      if (changed) setSynth(synthesize(noteText, weightUnit));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [noteText, weightUnit]);

  const hasContent = synth.exercises.length > 0;
  if (!noteText.trim() || (!hasContent && !interpreting)) return null;

  return (
    <RNView style={[styles.container, { borderTopColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.surface }]}>
      <RNView style={styles.header}>
        <Text style={[styles.title, { color: currentTheme.colors.text + 'AA', fontFamily: currentTheme.fonts.medium }]}>
          {hasContent
            ? `${synth.exercises.length} ${synth.exercises.length === 1 ? 'exercise' : 'exercises'} · ${synth.totalSets} ${synth.totalSets === 1 ? 'set' : 'sets'}`
            : 'Interpreting…'}
        </Text>
        {interpreting && <ActivityIndicator size="small" color={currentTheme.colors.primary} />}
      </RNView>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator>
        {synth.exercises.map(ex => (
          <RNView key={ex.key} style={styles.row}>
            <Ionicons
              name={ex.recognized ? 'checkmark-circle' : 'ellipse-outline'}
              size={15}
              color={ex.recognized ? currentTheme.colors.primary : currentTheme.colors.text + '40'}
            />
            <Text style={[styles.exName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]} numberOfLines={1}>
              {ex.name || 'Unnamed'}
            </Text>
            <Text style={[styles.exSets, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]} numberOfLines={1}>
              {ex.sets.map(setToken).join(', ')}
            </Text>
          </RNView>
        ))}
      </ScrollView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: 200,
    paddingTop: 8,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  list: {
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  exName: {
    fontSize: 14,
    flexShrink: 1,
  },
  exSets: {
    fontSize: 13,
    marginLeft: 'auto',
    flexShrink: 0,
  },
});
