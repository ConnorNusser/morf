import { Text, useInk } from '@/components/Themed';
import UserAvatar from '@/components/ui/UserAvatar';
import SectionLabel from '@/components/ui/SectionLabel';
import ProgressHairline from '@/components/ui/ProgressHairline';
import { useTheme } from '@/contexts/ThemeContext';
import {
  PressableScale,
  RankRing,
  pts,
  rankTierColors,
  useCountUp,
} from '@/components/home/league/leagueVisuals';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { LeagueUpForGrabs, upForGrabs } from '@/lib/gamification/leagueAchievements';
import { buildStandings, weekBounds } from '@/lib/leagues/scoring';
import { LeagueStanding } from '@/lib/leagues/types';
import { userSyncService } from '@/lib/services/userSyncService';
import { storageService } from '@/lib/storage/storage';
import { radius, space } from '@/lib/ui/tokens';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface LeagueCardProps {
  /** Open the league board, optionally deep-opening a member's recap. */
  onOpen: (expandUserId?: string) => void;
}

/**
 * Home entry point: rank ring, one big rank-colored number, the rival line,
 * and the achievement this week can earn as a large emblem. Nothing else.
 */
export default function LeagueCard({ onOpen }: LeagueCardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [me, setMe] = useState<LeagueStanding | null>(null);
  const [leader, setLeader] = useState<LeagueStanding | null>(null);
  const [fieldSize, setFieldSize] = useState(0);
  const [grabs, setGrabs] = useState<LeagueUpForGrabs | null>(null);

  const load = useCallback(async () => {
    try {
      const { start, end } = weekBounds(new Date());
      const [user, rows] = await Promise.all([
        userSyncService.getCurrentUser(),
        userSyncService.getLeagueWeek(start, end),
      ]);
      if (!user) return;

      const { active, me: mine } = buildStandings(rows, [], user.id);
      setMe(mine);
      setLeader(active[0] ?? null);
      setFieldSize(active.length);
      const results = await storageService.getLeagueWeekResults();
      setGrabs(upForGrabs(results, mine?.rank ?? null, active.length));
    } catch (error) {
      console.error('Error loading league card:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // On the board as soon as you've trained this week, even alone — a solo week
  // reads "Top of the board" instead of hiding your score.
  const onBoard = me != null && me.rank != null && fieldSize >= 1;
  const rankColor = onBoard ? rankTierColors(me!.rank, fieldSize) : null;
  const leaderPoints = leader?.points ?? 0;
  const sharePct = onBoard && leaderPoints > 0 ? (me!.points / leaderPoints) * 100 : 0;
  const cardPoints = useCountUp(onBoard ? me!.points : 0, 500);
  const isLeading = onBoard && me!.rank === 1;
  const rivalGap = onBoard && leader != null && !isLeading ? leaderPoints - me!.points : null;

  // Swiss: a ruled section, not a filled card. Rank is a neutral display
  // numeral (tier hues belong to strength), points are tabular, and the
  // share of the leader's score is a hairline.
  return (
    <PressableScale
      onPress={() => onOpen(onBoard ? me!.userId : undefined)}
      style={[styles.card, { borderColor: ink.hairline }]}
    >
      <SectionLabel>Weekly league</SectionLabel>
      <RNView style={styles.row}>
        <Text variant="header" weight="bold" tone={onBoard ? 'primary' : 'faint'} style={[styles.rank, styles.tabularNums]}>
          {onBoard ? `#${me!.rank}` : '—'}
        </Text>
        <RNView style={styles.body}>
          <Text variant="emphasis" weight="bold" tone="primary" style={styles.tabularNums}>
            {onBoard ? pts(cardPoints) : '—'}
            {onBoard && <Text variant="meta" weight="regular" tone="muted"> pts</Text>}
          </Text>
          {onBoard && leader != null && !isLeading ? (
            <TouchableOpacity style={styles.rivalLine} onPress={() => onOpen(leader.userId)} activeOpacity={0.7}>
              <UserAvatar uri={leader.profilePictureUrl} username={leader.username} size={14} />
              <Text variant="meta" tone="secondary" numberOfLines={1}>
                {pts(rivalGap!)} behind {leader.username}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text variant="meta" tone="secondary" numberOfLines={1}>
              {isLeading ? (fieldSize > 1 ? 'Leading the week' : 'Top of the board') : 'Log a session to put a score on the board'}
            </Text>
          )}
        </RNView>
        {grabs && (
          <RNView style={styles.grabsBlock}>
            <Image source={emblemFor(grabs.id)} style={styles.grabsEmblem} />
            <Text variant="meta" tone="muted" numberOfLines={1}>{grabs.title}</Text>
          </RNView>
        )}
      </RNView>
      {onBoard ? (
        <ProgressHairline
          progress={(isLeading ? 100 : sharePct) / 100}
          color={ink.primary}
          startLabel={`${fieldSize} on the board`}
          endLabel={isLeading ? 'leader' : 'to leader'}
          style={styles.bar}
        />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  rank: {
    minWidth: 56,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  rivalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  grabsBlock: {
    alignItems: 'center',
    gap: space.xs,
    maxWidth: 96,
  },
  grabsEmblem: {
    width: 32,
    height: 32,
  },
  bar: {
    marginTop: space.md,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },
});
