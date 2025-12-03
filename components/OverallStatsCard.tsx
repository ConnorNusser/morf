import { useTheme } from '@/contexts/ThemeContext';
import { OverallStats } from '@/lib/userProfile';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from './Card';
import ProgressBar from './ProgressBar';

interface OverallStatsCardProps {
  stats: OverallStats;
}

export default function OverallStatsCard({ stats }: OverallStatsCardProps) {
  const { currentTheme } = useTheme();

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 90) return '#10B981'; // Green
    if (percentile >= 75) return '#3B82F6'; // Blue
    if (percentile >= 50) return '#F59E0B'; // Orange
    return '#EF4444'; // Red
  };
  
  const percentile = Number.isNaN(stats.overallPercentile) ? 0 : stats.overallPercentile;

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
        <View style={styles.percentileContainer}>
          <Text style={[styles.percentileValue, { color: getPercentileColor(percentile) }]}>
            {percentile}
          </Text>
          <Text style={[
            styles.percentileLabel, 
            { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_500Medium',
            }
          ]}>
            percentile
          </Text>
        </View>

        <View style={styles.levelContainer}>
          <Text style={[
            styles.strengthLevel, 
            { 
              color: currentTheme.colors.text,
              fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
            }
          ]}>
            {stats.strengthLevel}
          </Text>
          <Text style={[
            styles.levelDescription, 
            { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_400Regular',
            }
          ]}>
            strength level
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
        />
        <View style={styles.progressLabels}>
          <Text style={[styles.progressLabel, { color: currentTheme.colors.text }]}>
            Progress to Elite
          </Text>
        </View>
      </View>
    </Card>
    </TouchableOpacity>
    {/* Lazy import to avoid circular deps in native fast refresh */}
    {isModalOpen && (
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy import for circular dependency avoidance
      React.createElement(require('./OverallStrengthModal').default, { visible: isModalOpen, onClose: () => setIsModalOpen(false) })
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
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
  percentileContainer: {
    alignItems: 'center',
  },
  percentileValue: {
    fontSize: 36,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  percentileLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  levelContainer: {
    alignItems: 'center',
  },
  strengthLevel: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  levelDescription: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    marginBottom: 8,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  progressLabel: {
    fontSize: 12,
    opacity: 0.6,
    fontFamily: 'Raleway_500Medium',
  },
}); 