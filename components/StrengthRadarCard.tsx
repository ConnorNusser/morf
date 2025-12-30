import Card from '@/components/Card';
import ProgressBar from '@/components/ProgressBar';
import RadarChart from '@/components/RadarChart';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierInfo, getNextTierInfo, getStrengthTier, getTierColor, RADAR_TIER_THRESHOLDS } from '@/lib/data/strengthStandards';
import { getWorkoutById } from '@/lib/workout/workouts';
import { MuscleGroupPercentiles, TopContribution } from '@/types';
import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';


interface StrengthRadarCardProps {
  overallPercentile: number;
  muscleGroups: MuscleGroupPercentiles;
  topContributions: TopContribution[];
  showContributions?: boolean;
}

export default function StrengthRadarCard({
  overallPercentile,
  muscleGroups,
  topContributions,
  showContributions = true,
}: StrengthRadarCardProps) {
  const { currentTheme } = useTheme();
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  // Get tier info
  const _tierInfo = useMemo(() => getTierInfo(overallPercentile), [overallPercentile]);

  const chartData = useMemo(() => {
    const groups = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes'] as const;
    return groups.map(g => ({
      label: g.charAt(0).toUpperCase() + g.slice(1),
      value: muscleGroups[g] || 0,
    }));
  }, [muscleGroups]);

  // Get contributions filtered by muscle group (matches OverallStrengthModal logic)
  const getContributionsByMuscleGroup = useMemo(() => {
    const map: Record<string, TopContribution[]> = {};

    topContributions.forEach(c => {
      const workout = getWorkoutById(c.exercise_id);
      if (!workout) return;

      // Add contribution to each matching primary muscle group (same as OverallStrengthModal)
      const groups = workout.primaryMuscles || [];
      groups.forEach((g: string) => {
        const key = g.toLowerCase();
        if (!map[key]) map[key] = [];
        map[key].push(c);
      });
    });

    // Sort each group by percentile descending
    Object.keys(map).forEach(k => map[k].sort((a, b) => b.percentile - a.percentile));
    return map;
  }, [topContributions]);

  const tooltipDetails = useMemo(() => {
    return chartData.map((group) => {
      const groupContributions = getContributionsByMuscleGroup[group.label.toLowerCase()] || [];
      return {
        lines: groupContributions.slice(0, 3).map(c => `${c.name}: ${c.percentile}%`) || ['No data'],
      };
    });
  }, [chartData, getContributionsByMuscleGroup]);

  // Filter contributions based on selected muscle group (using lowercase like OverallStrengthModal)
  const filteredContributions = useMemo(() => {
    if (selectedIdx < 0 || !chartData[selectedIdx]) {
      return topContributions;
    }
    const selectedLabel = chartData[selectedIdx].label.toLowerCase();
    return getContributionsByMuscleGroup[selectedLabel] || [];
  }, [selectedIdx, chartData, topContributions, getContributionsByMuscleGroup]);

  const nextTier = getNextTierInfo(overallPercentile);

  // Get the current displayed percentile and its tier color
  const displayedPercentile = selectedIdx >= 0 && chartData[selectedIdx] ? chartData[selectedIdx].value : overallPercentile;
  const displayedTierColor = getTierColor(getStrengthTier(displayedPercentile));

  return (
    <Card variant="surface" style={styles.card}>
      {/* Header with Tier and Percentile - changes based on selection */}
      <View style={[styles.headerRow, { backgroundColor: 'transparent' }]}>
        {/* Tier Badge - shows selected muscle group or overall */}
        <View style={[styles.tierSection, { backgroundColor: 'transparent' }]}>
          <TierBadge
            percentile={selectedIdx >= 0 && chartData[selectedIdx] ? chartData[selectedIdx].value : overallPercentile}
            size="large"
          />
          {selectedIdx >= 0 && chartData[selectedIdx] && (
            <Text style={[styles.selectedLabel, { color: currentTheme.colors.text + '90' }]}>
              {chartData[selectedIdx].label}
            </Text>
          )}
        </View>

        {/* Percentile + Clear button */}
        <View style={[styles.percentileBlock, { backgroundColor: 'transparent' }]}>
          {selectedIdx >= 0 ? (
            <TouchableOpacity
              onPress={() => setSelectedIdx(-1)}
              style={[styles.clearButton, { backgroundColor: currentTheme.colors.primary + '15' }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.clearButtonText, { color: currentTheme.colors.primary }]}>× Clear</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.percentileNumber, { color: currentTheme.colors.text }]}>
            {selectedIdx >= 0 && chartData[selectedIdx] ? chartData[selectedIdx].value : overallPercentile}
          </Text>
          <Text style={[styles.percentileSub, { color: currentTheme.colors.text + '80' }]}>
            {selectedIdx >= 0 ? 'group %' : 'percentile'}
          </Text>
        </View>
      </View>

      {/* Progress Bar - changes based on selection with tier color */}
      <ProgressBar
        progress={displayedPercentile}
        height={8}
        style={{ marginVertical: 12 }}
        exerciseName={selectedIdx >= 0 && chartData[selectedIdx] ? chartData[selectedIdx].label.toLowerCase() : 'overall'}
        color={displayedTierColor}
      />

      {/* Next Tier Hint */}
      <Text style={[styles.nextTierHint, { color: currentTheme.colors.text + '70' }]}>
        {nextTier.next ? `+${nextTier.needed}% to ${nextTier.next} Tier` : 'Maximum Tier Reached!'}
      </Text>

      {/* Radar Chart */}
      <RadarChart
        data={chartData}
        tiers={RADAR_TIER_THRESHOLDS}
        selectedIndex={selectedIdx}
        onPointPress={(i) => setSelectedIdx(i)}
        details={tooltipDetails}
        inlineTooltip={false}
      />


      {/* Top Contributions */}
      {showContributions && filteredContributions.length > 0 && (
        <View style={[styles.contributionsSection, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.contributionsTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
            {selectedIdx >= 0 && chartData[selectedIdx] ? `${chartData[selectedIdx].label} Lifts` : 'Top Contributions'}
          </Text>
          {filteredContributions.slice(0, 5).map((c, i) => {
            const tier = getStrengthTier(c.percentile);
            const tierColor = getTierColor(tier);
            return (
              <View
                key={c.exercise_id || i}
                style={[styles.contributionRow, { backgroundColor: 'transparent' }]}
              >
                <View style={[styles.contributionLeft, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.contributionName, { color: currentTheme.colors.text }]}>{c.name}</Text>
                  {c.weight && (
                    <Text style={[styles.contributionWeight, { color: currentTheme.colors.text + '60' }]}>
                      1RM: {c.weight} lbs
                    </Text>
                  )}
                </View>
                <View style={[styles.contributionRight, { backgroundColor: 'transparent' }]}>
                  <View style={[styles.tierBadgeSmall, { backgroundColor: tierColor + '20' }]}>
                    <Text style={[styles.contributionTier, { color: tierColor }]}>{tier}</Text>
                  </View>
                  <Text style={[styles.contributionPercent, { color: currentTheme.colors.text + '60' }]}>{c.percentile}%</Text>
                </View>
              </View>
            );
          })}
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
  tierSection: {
    alignItems: 'flex-start',
  },
  selectedLabel: {
    fontSize: 12,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  percentileBlock: {
    alignItems: 'flex-end',
  },
  clearButton: {
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  percentileNumber: {
    fontSize: 42,
    fontWeight: '800',
  },
  percentileSub: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 6,
  },
  nextTierHint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
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
    alignItems: 'center',
    paddingVertical: 8,
  },
  contributionLeft: {
    flex: 1,
  },
  contributionRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  contributionName: {
    fontSize: 13,
  },
  contributionWeight: {
    fontSize: 11,
    marginTop: 1,
  },
  tierBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  contributionTier: {
    fontSize: 12,
    fontWeight: '700',
  },
  contributionPercent: {
    fontSize: 10,
    marginTop: 2,
  },
});
