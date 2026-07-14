import IconButton from '@/components/IconButton';
import { Text, useInk, View } from '@/components/Themed';
import { GOLD } from '@/components/home/league/leagueVisuals';
import { useTheme } from '@/contexts/ThemeContext';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { computeLeagueAchievements } from '@/lib/gamification/leagueAchievements';
import { LeagueWeekResult } from '@/lib/leagues/results';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import React, { useMemo } from 'react';
import { Image, Modal, SafeAreaView, ScrollView, StyleSheet, View as RNView } from 'react-native';

interface LeagueAchievementsModalProps {
  visible: boolean;
  onClose: () => void;
  results: LeagueWeekResult[];
  /** The achievement the current week is playing for — highlighted. */
  upForGrabsId?: string | null;
}

/** Everything the league can pay out — earned, in progress, and this week's target. */
export default function LeagueAchievementsModal({
  visible,
  onClose,
  results,
  upForGrabsId,
}: LeagueAchievementsModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const achievements = useMemo(() => computeLeagueAchievements(results), [results]);
  const earned = achievements.filter(a => a.unlocked).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.header}>
          <RNView>
            <Text variant="heading" weight="bold" tone="primary">
              League Achievements
            </Text>
            <Text variant="meta" tone="muted">
              {earned} of {achievements.length} earned
            </Text>
          </RNView>
          <IconButton icon="close" onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {achievements.map(achievement => {
            const isTarget = achievement.id === upForGrabsId && !achievement.unlocked;
            return (
              <RNView
                key={achievement.id}
                style={[
                  styles.row,
                  isTarget && { backgroundColor: tint(currentTheme.colors.primary), borderRadius: radius.card },
                ]}
              >
                <Image
                  source={emblemFor(achievement.id)}
                  style={[styles.emblem, !achievement.unlocked && !isTarget && styles.lockedEmblem]}
                />
                <RNView style={styles.body}>
                  <RNView style={styles.titleRow}>
                    <Text variant="body" weight="semiBold" tone={achievement.unlocked || isTarget ? 'primary' : 'secondary'}>
                      {achievement.title}
                    </Text>
                    {isTarget && (
                      <Text variant="meta" weight="bold" style={{ color: GOLD }}>
                        up for grabs
                      </Text>
                    )}
                  </RNView>
                  <Text variant="meta" tone="muted">
                    {achievement.description}
                  </Text>
                </RNView>
                {achievement.unlocked ? (
                  <Text variant="meta" weight="bold" style={{ color: GOLD }}>
                    Earned
                  </Text>
                ) : (
                  <Text variant="meta" weight="semiBold" tone="secondary" style={styles.tabularNums}>
                    {achievement.current}/{achievement.target}
                  </Text>
                )}
              </RNView>
            );
          })}

          <RNView style={[styles.footnote, { borderTopColor: ink.hairline }]}>
            <Text variant="meta" tone="muted">
              Wins count with 3+ people on the board; podiums with 4+. The board resets Monday.
            </Text>
          </RNView>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.md,
    paddingBottom: space.section,
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  emblem: {
    width: 36,
    height: 36,
  },
  lockedEmblem: {
    opacity: 0.35,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
