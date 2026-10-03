import { cardStyles } from '@/components/profile/userProfile/cardStyles';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ComparisonMode, LiftComparison } from '@/lib/gamification/userProfileInsights';
import { space, radius, tint, trend } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface LiftComparisonCardProps {
  username: string;
  liftComparison: LiftComparison;
  comparisonMode: ComparisonMode;
  showAllComparisons: boolean;
  /** Switch mode; the caller also collapses the list back to the first four. */
  onChangeMode: (mode: ComparisonMode) => void;
  onToggleShowAll: () => void;
}

/** "You vs @user" head-to-head on shared exercises, by weight or by percentile. */
export default function LiftComparisonCard({
  username,
  liftComparison,
  comparisonMode,
  showAllComparisons,
  onChangeMode,
  onToggleShowAll,
}: LiftComparisonCardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <View style={[cardStyles.card, { backgroundColor: currentTheme.colors.surface }]}>
      <View style={styles.comparisonHeader}>
        <Text variant="body" weight="semiBold" tone="primary">
          You vs @{username}
        </Text>
        <View style={styles.comparisonSummary}>
          <Text
            variant="emphasis"
            weight="bold"
            style={{
              color: liftComparison.myWins > liftComparison.theirWins
                ? trend.up
                : liftComparison.myWins < liftComparison.theirWins
                  ? trend.down
                  : ink.muted
            }}
          >
            {liftComparison.myWins}-{liftComparison.theirWins}
          </Text>
        </View>
      </View>
      <View style={styles.comparisonChips}>
        <TouchableOpacity
          style={[
            styles.comparisonChip,
            {
              backgroundColor: comparisonMode === 'weight' ? currentTheme.colors.primary : currentTheme.colors.background,
              borderColor: comparisonMode === 'weight' ? currentTheme.colors.primary : currentTheme.colors.border,
            }
          ]}
          onPress={() => onChangeMode('weight')}
          activeOpacity={0.7}
        >
          <Text
            variant="meta"
            weight="semiBold"
            style={{ color: comparisonMode === 'weight' ? '#FFFFFF' : currentTheme.colors.text + '80' }}
          >
            By Weight
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.comparisonChip,
            {
              backgroundColor: comparisonMode === 'percentile' ? currentTheme.colors.primary : currentTheme.colors.background,
              borderColor: comparisonMode === 'percentile' ? currentTheme.colors.primary : currentTheme.colors.border,
            }
          ]}
          onPress={() => onChangeMode('percentile')}
          activeOpacity={0.7}
        >
          <Text
            variant="meta"
            weight="semiBold"
            style={{ color: comparisonMode === 'percentile' ? '#FFFFFF' : currentTheme.colors.text + '80' }}
          >
            By Percentile
          </Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.comparisonHeaderRow, { borderBottomColor: currentTheme.colors.border }]}>
        <Text variant="meta" weight="semiBold" tone="muted" style={styles.comparisonColumnHeader}>You</Text>
        <Text variant="meta" weight="semiBold" tone="muted" style={[styles.comparisonColumnHeader, { flex: 1, textAlign: 'center' }]}>Exercise</Text>
        <Text variant="meta" weight="semiBold" tone="muted" style={styles.comparisonColumnHeader}>Them</Text>
      </View>
      <View style={styles.comparisonList}>
        {(showAllComparisons ? liftComparison.comparisons : liftComparison.comparisons.slice(0, 4)).map((comp) => {
          const diff = comp.myValue - comp.theirValue;
          const diffText = diff > 0 ? `+${diff}` : `${diff}`;
          return (
            <View key={comp.exerciseId} style={styles.comparisonRow}>
              <View style={[
                styles.comparisonValuePill,
                comp.iWin && !comp.isTie && { backgroundColor: tint(trend.up) }
              ]}>
                <Text
                  variant="meta"
                  weight="semiBold"
                  style={{ color: comp.iWin && !comp.isTie ? trend.up : currentTheme.colors.text }}
                >
                  {comp.myValue}{comparisonMode === 'percentile' ? '%' : ''}
                </Text>
              </View>
              <View style={styles.comparisonMiddle}>
                <Text variant="meta" tone="secondary" style={styles.comparisonExercise} numberOfLines={1}>
                  {comp.name}
                </Text>
                {!comp.isTie && (
                  <Text
                    variant="meta"
                    weight="semiBold"
                    style={[
                      styles.comparisonDiff,
                      { color: diff > 0 ? trend.up : trend.down }
                    ]}
                  >
                    {diffText}{comparisonMode === 'percentile' ? '%' : ''}
                  </Text>
                )}
              </View>
              <View style={styles.comparisonValuePill}>
                <Text variant="meta" weight="semiBold" tone="primary">
                  {comp.theirValue}{comparisonMode === 'percentile' ? '%' : ''}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {liftComparison.comparisons.length > 4 && (
        <TouchableOpacity
          style={[styles.showMoreButton, { borderColor: currentTheme.colors.border }]}
          onPress={onToggleShowAll}
          activeOpacity={0.7}
        >
          <Text variant="meta" weight="semiBold">
            {showAllComparisons ? 'Show less' : `Show ${liftComparison.comparisons.length - 4} more`}
          </Text>
          <Ionicons
            name={showAllComparisons ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={currentTheme.colors.primary}
          />
        </TouchableOpacity>
      )}
      <Text variant="meta" tone="faint" style={styles.comparisonFooter}>
        Comparing {liftComparison.comparisons.length} shared exercises ({comparisonMode === 'percentile' ? 'percentile' : '1RM lbs'})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  comparisonSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: space.sm,
    marginBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  comparisonColumnHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 56,
  },
  comparisonList: {
    gap: space.sm,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  comparisonValuePill: {
    width: 56,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.badge,
    alignItems: 'center',
  },
  comparisonMiddle: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: space.xs,
  },
  comparisonExercise: {
    textAlign: 'center',
  },
  comparisonDiff: {
    marginTop: space.xs,
  },
  comparisonFooter: {
    textAlign: 'center',
    marginTop: space.md,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    marginTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  comparisonChips: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  comparisonChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
