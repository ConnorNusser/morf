import { FeedWorkout } from '@/components/feed/FeedCard';
import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import Badge from '@/components/ui/Badge';
import UserAvatar from '@/components/ui/UserAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS, PPL_LABELS, PPLBreakdown, PPLCategory } from '@/lib/data/pplCategories';
import { StrengthTier } from '@/lib/data/strengthStandards';
import { formatDurationWords, formatRelativeTime } from '@/lib/ui/formatters';
import { formatVolumeNumber } from '@/lib/utils/utils';
import { WeightUnit } from '@/types';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface WorkoutThreadSummaryProps {
  workout: FeedWorkout;
  weightUnit: WeightUnit;
  hasPRs: boolean;
  strengthLevel: StrengthTier | undefined;
  pplBreakdown: PPLBreakdown;
  onUserPress: (userId: string, username: string, profilePictureUrl?: string) => void;
  onPplChipPress: (category: PPLCategory) => void;
}

// Author row, stats grid and PR/PPL tags. Returns a fragment so each block
// stays a direct child of the thread ScrollView (its gap spaces them).
export default function WorkoutThreadSummary({
  workout,
  weightUnit,
  hasPRs,
  strengthLevel,
  pplBreakdown,
  onUserPress,
  onPplChipPress,
}: WorkoutThreadSummaryProps) {
  const { currentTheme } = useTheme();
  const feedData = workout.feed_data;

  return (
    <>
      <View style={styles.userRow}>
        <TouchableOpacity
          onPress={() => onUserPress(workout.user_id, workout.username, workout.profile_picture_url)}
          activeOpacity={0.7}
          style={styles.userTapArea}
        >
          <UserAvatar uri={workout.profile_picture_url} username={workout.username} size={44} />
          <View style={styles.userInfo}>
            <Text style={[styles.username, { color: currentTheme.colors.text, fontWeight: '600' }]}>
              @{workout.username}
            </Text>
            <Text style={[styles.time, { color: currentTheme.colors.text + '60', fontWeight: '400' }]}>
              {formatRelativeTime(workout.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
        {strengthLevel && (
          <TierBadge tier={strengthLevel} size="small" />
        )}
      </View>

      <View style={[styles.statsGrid, { backgroundColor: currentTheme.colors.surface }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '700' }]}>
            {workout.exercise_count}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontWeight: '400' }]}>
            exercises
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '700' }]}>
            {formatDurationWords(workout.duration_seconds)}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontWeight: '400' }]}>
            duration
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '700' }]}>
            {formatVolumeNumber(workout.total_volume, weightUnit)}
          </Text>
          <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontWeight: '400' }]}>
            {weightUnit}
          </Text>
        </View>
      </View>

      {(hasPRs || pplBreakdown.total > 0) && (
        <View style={styles.tagsRow}>
          {hasPRs && (
            <Badge
              variant="solid"
              label={feedData?.pr_count === 1 ? 'New PR' : `${feedData?.pr_count} PRs`}
            />
          )}
          {(['push', 'pull', 'legs'] as const)
            .filter(category => pplBreakdown.counts[category] > 0)
            .map(category => (
              <TouchableOpacity
                key={category}
                style={[styles.pplChip, { backgroundColor: PPL_COLORS[category] + '20' }]}
                onPress={() => onPplChipPress(category)}
                activeOpacity={0.7}
              >
                <View style={[styles.pplDot, { backgroundColor: PPL_COLORS[category] }]} />
                <Text style={[styles.pplChipText, { color: currentTheme.colors.text, fontWeight: '500' }]}>
                  {PPL_LABELS[category]}
                </Text>
                <Text style={[styles.pplChipCount, { color: PPL_COLORS[category], fontWeight: '700' }]}>
                  {pplBreakdown.counts[category]}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTapArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 15,
  },
  time: {
    fontSize: 13,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pplChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  pplDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pplChipText: {
    fontSize: 13,
  },
  pplChipCount: {
    fontSize: 14,
  },
});
