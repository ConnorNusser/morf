// Live, as-you-type confirmation of what the workout note parser sees. Runs the
// fast offline parse (no AI round trip) on a short debounce and shows one chip
// per exercise, so a misparse or unrecognized lift surfaces immediately instead
// of at the finish screen. This is the freeform answer to structured logging:
// type/dictate fast, but still get structured feedback you can trust.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ParsedSet, workoutNoteParser } from '@/lib/workout/workoutNoteParser';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View as RNView } from 'react-native';

interface LiveParsePreviewProps {
  noteText: string;
  weightUnit: WeightUnit;
}

const DEBOUNCE_MS = 250;

interface PreviewChip {
  name: string;
  recognized: boolean; // matched a real exercise vs. will be saved as custom
  summary: string;
  setCount: number;
}

function summarizeSets(sets: ParsedSet[]): string {
  return sets
    .map(s => {
      if (s.duration && s.duration > 0) {
        const mins = Math.round(s.duration / 60);
        return mins >= 1 ? `${mins}min` : `${s.duration}s`;
      }
      if (s.weight > 0) return `${s.weight}×${s.reps}`;
      return `×${s.reps}`;
    })
    .join(', ');
}

export default function LiveParsePreview({ noteText, weightUnit }: LiveParsePreviewProps) {
  const { currentTheme } = useTheme();
  const [chips, setChips] = useState<PreviewChip[]>([]);

  useEffect(() => {
    if (!noteText.trim()) {
      setChips([]);
      return;
    }
    const handle = setTimeout(() => {
      const parsed = workoutNoteParser.parseLocal(noteText, weightUnit);
      setChips(
        parsed.exercises.map(ex => ({
          name: ex.name.trim(),
          recognized: !!ex.matchedExerciseId && !ex.isCustom,
          summary: summarizeSets(ex.sets),
          setCount: ex.sets.length,
        })),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [noteText, weightUnit]);

  if (chips.length === 0) return null;

  return (
    <RNView style={[styles.container, { borderTopColor: currentTheme.colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {chips.map((chip, i) => {
          const accent = chip.recognized ? currentTheme.colors.primary : currentTheme.colors.accent;
          return (
            <RNView
              key={`${chip.name}-${i}`}
              style={[styles.chip, { backgroundColor: accent + '12', borderColor: accent + '30' }]}
            >
              <Ionicons
                name={chip.recognized ? 'checkmark-circle' : 'add-circle-outline'}
                size={14}
                color={accent}
              />
              <RNView style={styles.chipText}>
                <Text style={[styles.chipName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]} numberOfLines={1}>
                  {chip.name || 'Unnamed'}
                </Text>
                {!!chip.summary && (
                  <Text style={[styles.chipSummary, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]} numberOfLines={1}>
                    {chip.summary}
                  </Text>
                )}
              </RNView>
            </RNView>
          );
        })}
      </ScrollView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 200,
  },
  chipText: {
    backgroundColor: 'transparent',
  },
  chipName: {
    fontSize: 13,
  },
  chipSummary: {
    fontSize: 11,
    marginTop: 1,
  },
});
