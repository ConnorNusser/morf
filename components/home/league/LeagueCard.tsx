import { Text, useInk } from '@/components/Themed';
import UserAvatar from '@/components/ui/UserAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CompositionBar,
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
import { formatVolume } from '@/lib/utils/utils';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface LeagueCardProps {
  /** Open the league board, optionally deep-opening a member's recap. */
  onOpen: (expandUserId?: string) => void;
}

/** Home entry point: the board's hero grammar at card scale, fully tappable. */
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

  const onBoard = me != null && me.rank != null && fieldSize >= 2;
  const rankColor = onBoard ? rankTierColors(me!.rank, fieldSize) : null;
  const leaderPoints = leader?.points ?? 0;
  const sharePct = onBoard && leaderPoints > 0 ? (me!.points / leaderPoints) * 100 : 0;
  const cardPoints = useCountUp(onBoard ? me!.points : 0, 500);
  const isLeading = onBoard && me!.rank === 1;
  const rivalGap = onBoard && leader != null && !isLeading ? leaderPoints - me!.points : null;

  return (
    <PressableScale
      onPress={() => onOpen(onBoard ? me!.userId : undefined)}
      style={[styles.card, { backgroundColor: currentTheme.colors.surface, borderColor: ink.hairline }]}
    >
      <RNView style={styles.topRow}>
        <RankRing
          pct={isLeading ? 100 : sharePct}
          rank={onBoard ? me!.rank : null}
          field={fieldSize}
          color={rankColor?.pure ?? currentTheme.colors.primary}
          trackColor={ink.ghost}
          size={48}
        />
        <RNView style={styles.body}>
          <Text variant="body" weight="semiBold" tone="primary">
            Weekly League
          </Text>
          {onBoard && leader != null && !isLeading ? (
            <TouchableOpacity
              style={styles.rivalLine}
              onPress={() => onOpen(leader.userId)}
              activeOpacity={0.7}
            >
              <UserAvatar uri={leader.profilePictureUrl} username={leader.username} size={14} />
              <Text variant="meta" tone="secondary" numberOfLines={1}>
                {pts(rivalGap!)} behind {leader.username}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text variant="meta" tone="secondary" numberOfLines={1}>
              {isLeading
                ? fieldSize > 1
                  ? 'Leading the week'
                  : 'Top of the board'
                : 'Log a session to put a score on the board'}
            </Text>
          )}
          {onBoard && (
            <Text variant="meta" tone="muted" numberOfLines={1}>
              {`${formatVolume(me!.breakdown.volumeLbs, 'lbs')} lifted`}
              {me!.breakdown.prCount > 0 ? ` · ${me!.breakdown.prCount} PR${me!.breakdown.prCount === 1 ? '' : 's'}` : ''}
            </Text>
          )}
          {grabs && (
            <RNView style={styles.grabsLine}>
              <Image source={emblemFor(grabs.id)} style={styles.grabsEmblem} />
              <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.grabsText}>
                <Text variant="meta" weight="semiBold" tone="primary">{grabs.title}</Text> · {grabs.hint}
              </Text>
            </RNView>
          )}
        </RNView>
        {onBoard && (
          <Text
            variant="emphasis"
            weight="bold"
            tone={rankColor ? undefined : 'primary'}
            style={[styles.tabularNums, rankColor != null && { color: rankColor.text }]}
          >
            {pts(cardPoints)}
            <Text variant="meta" weight="regular" tone="muted"> pts</Text>
          </Text>
        )}
      </RNView>

      {onBoard && (
        <CompositionBar
          sharePct={sharePct}
          volumePoints={me!.breakdown.volumePoints}
          prPoints={me!.breakdown.prPoints}
          accent={rankColor?.pure ?? currentTheme.colors.primary}
          trackColor={ink.ghost}
          height={4}
        />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
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
  grabsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: 2,
  },
  grabsEmblem: {
    width: 14,
    height: 14,
  },
  grabsText: {
    flexShrink: 1,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },
});
