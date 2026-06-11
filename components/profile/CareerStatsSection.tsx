import Card from '@/components/Card';
import CareerModal from '@/components/gamification/CareerModal';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { computeCareerStats, formatCompact } from '@/lib/gamification/careerStats';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Summary {
  overall: number;
  tier: StrengthTier;
  totalVolume: number;
  totalWorkouts: number;
  currentStreak: number;
  unit: WeightUnit;
}

export default function CareerStatsSection() {
  const { currentTheme } = useTheme();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showCareer, setShowCareer] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [history, profile, lifts, filters] = await Promise.all([
            storageService.getWorkoutHistory(),
            userService.getUserProfileOrDefault(),
            userService.getAllFeaturedLifts(),
            storageService.getLiftDisplayFilters(),
          ]);
          if (!active) return;
          const unit = profile.weightUnitPreference || 'lbs';
          const stats = computeCareerStats(history, unit);
          const visible = lifts.filter(l => !filters.hiddenLiftIds.includes(l.workoutId));
          const overall = visible.length
            ? calculateOverallPercentile(visible.map(l => l.percentileRanking))
            : 0;
          setSummary({
            overall,
            tier: getStrengthTier(overall),
            totalVolume: stats.totalVolume,
            totalWorkouts: stats.totalWorkouts,
            currentStreak: stats.currentStreak,
            unit,
          });
        } catch (err) {
          console.error('CareerStatsSection: failed to load', err);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  if (!summary) return null;

  const color = getTierColor(summary.tier);
  const parts = [
    `${formatCompact(summary.totalVolume)} ${summary.unit} lifted`,
    `${summary.totalWorkouts} workout${summary.totalWorkouts === 1 ? '' : 's'}`,
  ];
  if (summary.currentStreak > 0) parts.push(`${summary.currentStreak}d streak`);

  return (
    <>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setShowCareer(true)}>
        <Card variant="elevated" style={styles.card}>
          <View style={[styles.tierBadge, { borderColor: color }]}>
            <Text style={[styles.tierText, { color }]}>{summary.tier}</Text>
          </View>
          <View style={styles.body}>
            <Text style={[styles.title, { color: currentTheme.colors.text }]}>Career</Text>
            <Text style={[styles.subtitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
              {parts.join(' · ')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.colors.text + '70'} />
        </Card>
      </TouchableOpacity>

      <CareerModal visible={showCareer} onClose={() => setShowCareer(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tierBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierText: { fontSize: 20, fontWeight: '800' },
  body: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13, opacity: 0.6, marginTop: 2 },
});
