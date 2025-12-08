import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor, StrengthTier } from '@/lib/strengthStandards';
import { OverallStats } from '@/lib/userProfile';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from './Card';
import ProgressBar from './ProgressBar';
import TierBadge from './TierBadge';

interface OverallStatsCardProps {
  stats: OverallStats;
}

export default function OverallStatsCard({ stats }: OverallStatsCardProps) {
  const { currentTheme } = useTheme();

  const percentile = Number.isNaN(stats.overallPercentile) ? 0 : stats.overallPercentile;
  const tierColor = getTierColor(stats.strengthLevel as StrengthTier);

  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <>
    <TouchableOpacity activeOpacity={0.8} onPress={() => setIsModalOpen(true)}>
    <Card variant="elevated" style={styles.container}>
      <View style={styles.header}>
        <Text style={[
          styles.title,
          {
            color: currentTheme.colors.text,
            fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
          }
        ]}>
          Overall Strength
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, { color: tierColor }]}>
            {percentile}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>
            percentile
          </Text>
        </View>

        <View style={styles.statBlock}>
          <TierBadge tier={stats.strengthLevel as StrengthTier} size="large" variant="text" />
          <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>
            tier
          </Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <ProgressBar
          progress={percentile}
          height={12}
          style={styles.progressBar}
          showTicks={true}
          exerciseName="Overall Strength"
          color={tierColor}
        />
        <Text style={[styles.progressLabel, { color: currentTheme.colors.text }]}>
          Progress to S Tier
        </Text>
      </View>
    </Card>
    </TouchableOpacity>
    {isModalOpen && (
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy import for circular dependency avoidance
      React.createElement(require('./OverallStrengthModal').default, { visible: isModalOpen, onClose: () => setIsModalOpen(false) })
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  statBlock: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    lineHeight: 40,
    fontFamily: 'Raleway_700Bold',
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
    fontFamily: 'Raleway_500Medium',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    opacity: 0.6,
    fontFamily: 'Raleway_500Medium',
    textAlign: 'center',
  },
});
