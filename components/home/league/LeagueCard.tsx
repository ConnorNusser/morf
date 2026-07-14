import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { buildStandings, weekBounds } from '@/lib/leagues/scoring';
import { LeagueStanding } from '@/lib/leagues/types';
import { userSyncService } from '@/lib/services/userSyncService';
import { radius, space } from '@/lib/ui/tokens';
import { formatCompact, formatVolume } from '@/lib/utils/utils';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

const SWORD = require('@/assets/achievements/sword.png');
const TROPHY = require('@/assets/achievements/trophy.png');

const ordinal = (n: number) => {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
};

interface LeagueCardProps {
  onPress: () => void;
}

/** Home entry point for the weekly league: your standing, the rival line, a competence cue. */
export default function LeagueCard({ onPress }: LeagueCardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [me, setMe] = useState<LeagueStanding | null>(null);
  const [fieldSize, setFieldSize] = useState(0);
  const [rival, setRival] = useState<{ username: string; gap: number; ahead: boolean } | null>(null);

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
      setFieldSize(active.length);

      const myIndex = active.findIndex(s => s.userId === user.id);
      if (myIndex > 0) {
        // Chasing: the member directly ahead.
        const ahead = active[myIndex - 1];
        setRival({ username: ahead.username, gap: ahead.points - active[myIndex].points, ahead: true });
      } else if (myIndex === 0 && active.length > 1) {
        // Leading: the member directly behind.
        const behind = active[1];
        setRival({ username: behind.username, gap: active[0].points - behind.points, ahead: false });
      } else {
        setRival(null);
      }
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

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: currentTheme.colors.surface, borderColor: ink.hairline }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image source={me?.rank === 1 ? TROPHY : SWORD} style={styles.emblem} />
      <RNView style={styles.body}>
        <Text variant="body" weight="semiBold" tone="primary">
          {onBoard ? `Weekly League · ${ordinal(me.rank!)} of ${fieldSize}` : 'Weekly League'}
        </Text>
        <Text variant="meta" tone="secondary" numberOfLines={1}>
          {onBoard && rival
            ? rival.gap === 0
              ? `Tied with ${rival.username}`
              : rival.ahead
              ? `${formatCompact(rival.gap)} pts behind ${rival.username}`
              : `${formatCompact(rival.gap)} pts ahead of ${rival.username}`
            : 'Log a session to put a score on the board'}
        </Text>
        {onBoard && (
          <Text variant="meta" tone="faint" numberOfLines={1}>
            {`${formatVolume(me.breakdown.volumeLbs, 'lbs')} lifted`}
            {me.breakdown.prCount > 0 ? ` · ${me.breakdown.prCount} PR${me.breakdown.prCount === 1 ? '' : 's'}` : ''}
          </Text>
        )}
      </RNView>
      {onBoard && (
        <Text variant="emphasis" weight="bold" tone="primary">
          {formatCompact(me.points)}
          <Text variant="meta" weight="regular" tone="muted"> pts</Text>
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emblem: {
    width: 36,
    height: 36,
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
