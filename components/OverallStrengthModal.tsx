import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import ProgressBar from '@/components/ProgressBar';
import RadarChart from '@/components/RadarChart';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { AGE_ADJUSTMENT_FACTORS, FEMALE_STANDARDS, getAgeCategory, getNextTierInfo, getStrengthLevelName, getStrengthTier, getTierColor, MALE_STANDARDS, RADAR_TIER_THRESHOLDS } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { userSyncService } from '@/lib/userSyncService';
import { calculateOverallPercentile } from '@/lib/utils';
import { UserProfile, UserProgress } from '@/types';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

interface OverallStrengthModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function OverallStrengthModal({ visible, onClose }: OverallStrengthModalProps) {
  const { currentTheme } = useTheme();
  const [lifts, setLifts] = useState<UserProgress[]>([]);
  const [_isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isGroupPanelOpen, setIsGroupPanelOpen] = useState<boolean>(false);
  const [cardAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    const load = async () => {
      try {
        setIsLoading(true);
        const [data, p] = await Promise.all([
          userService.getAllFeaturedLifts(),
          userService.getUserProfileOrDefault(),
        ]);
        setLifts(data);
        setProfile(p);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [visible]);

  // Build category averages across ALL lifts using ONLY primary muscles
  const chartData = useMemo(() => {
    const muscleGroups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes'] as const;
    const liftToMuscles: Record<string, string[]> = {};
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy import for circular dependency avoidance
    const { ALL_WORKOUTS } = require('@/lib/workouts');
    ALL_WORKOUTS.forEach((w: { id: string; primaryMuscles?: string[] }) => {
      liftToMuscles[w.id] = [...(w.primaryMuscles || [])];
    });

    const groupToValues: Record<string, number[]> = {};
    muscleGroups.forEach(g => (groupToValues[g] = []));

    lifts.forEach(l => {
      const groups = liftToMuscles[l.workoutId] || [];
      groups.forEach(g => {
        if (g in groupToValues && l.percentileRanking > 0) groupToValues[g].push(l.percentileRanking);
      });
    });

    const toAvg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    return muscleGroups.map(g => ({ label: g.charAt(0).toUpperCase() + g.slice(1), value: toAvg(groupToValues[g]) }));
  }, [lifts]);

  const tooltipDetails = useMemo(() => {
    const byGroup: Record<string, { name: string; pct: number }[]> = {};
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy import for circular dependency avoidance
    const { getWorkoutById } = require('@/lib/workouts');
    lifts.forEach(l => {
      const w = getWorkoutById(l.workoutId);
      if (!w) return;
      const primaryGroups = [...(w.primaryMuscles || [])];
      primaryGroups.forEach(g => {
        if (!byGroup[g]) byGroup[g] = [];
        if (l.percentileRanking > 0) byGroup[g].push({ name: w.name, pct: l.percentileRanking });
      });
    });
    const toLines = (g: string) => {
      const key = g.toLowerCase();
      const list = (byGroup[key] || []).sort((a, b) => b.pct - a.pct).slice(0, 5);
      if (list.length === 0) return ['No recorded lifts', 'Tip: Record a lift to unlock insights'];
      return list.map(i => `${i.name}: ${i.pct}%`);
    };
    return (chartData || []).map(d => ({ lines: toLines(d.label) }));
  }, [lifts, chartData]);

  const groupInfos = useMemo(() => {
    const map: Record<string, { id: string; name: string; pct: number; oneRM: number }[]> = {};
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy import for circular dependency avoidance
    const { getWorkoutById } = require('@/lib/workouts');
    lifts.forEach(l => {
      const w = getWorkoutById(l.workoutId);
      if (!w) return;
      const groups = w.primaryMuscles || [];
      groups.forEach((g: string) => {
        const key = g.toLowerCase();
        if (!map[key]) map[key] = [];
        map[key].push({ id: l.workoutId, name: w.name, pct: l.percentileRanking, oneRM: l.personalRecord });
      });
    });
    Object.keys(map).forEach(k => map[k].sort((a, b) => b.pct - a.pct));
    return map;
  }, [lifts]);

  const _openGroupPanel = (index: number) => {
    setSelectedIdx(index);
    setIsGroupPanelOpen(true);
  };
  const closeGroupPanel = () => setIsGroupPanelOpen(false);

  useEffect(() => {
    if (selectedIdx >= 0) {
      cardAnim.setValue(0);
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [selectedIdx, cardAnim]);

  // Match overall calculation with the home screen: average of all non-zero lift percentiles
  const overallPercentile = useMemo(() => {
    const nonZero = lifts.map(l => l.percentileRanking).filter(p => p > 0);
    return calculateOverallPercentile(nonZero);
  }, [lifts]);
  const _overallLevel = getStrengthLevelName(overallPercentile);

  const getPercentileColor = (percentile: number) => {
    const tier = getStrengthTier(percentile);
    return getTierColor(tier);
  };

  const sortedLifts = useMemo(() => {
    return lifts
      .sort((a, b) => b.percentileRanking - a.percentileRanking);
  }, [lifts]);

  // Sync percentile data to Supabase when modal is visible and data is loaded
  useEffect(() => {
    if (!visible || lifts.length === 0) return;

    userSyncService.calculateAndSyncPercentiles().catch(err => {
      console.error('Error syncing percentile data:', err);
    });
  }, [visible, lifts.length]);

  const bestGroup = useMemo(() => chartData.reduce((best, cur) => (cur.value > best.value ? cur : best), chartData[0] || { label: '', value: 0 }), [chartData]);
  const weakGroup = useMemo(() => chartData.reduce((weak, cur) => (cur.value < weak.value ? cur : weak), chartData[0] || { label: '', value: 0 }), [chartData]);

  const nextTargets = useMemo(() => {
    if (!profile) return [] as { id: string; name: string; current: number; target: number; delta: number }[];
    const gender = profile.gender;
    const bodyWeight = profile.weight.unit === 'kg' ? Math.round(profile.weight.value * 2.20462) : profile.weight.value;
    const ageFactor = profile.age ? AGE_ADJUSTMENT_FACTORS[getAgeCategory(profile.age)] : 1.0;
    const byId: Record<string, UserProgress> = {};
    lifts.forEach(l => (byId[l.workoutId] = l));
    const allIds = Object.keys(byId);
    return allIds
      .map(id => {
        const current = byId[id].personalRecord;
        const standards = (gender === 'male' ? MALE_STANDARDS : FEMALE_STANDARDS)[id];
        if (!standards) return null;
        const pct = byId[id].percentileRanking;
        const next = pct >= 90 ? null : pct >= 75 ? standards.god : pct >= 50 ? standards.elite : pct >= 25 ? standards.advanced : pct >= 10 ? standards.intermediate : standards.beginner;
        if (!next) return null;
        const target = Math.round(next * bodyWeight * ageFactor);
        return { id, name: id.replace('-', ' '), current, target, delta: Math.max(0, target - current) };
      })
      .filter(Boolean) as { id: string; name: string; current: number; target: number; delta: number }[];
  }, [lifts, profile]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <View style={styles.headerSpacer} />
          <Text style={[styles.modalHeaderTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            Overall Strength
          </Text>
          <IconButton icon="close" onPress={onClose} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.subtitle, { color: currentTheme.colors.text }]}>Radar shows your percentile per main lift</Text>
          </View>

          <Card variant="surface" style={styles.chartCard}>
            <View style={{ ...styles.chartHeader}}>
              {/* Header with Tier Badge and Percentile */}
              <View style={styles.tierHeaderRow}>
                <TierBadge percentile={overallPercentile} size="large" />
                <View style={styles.heroNumberBlock}>
                  <Text style={[styles.heroNumber, { color: currentTheme.colors.text }]}>{overallPercentile}</Text>
                  <Text style={[styles.heroSub, { color: currentTheme.colors.text + '80' }]}>percentile</Text>
                </View>
              </View>
              <ProgressBar progress={overallPercentile} height={10} style={{ marginVertical: 12, width: '100%' }} exerciseName="overall" />
              <Text style={[styles.heroHint, { color: currentTheme.colors.text + '90' }]}>
                {!getNextTierInfo(overallPercentile).next
                  ? `Maximum Tier Reached!`
                  : `+${getNextTierInfo(overallPercentile).needed}% to ${getNextTierInfo(overallPercentile).next} Tier`}
              </Text>
            </View>
            <RadarChart data={chartData} tiers={RADAR_TIER_THRESHOLDS} selectedIndex={selectedIdx} onPointPress={(i) => setSelectedIdx(i)} details={tooltipDetails} inlineTooltip={false} />
          </Card>

          {/* Selected group insight card */}
          {selectedIdx >= 0 && chartData[selectedIdx] && (
            <Animated.View style={{
              opacity: cardAnim,
              transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}>
            <Card variant="surface" style={{ ...styles.standardCard, backgroundColor: 'transparent' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.sheetTitle, { color: currentTheme.colors.text, backgroundColor: 'transparent' }]}>
                  {chartData[selectedIdx].label}
                </Text>
                <TouchableOpacity onPress={() => setSelectedIdx(-1)}>
                  <Text style={[styles.questSubtitle, { color: currentTheme.colors.text }]}>Clear</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.sheetPercent, { color: currentTheme.colors.primary }]}>{chartData[selectedIdx].value}%</Text>
              <Text style={[styles.sheetSubtitle, { color: currentTheme.colors.text }]}>Top contributors</Text>
              {(groupInfos[chartData[selectedIdx].label.toLowerCase()] || []).slice(0, 6).map(item => (
                <View key={item.id} style={styles.sheetRow}>
                  <Text style={[styles.sheetLift, { color: currentTheme.colors.text }]}>{item.name}</Text>
                  <Text style={[styles.sheetValue, { color: currentTheme.colors.text }]}>{item.pct}%</Text>
                </View>
              ))}
            </Card>
            </Animated.View>
          )}

          {/* Target Weights Card (replaces quest) */}
          <Card variant="surface" style={{ ...styles.standardCard, backgroundColor: 'transparent' }}>
            <View style={[styles.questHeaderRow, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.questTitle, { color: currentTheme.colors.text }]}>Next Tier Targets</Text>
              <Text style={[styles.questSubtitle, { color: currentTheme.colors.text + '90', backgroundColor: 'transparent' }]}>
                {getNextTierInfo(overallPercentile).current} → {getNextTierInfo(overallPercentile).next || 'MAX'}
              </Text>
            </View>
            {nextTargets.map(t => (
              <View key={t.id} style={styles.targetBlock}>
              <View style={[styles.targetHeaderRow, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.targetName, { color: currentTheme.colors.text, backgroundColor: 'transparent' }]}>{t.name}</Text>
                  <View style={[styles.deltaBadge, { backgroundColor: currentTheme.colors.primary }]}>
                    <Text style={[styles.deltaText, { color: currentTheme.colors.background }]}>+{t.delta}</Text>
                  </View>
                </View>
                <ProgressBar
                  progress={Math.min(100, Math.round((t.current / t.target) * 100))}
                  height={6}
                  style={styles.targetProgress}
                  exerciseName={`target-${t.id}`}
                />
                <View style={styles.targetValuesRow}>
                  <Text style={[styles.targetValue, { color: currentTheme.colors.text }]}>{t.current} now</Text>
                  <Text style={[styles.targetValue, { color: currentTheme.colors.text }]}>{t.target} goal</Text>
                </View>
              </View>
            ))}
          </Card>

          <Card variant="surface" style={styles.liftsCard}>
            <View style={styles.insightRow}>
              <Text style={[styles.insightText, { color: currentTheme.colors.text }]}>
                {`Strongest: ${bestGroup.label} • Weakest: ${weakGroup.label}`}
              </Text>
            </View>
            {sortedLifts.map((l, _i) => (
              <View key={l.workoutId} style={styles.liftRow}>
                <Text style={[styles.liftName, { color: currentTheme.colors.text }]}>{l.workoutId.replace('-', ' ')}</Text>
                <View style={styles.rowRight}>
                  <Text style={[styles.liftValue, { color: getPercentileColor(l.percentileRanking) }]}>{l.percentileRanking}</Text>
                  <View style={[styles.percentileBadge, { backgroundColor: getPercentileColor(l.percentileRanking) }]}>
                    <Text style={[styles.percentileText, { color: currentTheme.colors.background }]}>{l.strengthLevel}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        </ScrollView>

        {/* Group detail sheet */}
        {isGroupPanelOpen && selectedIdx >= 0 && chartData[selectedIdx] && (
          <Modal visible transparent animationType="fade" onRequestClose={closeGroupPanel}>
            <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeGroupPanel}>
              <View />
            </TouchableOpacity>
            <View style={[styles.sheet, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}> 
              <Text style={[styles.sheetTitle, { color: currentTheme.colors.text }]}>{chartData[selectedIdx].label}</Text>
              <Text style={[styles.sheetPercent, { color: currentTheme.colors.primary }]}>{chartData[selectedIdx].value}%</Text>
              <Text style={[styles.sheetSubtitle, { color: currentTheme.colors.text }]}>Top contributors</Text>
              {(groupInfos[chartData[selectedIdx].label.toLowerCase()] || []).slice(0, 6).map(item => (
                <View key={item.id} style={styles.sheetRow}>
                  <Text style={[styles.sheetLift, { color: currentTheme.colors.text }]}>{item.name}</Text>
                  <Text style={[styles.sheetValue, { color: currentTheme.colors.text }]}>{item.pct}%</Text>
                </View>
              ))}
              <TouchableOpacity style={[styles.sheetClose, { borderColor: currentTheme.colors.border }]} onPress={closeGroupPanel}>
                <Text style={[styles.closeText, { color: currentTheme.colors.text }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalHeaderTitle: {
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
  },
  content: { padding: 20, paddingTop: 16 },
  header: { alignItems: 'center', marginBottom: 8, backgroundColor: 'transparent' },
  subtitle: { fontSize: 12, opacity: 0.7 },
  chartCard: { marginTop: 8 },
  chartHeader: { alignItems: 'center', marginBottom: 8, backgroundColor: 'transparent' },
  headerStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  overallNumberBlock: { alignItems: 'center', backgroundColor: 'transparent' },
  overallValue: { fontSize: 32, fontWeight: '700', lineHeight: 36 },
  overallLabel: { fontSize: 12, opacity: 0.7 },
  heroTitle: { fontSize: 18, fontWeight: '700', opacity: 0.9, marginBottom: 6, letterSpacing: 0.3 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', backgroundColor: 'transparent' },
  tierHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', backgroundColor: 'transparent' },
  heroNumberBlock: { alignItems: 'flex-end', backgroundColor: 'transparent' },
  heroNumber: { fontSize: 36, fontWeight: '800' },
  heroSub: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 },
  heroHint: { marginTop: 6, fontSize: 12, opacity: 0.8 },
  liftsCard: { marginTop: 16, paddingTop: 12, paddingBottom: 12 },
  standardCard: { marginTop: 8, paddingTop: 12, paddingBottom: 12 },
  liftRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#00000010', backgroundColor: 'transparent' },
  liftName: { textTransform: 'capitalize' },
  liftValue: { width: 42, textAlign: 'right', fontVariant: ['tabular-nums'] },
  liftLevel: { width: 96, textAlign: 'right' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' },
  closeText: { textAlign: 'center', fontWeight: '600' },
  tierLegendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 },
  tierChip: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  tierChipText: { fontSize: 12, fontWeight: '600' },
  tierChipPct: { fontSize: 11, opacity: 0.7 },
  percentileBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  percentileText: { fontSize: 12, fontWeight: '600' },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: 'transparent' },
  insightEmoji: { fontSize: 16 },
  insightText: { fontSize: 12, opacity: 0.8 },
  questCard: { marginTop: 12, paddingTop: 12, paddingBottom: 12 },
  questHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  questTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  questSubtitle: { fontSize: 12, opacity: 0.8 },
  questProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  questNeeded: { fontSize: 12, fontWeight: '700' },
  questChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  questChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  questChipText: { fontSize: 12, fontWeight: '600' },
  questArrow: { fontSize: 14, opacity: 0.7 },
  targetBlock: { marginBottom: 10, backgroundColor: 'transparent' },
  targetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, backgroundColor: 'transparent' },
  targetName: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  deltaBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  deltaText: { fontSize: 12, fontWeight: '700' },
  targetProgress: { marginBottom: 6 },
  targetValuesRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'transparent' },
  targetValue: { fontSize: 12, opacity: 0.8 },
  sheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { position: 'absolute', left: 20, right: 20, bottom: 24, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  sheetPercent: { fontSize: 28, fontWeight: '800', marginBottom: 6 },
  sheetSubtitle: { fontSize: 12, opacity: 0.8, marginBottom: 6 },
  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent', backgroundColor: 'transparent' },
  sheetLift: { fontSize: 14 },
  sheetValue: { fontSize: 14, fontWeight: '700' },
  sheetClose: { marginTop: 8, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
});

