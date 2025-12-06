import Card from '@/components/Card';
import ProgressBar from '@/components/ProgressBar';
import RadarChart from '@/components/RadarChart';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierInfo, getTierColor, StrengthTier } from '@/lib/strengthStandards';
import { MuscleGroupPercentiles, TopContribution } from '@/types';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface StrengthRadarCardProps {
  overallPercentile: number;
  strengthLevel: string;
  muscleGroups: MuscleGroupPercentiles;
  topContributions: TopContribution[];
  showContributions?: boolean;
}

export default function StrengthRadarCard({
  overallPercentile,
  strengthLevel,
  muscleGroups,
  topContributions,
  showContributions = true,
}: StrengthRadarCardProps) {
  const { currentTheme } = useTheme();
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  // Get tier info with color
  const _tierInfo = useMemo(() => getTierInfo(overallPercentile), [overallPercentile]);
  const tierColor = getTierColor(strengthLevel as StrengthTier);

  const tiers = useMemo(
    () => [
      { label: 'E', threshold: 0 },
      { label: 'D', threshold: 6 },
      { label: 'C', threshold: 23 },
      { label: 'B', threshold: 47 },
      { label: 'A', threshold: 70 },
      { label: 'S', threshold: 85 },
    ],
    []
  );

  const chartData = useMemo(() => {
    const groups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes'] as const;
    return groups.map(g => ({
      label: g.charAt(0).toUpperCase() + g.slice(1),
      value: muscleGroups[g] || 0,
    }));
  }, [muscleGroups]);

  const tooltipDetails = useMemo(() => {
    // Group top contributions by muscle group
    const byGroup: Record<string, { name: string; pct: number }[]> = {};
    topContributions.forEach(c => {
      if (!byGroup['all']) byGroup['all'] = [];
      byGroup['all'].push({ name: c.name, pct: c.percentile });
    });

    return chartData.map(() => ({
      lines: byGroup['all']?.slice(0, 3).map(i => `${i.name}: ${i.pct}%`) || ['No data'],
    }));
  }, [chartData, topContributions]);

  const getNextTierInfo = (value: number) => {
    const thresholds = [
      { label: 'E', threshold: 10 },
      { label: 'D', threshold: 25 },
      { label: 'C', threshold: 50 },
      { label: 'B', threshold: 75 },
      { label: 'A', threshold: 90 },
      { label: 'S', threshold: 95 },
    ];
    const next = thresholds.find(t => t.threshold > value);
    if (!next) return { label: 'MAX', needed: 0 };
    return { label: next.label, needed: next.threshold - value };
  };

  const bestGroup = useMemo(
    () => chartData.reduce((best, cur) => (cur.value > best.value ? cur : best), chartData[0] || { label: '', value: 0 }),
    [chartData]
  );

  const weakGroup = useMemo(
    () => chartData.reduce((weak, cur) => (cur.value < weak.value && cur.value > 0 ? cur : weak), chartData[0] || { label: '', value: 0 }),
    [chartData]
  );

  const nextTier = getNextTierInfo(overallPercentile);

  return (
    <Card variant="surface" style={styles.card}>
      {/* Header with Tier and Percentile */}
      <View style={[styles.headerRow, { backgroundColor: 'transparent' }]}>
        {/* Tier Badge */}
        <View style={[styles.tierBadge, { backgroundColor: tierColor + '20', borderColor: tierColor }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>
            {strengthLevel}
          </Text>
        </View>

        {/* Percentile */}
        <View style={[styles.percentileBlock, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.percentileNumber, { color: currentTheme.colors.text }]}>
            {overallPercentile}
          </Text>
          <Text style={[styles.percentileSub, { color: currentTheme.colors.text + '80' }]}>
            percentile
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <ProgressBar progress={overallPercentile} height={8} style={{ marginVertical: 12 }} exerciseName="overall" />

      {/* Next Tier Hint */}
      <Text style={[styles.nextTierHint, { color: currentTheme.colors.text + '70' }]}>
        {nextTier.needed > 0 ? `+${nextTier.needed}% to ${nextTier.label} Tier` : 'Maximum Tier Reached!'}
      </Text>

      {/* Radar Chart */}
      <RadarChart
        data={chartData}
        tiers={tiers}
        selectedIndex={selectedIdx}
        onPointPress={(i) => setSelectedIdx(i)}
        details={tooltipDetails}
        inlineTooltip={false}
      />

      {/* Selected group insight */}
      {selectedIdx >= 0 && chartData[selectedIdx] && (
        <View style={[styles.selectedGroup, { backgroundColor: currentTheme.colors.background }]}>
          <View style={[styles.selectedHeader, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.selectedTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              {chartData[selectedIdx].label}
            </Text>
            <TouchableOpacity onPress={() => setSelectedIdx(-1)}>
              <Text style={[styles.clearText, { color: currentTheme.colors.text + '60' }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.selectedPercent, { color: currentTheme.colors.primary }]}>
            {chartData[selectedIdx].value}%
          </Text>
        </View>
      )}

      {/* Insights */}
      {bestGroup.value > 0 && (
        <View style={[styles.insightRow, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.insightText, { color: currentTheme.colors.text + '80' }]}>
            {`Strongest: ${bestGroup.label} • Weakest: ${weakGroup.label}`}
          </Text>
        </View>
      )}

      {/* Top Contributions */}
      {showContributions && topContributions.length > 0 && (
        <View style={[styles.contributionsSection, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.contributionsTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            Top Contributions
          </Text>
          {topContributions.slice(0, 5).map((c, i) => (
            <View key={c.exercise_id || i} style={[styles.contributionRow, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.contributionName, { color: currentTheme.colors.text }]}>{c.name}</Text>
              <Text style={[styles.contributionPercent, { color: currentTheme.colors.primary }]}>{c.percentile}%</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierBadge: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  tierText: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'Raleway_800ExtraBold',
  },
  percentileBlock: {
    alignItems: 'flex-end',
  },
  percentileNumber: {
    fontSize: 42,
    fontWeight: '800',
    fontFamily: 'Raleway_800ExtraBold',
  },
  percentileSub: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nextTierHint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  selectedGroup: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedTitle: {
    fontSize: 14,
  },
  clearText: {
    fontSize: 12,
  },
  selectedPercent: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  insightRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  insightText: {
    fontSize: 12,
  },
  contributionsSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  contributionsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  contributionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  contributionName: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  contributionPercent: {
    fontSize: 13,
    fontWeight: '600',
  },
});
