// Profile style D: a stat sheet under the hero. Overall strength first, then
// each featured lift with its best e1RM and its own tier letter (tier color is
// the only color here). Tapping a lift opens its history.
import ExerciseHistoryModal from '@/components/history/ExerciseHistoryModal';
import { Text, useInk } from '@/components/Themed';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { buildExerciseStats } from '@/lib/history/exerciseStats';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { radius, space } from '@/lib/ui/tokens';
import { getPercentileSuffix } from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { convertWeight, ExerciseWithMax, UserProgress, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const MAX_LIFTS = 5;

const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

interface Props {
  tier: StrengthTier | null | undefined;
  overallPercentile: number;
}

export default function ProfileStatSheet({ tier, overallPercentile }: Props) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { userProfile } = useUser();
  const { customExercises } = useCustomExercises();
  const unit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';
  const [lifts, setLifts] = useState<UserProgress[]>([]);
  const [selected, setSelected] = useState<ExerciseWithMax | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([userService.getAllFeaturedLifts(), storageService.getLiftDisplayFilters()])
        .then(([all, filters]) => {
          if (!active) return;
          setLifts(all.filter(l => !filters.hiddenLiftIds.includes(l.workoutId) && l.personalRecord > 0).slice(0, MAX_LIFTS));
        })
        .catch(error => console.error('Error loading profile lifts:', error));
      return () => {
        active = false;
      };
    }, []),
  );

  const openLift = async (id: string) => {
    const history = await storageService.getWorkoutHistory();
    const stats = buildExerciseStats(history, customExercises, unit).find(e => e.id === id);
    if (stats) setSelected(stats);
  };

  const ranked = !!tier && overallPercentile > 0;
  const band = getTierBandProgress(overallPercentile);
  const tierColor = (t: string) => {
    const c = getTierColor(t as StrengthTier);
    // E/D are gray; read them as ink so gray never looks like a hue.
    return t.startsWith('E') || t.startsWith('D') ? ink.secondary : c;
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.sheet, { backgroundColor: currentTheme.colors.surface, borderColor: ink.hairline }]}>
        <View style={styles.row}>
          <Text variant="body" weight="bold" tone="primary" style={styles.name}>Overall</Text>
          <Text variant="meta" tone="muted" style={styles.value}>
            {ranked ? `${overallPercentile}${getPercentileSuffix(overallPercentile)} pct` : '—'}
          </Text>
          <Text variant="emphasis" weight="bold" style={[styles.tier, { color: ranked ? tierColor(tier!) : ink.muted }]}>
            {ranked ? tier : '—'}
          </Text>
          <View style={styles.chevronSlot} />
        </View>

        {lifts.map(l => (
          <TouchableOpacity
            key={l.workoutId}
            onPress={() => openLift(l.workoutId)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${shortName(getExercise(l.workoutId)?.name ?? l.workoutId)} history`}
            style={[styles.row, { borderTopColor: ink.hairline, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <Text variant="body" tone="primary" style={styles.name} numberOfLines={1}>
              {shortName(getExercise(l.workoutId)?.name ?? l.workoutId)}
            </Text>
            <Text variant="meta" tone="muted" style={styles.value}>
              {Math.round(convertWeight(l.personalRecord, 'lbs', unit))} {unit}
            </Text>
            <Text variant="emphasis" weight="bold" style={[styles.tier, { color: tierColor(l.strengthLevel) }]}>
              {l.strengthLevel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={ink.faint} />
          </TouchableOpacity>
        ))}
      </View>

      <Text variant="meta" tone="muted">
        {ranked
          ? `${band.nextTier ? `${band.toNext} percentile to ${band.nextTier}` : 'Top tier'}${lifts.length ? ' · tap a lift for its history' : ''}`
          : 'Log a ranked lift to get a tier'}
      </Text>

      <ExerciseHistoryModal exercise={selected} weightUnit={unit} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginBottom: space.lg },
  sheet: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  name: { flex: 1 },
  value: { minWidth: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
  tier: { minWidth: 40, textAlign: 'right' },
  chevronSlot: { width: 14 },
});
