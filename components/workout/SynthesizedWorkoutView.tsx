// The synthesized workout — the hero of the logging screen. Every line of the
// note feed is folded into a structured workout and rendered here as proper
// exercise cards with set rows, so what you type/dictate immediately becomes
// the workout you'll save. Local parsing is instant and free (cached per line);
// lines the local parser can't read are escalated to the AI parser once each,
// so tokens are spent only on genuinely ambiguous input. Changes animate in as
// you finish each line.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ParsedSet } from '@/lib/workout/workoutNoteParser';
import {
  SynthesizedExercise,
  SynthesizedWorkout,
  synthesize,
  upgradeEntryWithAI,
} from '@/lib/workout/workoutSynthesis';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Platform, ScrollView, StyleSheet, UIManager, View as RNView } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SynthesizedWorkoutViewProps {
  noteText: string;
  weightUnit: WeightUnit;
}

const DEBOUNCE_MS = 350;
const EMPTY: SynthesizedWorkout = { exercises: [], totalSets: 0, lowConfidenceLines: [] };

function setValue(set: ParsedSet, unit: WeightUnit): string {
  if (set.duration && set.duration > 0) {
    const mins = Math.round(set.duration / 60);
    return mins >= 1 ? `${mins} min` : `${set.duration}s`;
  }
  if (set.weight > 0) return `${set.weight} ${unit} × ${set.reps}`;
  return `${set.reps} reps`;
}

function ExerciseCard({ exercise, unit }: { exercise: SynthesizedExercise; unit: WeightUnit }) {
  const { currentTheme } = useTheme();
  return (
    <RNView style={[styles.card, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
      <RNView style={styles.cardHeader}>
        <Ionicons
          name={exercise.recognized ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={exercise.recognized ? currentTheme.colors.primary : currentTheme.colors.text + '40'}
        />
        <Text style={[styles.exName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]} numberOfLines={1}>
          {exercise.name || 'Unnamed exercise'}
        </Text>
        <Text style={[styles.setCount, { color: currentTheme.colors.text + '66', fontFamily: currentTheme.fonts.medium }]}>
          {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
        </Text>
      </RNView>
      {exercise.sets.map((set, i) => (
        <RNView key={i} style={[styles.setRow, { borderTopColor: currentTheme.colors.border + '80' }]}>
          <Text style={[styles.setLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
            Set {i + 1}
          </Text>
          <Text style={[styles.setValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
            {setValue(set, unit)}
          </Text>
        </RNView>
      ))}
    </RNView>
  );
}

export default function SynthesizedWorkoutView({ noteText, weightUnit }: SynthesizedWorkoutViewProps) {
  const { currentTheme } = useTheme();
  const [synth, setSynth] = useState<SynthesizedWorkout>(EMPTY);
  const [interpreting, setInterpreting] = useState(false);
  // Lines already sent to the AI parser, so we never re-escalate them.
  const attempted = useRef<Set<string>>(new Set());

  // Animate every synthesis update so cards/sets slide in as the log builds.
  const applySynth = (next: SynthesizedWorkout) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setSynth(next);
  };

  useEffect(() => {
    if (!noteText.trim()) {
      applySynth(EMPTY);
      return;
    }
    const handle = setTimeout(async () => {
      const local = synthesize(noteText, weightUnit);
      applySynth(local);

      const fresh = local.lowConfidenceLines.filter(l => !attempted.current.has(l));
      if (fresh.length === 0) return;
      fresh.forEach(l => attempted.current.add(l));

      setInterpreting(true);
      let changed = false;
      for (const line of fresh) {
        changed = (await upgradeEntryWithAI(line, weightUnit)) || changed;
      }
      setInterpreting(false);
      if (changed) applySynth(synthesize(noteText, weightUnit));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [noteText, weightUnit]);

  const hasContent = synth.exercises.length > 0;

  if (!noteText.trim()) return null;

  return (
    <RNView style={styles.container}>
      <RNView style={styles.header}>
        <Text style={[styles.title, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.semiBold }]}>
          {hasContent
            ? `${synth.exercises.length} ${synth.exercises.length === 1 ? 'exercise' : 'exercises'} · ${synth.totalSets} ${synth.totalSets === 1 ? 'set' : 'sets'}`
            : 'Reading your workout…'}
        </Text>
        {interpreting && <ActivityIndicator size="small" color={currentTheme.colors.primary} />}
      </RNView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {synth.exercises.map(ex => (
          <ExerciseCard key={ex.key} exercise={ex} unit={weightUnit} />
        ))}
      </ScrollView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  exName: {
    fontSize: 16,
    flexShrink: 1,
  },
  setCount: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setLabel: {
    fontSize: 13,
  },
  setValue: {
    fontSize: 15,
  },
});
