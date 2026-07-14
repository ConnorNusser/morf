import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import { Text, useInk, View } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import NavRow from '@/components/ui/NavRow';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import StatStrip from '@/components/ui/StatStrip';
import LeaderboardModal from '@/components/profile/LeaderboardModal';
import UserProfileModal from '@/components/profile/UserProfileModal';
import SocialModal from '@/components/profile/SocialModal';
import { useTheme } from '@/contexts/ThemeContext';
import { recordClosedWeeks } from '@/lib/leagues/recordClosedWeeks';
import {
  buildStandings,
  LeagueStandings,
  leagueWinner,
  weekBounds,
} from '@/lib/leagues/scoring';
import { LeagueStanding } from '@/lib/leagues/types';
import { userSyncService } from '@/lib/services/userSyncService';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { RemoteUser } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// League iconography is the pixel emblem set — no Ionicons, no emoji (spec).
const EMBLEMS = {
  trophy: require('@/assets/achievements/trophy.png'),
  sword: require('@/assets/achievements/sword.png'),
  banner: require('@/assets/achievements/banner.png'),
};

type BoardTab = 'week' | 'alltime';

interface LeagueBoardProps {
  visible: boolean;
  onClose: () => void;
}

export default function LeagueBoard({ visible, onClose }: LeagueBoardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [tab, setTab] = useState<BoardTab>('week');
  const [isLoading, setIsLoading] = useState(false);
  const [standings, setStandings] = useState<LeagueStandings | null>(null);
  const [champion, setChampion] = useState<LeagueStanding | null>(null);
  const [myUser, setMyUser] = useState<RemoteUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [showAllTime, setShowAllTime] = useState(false);
  const [showSocial, setShowSocial] = useState(false);

  const loadLeague = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const { start, end } = weekBounds(now);
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);

      const [me, friends, rows, prevRows] = await Promise.all([
        userSyncService.getCurrentUser(),
        userSyncService.getFriends(),
        userSyncService.getLeagueWeek(start, end),
        userSyncService.getLeagueWeek(prevStart, start),
      ]);
      setMyUser(me);
      if (!me) {
        setStandings(null);
        return;
      }

      setStandings(buildStandings(rows, friends, me.id));
      setChampion(leagueWinner(buildStandings(prevRows, [], me.id)));

      // Record any freshly-closed weeks so league achievements can unlock.
      recordClosedWeeks(now);
    } catch (error) {
      console.error('Error loading league:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setTab('week');
      loadLeague();
    }
  }, [visible, loadLeague]);

  const daysLeft = useMemo(() => {
    const { end } = weekBounds(new Date());
    return Math.max(1, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  }, []);

  const me = standings?.me ?? null;
  const active = standings?.active ?? [];

  const handleUserPress = (row: LeagueStanding) => {
    setSelectedUser({
      id: row.userId,
      device_id: '',
      username: row.username,
      profile_picture_url: row.profilePictureUrl ?? undefined,
    });
  };

  const renderAvatar = (row: LeagueStanding, size: number) => {
    if (row.profilePictureUrl) {
      return (
        <Image
          source={{ uri: row.profilePictureUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      );
    }
    return (
      <RNView
        style={[
          styles.avatarPlaceholder,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: tint(currentTheme.colors.primary) },
        ]}
      >
        <Text variant="meta" weight="semiBold">
          {row.username ? row.username.charAt(0).toUpperCase() : '?'}
        </Text>
      </RNView>
    );
  };

  // "3 days · 2 PRs · +6.2%" — makes points legible instead of a black box.
  const breakdownLine = (row: LeagueStanding) => {
    const parts = [`${row.breakdown.activeDays}d`];
    if (row.breakdown.prCount > 0) {
      parts.push(`${row.breakdown.prCount} PR${row.breakdown.prCount === 1 ? '' : 's'}`);
    }
    if (row.breakdown.bestGainPct != null && row.breakdown.bestGainPct > 0) {
      parts.push(`+${row.breakdown.bestGainPct.toFixed(1)}%`);
    }
    return parts.join(' · ');
  };

  const renderRow = (row: LeagueStanding, index: number) => {
    const isHero = index === 0;
    const isYou = myUser != null && row.userId === myUser.id;
    const isChampion = champion != null && row.userId === champion.userId;

    return (
      <Animated.View key={row.userId} entering={FadeInDown.duration(220).delay(Math.min(index, 12) * 35)}>
        <TouchableOpacity
          style={[styles.entryRow, isHero && styles.heroRow]}
          onPress={() => handleUserPress(row)}
          activeOpacity={0.7}
        >
          {isHero && (
            <LinearGradient
              colors={[tint(currentTheme.colors.primary), 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, styles.rowRound]}
            />
          )}

          <RNView style={styles.rankCell}>
            <Text
              variant={isHero ? 'emphasis' : 'body'}
              weight={index < 3 ? 'semiBold' : 'regular'}
              tone={index < 3 ? 'primary' : 'muted'}
            >
              {row.rank}
            </Text>
          </RNView>

          {renderAvatar(row, isHero ? 44 : 32)}

          <RNView style={styles.userInfo}>
            <RNView style={styles.usernameRow}>
              <Text
                variant="body"
                weight={isHero || isYou ? 'semiBold' : 'medium'}
                tone="primary"
                numberOfLines={1}
                style={styles.usernameText}
              >
                {row.username}
              </Text>
              {isChampion && <Image source={EMBLEMS.trophy} style={styles.inlineEmblem} />}
              {row.isFriend && !isYou && <Image source={EMBLEMS.banner} style={styles.inlineEmblem} />}
              {isYou && <Text variant="meta" tone="faint">you</Text>}
            </RNView>
            <Text variant="meta" tone="muted" numberOfLines={1}>
              {breakdownLine(row)}
            </Text>
          </RNView>

          <RNView style={styles.valueCell}>
            <Text variant={isHero ? 'emphasis' : 'body'} weight={isHero ? 'semiBold' : 'medium'} tone="primary">
              {row.points}
              <Text variant="meta" weight="regular" tone="muted"> pts</Text>
            </Text>
          </RNView>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderWeekBoard = () => {
    if (isLoading) {
      return (
        <View style={styles.list}>
          {[1, 2, 3, 4, 5].map(i => (
            <SkeletonCard key={i} variant="leaderboard-row" />
          ))}
        </View>
      );
    }

    // Fewer than two people training this week — no race to frame.
    if (active.length < 2) {
      return (
        <EmptyState
          art={EMBLEMS.sword}
          title="Set the pace"
          subtitle="Nobody has taken this week yet. Log a session and put a score on the board."
        />
      );
    }

    return (
      <View style={styles.list}>
        {champion && (
          <RNView style={styles.championLine}>
            <Image source={EMBLEMS.trophy} style={styles.inlineEmblem} />
            <Text variant="meta" tone="muted">
              Last week: <Text variant="meta" weight="semiBold" tone="primary">{champion.username}</Text>
            </Text>
          </RNView>
        )}

        {active.map(renderRow)}

        {standings != null && standings.restingFriends.length > 0 && (
          <RNView style={[styles.restingRow, { borderTopColor: ink.hairline }]}>
            <Text variant="meta" tone="faint" numberOfLines={2}>
              Resting this week: {standings.restingFriends.map(f => f.user.username).join(', ')}
            </Text>
          </RNView>
        )}

        {me != null && (
          <RNView style={styles.personalPanel}>
            <Text variant="meta" weight="semiBold" tone="muted" style={styles.personalLabel}>
              YOUR WEEK
            </Text>
            <StatStrip
              items={[
                { value: me.breakdown.activeDays, label: 'days' },
                { value: me.breakdown.prCount, label: 'PRs' },
                { value: me.breakdown.gainPoints + me.breakdown.prPoints, label: 'PR pts' },
                { value: me.breakdown.goalBonus, label: 'bonus' },
              ]}
            />
          </RNView>
        )}

        <NavRow label="Add friends" variant="card" onPress={() => setShowSocial(true)} />
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={styles.headerSpacer} />
          <RNView style={styles.headerTitle}>
            <Text variant="emphasis" weight="semiBold" tone="primary">
              Weekly League
            </Text>
            <Text variant="meta" tone="faint">
              Resets Monday · {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
            </Text>
          </RNView>
          <IconButton icon="close" onPress={onClose} />
        </View>

        <View style={styles.controls}>
          <SegmentedTabs
            tabs={[
              { key: 'week', label: 'This week' },
              { key: 'alltime', label: 'All-time' },
            ]}
            active={tab}
            onChange={key => {
              if (key === 'alltime') {
                setShowAllTime(true);
              } else {
                setTab('week');
              }
            }}
          />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {renderWeekBoard()}
        </ScrollView>

        {me != null && me.rank != null && active.length >= 2 && !isLoading && (
          <RNView
            style={[
              styles.youBar,
              { backgroundColor: currentTheme.colors.surface, borderTopColor: currentTheme.colors.border },
            ]}
          >
            <Text variant="body" weight="semiBold" tone="primary" style={styles.youRank}>
              #{me.rank}
            </Text>
            <RNView style={styles.userInfo}>
              <Text variant="body" weight="semiBold" tone="primary">You</Text>
              {me.rank === 1 ? (
                <Text variant="meta" tone="secondary">Top of the board</Text>
              ) : me.gapToAhead != null ? (
                <Text variant="meta" tone="secondary" numberOfLines={1}>
                  {me.gapToAhead === 0
                    ? `Tied with @${active[active.findIndex(s => s.userId === me.userId) - 1]?.username}`
                    : `${me.gapToAhead} pts to pass @${active[active.findIndex(s => s.userId === me.userId) - 1]?.username}`}
                </Text>
              ) : null}
            </RNView>
            <Text variant="body" weight="semiBold" tone="primary">
              {me.points}
              <Text variant="meta" weight="regular" tone="muted"> pts</Text>
            </Text>
          </RNView>
        )}

        {/* All-time boards keep living in the leaderboard modal, stacked above. */}
        <LeaderboardModal
          visible={showAllTime}
          onClose={() => {
            setShowAllTime(false);
            setTab('week');
          }}
        />

        <SocialModal visible={showSocial} onClose={() => setShowSocial(false)} />

        <UserProfileModal
          visible={selectedUser !== null}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
        />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    alignItems: 'center',
    gap: 2,
  },
  controls: {
    paddingHorizontal: screenGutter,
    paddingTop: space.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.lg,
    paddingBottom: space.section,
  },
  list: {
    gap: space.xs,
  },
  championLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
    overflow: 'hidden',
  },
  heroRow: {
    paddingVertical: space.lg,
  },
  rowRound: {
    borderRadius: radius.card,
  },
  rankCell: {
    width: 32,
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  usernameText: {
    flexShrink: 1,
  },
  inlineEmblem: {
    width: 16,
    height: 16,
  },
  valueCell: {
    alignItems: 'flex-end',
  },
  restingRow: {
    marginTop: space.md,
    paddingTop: space.md,
    paddingHorizontal: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  personalPanel: {
    marginTop: space.section,
    gap: space.sm,
  },
  personalLabel: {
    paddingHorizontal: space.md,
  },
  youBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  youRank: {
    minWidth: 36,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
