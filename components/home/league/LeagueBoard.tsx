import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import { Text, useInk, View } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import NavRow from '@/components/ui/NavRow';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import LeaderboardModal from '@/components/profile/LeaderboardModal';
import UserProfileModal from '@/components/profile/UserProfileModal';
import SocialModal from '@/components/profile/SocialModal';
import { useTheme } from '@/contexts/ThemeContext';
import { TIER_COLORS } from '@/lib/data/strengthStandards';
import { recordClosedWeeks } from '@/lib/leagues/recordClosedWeeks';
import {
  buildStandings,
  LeagueStandings,
  leagueWinner,
  weekBounds,
} from '@/lib/leagues/scoring';
import { LeagueStanding, SCORING } from '@/lib/leagues/types';
import { userSyncService } from '@/lib/services/userSyncService';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
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
  flame: require('@/assets/achievements/flame.png'),
  barbell: require('@/assets/achievements/barbell.png'),
  lightning: require('@/assets/achievements/lightning.png'),
  laurel: require('@/assets/achievements/laurel.png'),
};

// Point sources borrow the tier palette so the colors already mean something
// in-app: gold = the big win (PRs), purple = magnitude (gain), blue = showing
// up (days), green = the consistency capstone.
const SOURCE_COLORS = {
  days: TIER_COLORS.B,
  prs: TIER_COLORS.S,
  gain: TIER_COLORS.A,
  bonus: TIER_COLORS.C,
} as const;

type BoardTab = 'week' | 'alltime';

interface LeagueBoardProps {
  visible: boolean;
  onClose: () => void;
}

const liftName = (exerciseId: string) => getCatalogExercise(exerciseId)?.name ?? exerciseId;

export default function LeagueBoard({ visible, onClose }: LeagueBoardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [tab, setTab] = useState<BoardTab>('week');
  const [isLoading, setIsLoading] = useState(false);
  const [standings, setStandings] = useState<LeagueStandings | null>(null);
  const [champion, setChampion] = useState<LeagueStanding | null>(null);
  const [myUser, setMyUser] = useState<RemoteUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAllTime, setShowAllTime] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const [showRules, setShowRules] = useState(false);

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
      setExpandedId(null);
      loadLeague();
    }
  }, [visible, loadLeague]);

  const daysLeft = useMemo(() => {
    const { end } = weekBounds(new Date());
    return Math.max(1, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  }, []);

  const me = standings?.me ?? null;
  const active = standings?.active ?? [];
  const maxPoints = active[0]?.points || 0;

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

  // The row's identity: WHERE the points came from, as a color-stacked bar
  // scaled against the leader. Legible at a glance, exact in the receipt.
  const renderSourceBar = (row: LeagueStanding) => {
    if (row.points <= 0 || maxPoints <= 0) return null;
    const widthPct = Math.max(6, Math.round((row.points / maxPoints) * 100));
    const segments = [
      { key: 'days', value: row.breakdown.activeDayPoints, color: SOURCE_COLORS.days },
      { key: 'prs', value: row.breakdown.prPoints, color: SOURCE_COLORS.prs },
      { key: 'gain', value: row.breakdown.gainPoints, color: SOURCE_COLORS.gain },
      { key: 'bonus', value: row.breakdown.goalBonus, color: SOURCE_COLORS.bonus },
    ].filter(s => s.value > 0);
    return (
      <RNView style={[styles.sourceBar, { width: `${widthPct}%` }]}>
        {segments.map(s => (
          <RNView key={s.key} style={{ flex: s.value, backgroundColor: s.color }} />
        ))}
      </RNView>
    );
  };

  // One line per point source, pixel emblem + reason + points earned.
  const renderReceipt = (row: LeagueStanding) => {
    const countedPRs = row.prs.slice(0, SCORING.prCap);
    const lines: { key: string; emblem: keyof typeof EMBLEMS; color: string; label: string; pts: number }[] = [];

    if (row.breakdown.activeDayPoints > 0) {
      lines.push({
        key: 'days',
        emblem: 'flame',
        color: SOURCE_COLORS.days,
        label: `Trained ${row.breakdown.activeDays} ${row.breakdown.activeDays === 1 ? 'day' : 'days'}${row.breakdown.activeDays > SCORING.activeDayCap ? ` (${SCORING.activeDayCap} score)` : ''}`,
        pts: row.breakdown.activeDayPoints,
      });
    }
    countedPRs.forEach((pr, i) => {
      lines.push({
        key: `pr-${pr.exercise_id}`,
        emblem: 'barbell',
        color: SOURCE_COLORS.prs,
        label: `PR — ${liftName(pr.exercise_id)} +${pr.gain_pct.toFixed(1)}%`,
        pts: SCORING.pointsPerPR + (i < SCORING.gainBonusLifts
          ? Math.round(SCORING.gainBonusPerPct * Math.min(Math.max(pr.gain_pct, 0), SCORING.gainPctCap))
          : 0),
      });
    });
    if (row.breakdown.goalBonus > 0) {
      lines.push({
        key: 'bonus',
        emblem: 'laurel',
        color: SOURCE_COLORS.bonus,
        label: `${SCORING.goalBonusDays}-day week`,
        pts: row.breakdown.goalBonus,
      });
    }

    if (lines.length === 0) {
      return (
        <Text variant="meta" tone="faint" style={styles.receiptEmpty}>
          No points yet this week.
        </Text>
      );
    }

    return (
      <RNView style={styles.receipt}>
        {lines.map(line => (
          <RNView key={line.key} style={styles.receiptLine}>
            <Image source={EMBLEMS[line.emblem]} style={styles.receiptEmblem} />
            <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.receiptLabel}>
              {line.label}
            </Text>
            <Text variant="meta" weight="semiBold" style={{ color: line.color }}>
              +{line.pts}
            </Text>
          </RNView>
        ))}
      </RNView>
    );
  };

  const renderRow = (row: LeagueStanding, index: number) => {
    const isHero = index === 0;
    const isYou = myUser != null && row.userId === myUser.id;
    const isChampion = champion != null && row.userId === champion.userId;
    const isExpanded = expandedId === row.userId;

    return (
      <Animated.View key={row.userId} entering={FadeInDown.duration(220).delay(Math.min(index, 12) * 35)}>
        <TouchableOpacity
          style={[styles.entryRow, isHero && styles.heroRow]}
          onPress={() => setExpandedId(isExpanded ? null : row.userId)}
          activeOpacity={0.7}
        >
          {isHero && (
            <LinearGradient
              colors={[tint(SOURCE_COLORS.prs), 'transparent']}
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

          <TouchableOpacity onPress={() => handleUserPress(row)} activeOpacity={0.7}>
            {renderAvatar(row, isHero ? 44 : 32)}
          </TouchableOpacity>

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
            {renderSourceBar(row)}
          </RNView>

          <RNView style={styles.valueCell}>
            <Text variant={isHero ? 'emphasis' : 'body'} weight={isHero ? 'semiBold' : 'medium'} tone="primary">
              {row.points}
              <Text variant="meta" weight="regular" tone="muted"> pts</Text>
            </Text>
            {row.breakdown.prCount > 0 && (
              <Text variant="meta" weight="semiBold" style={{ color: SOURCE_COLORS.prs }}>
                {row.breakdown.prCount} PR{row.breakdown.prCount === 1 ? '' : 's'}
              </Text>
            )}
          </RNView>
        </TouchableOpacity>
        {isExpanded && renderReceipt(row)}
      </Animated.View>
    );
  };

  // The legend that answers "why": every way to score, emblem + rule + points.
  const renderRules = () => (
    <RNView style={[styles.rules, { borderColor: ink.hairline }]}>
      {[
        { emblem: 'flame' as const, color: SOURCE_COLORS.days, rule: 'Train a day', pts: `+${SCORING.pointsPerActiveDay}`, cap: `up to ${SCORING.activeDayCap} days` },
        { emblem: 'barbell' as const, color: SOURCE_COLORS.prs, rule: 'PR any lift', pts: `+${SCORING.pointsPerPR}`, cap: `up to ${SCORING.prCap} PRs` },
        { emblem: 'lightning' as const, color: SOURCE_COLORS.gain, rule: 'Bigger gains, bigger bonus', pts: `+${SCORING.gainBonusPerPct}/%`, cap: `top ${SCORING.gainBonusLifts} lifts, ${SCORING.gainPctCap}% cap` },
        { emblem: 'laurel' as const, color: SOURCE_COLORS.bonus, rule: `Hit ${SCORING.goalBonusDays} days`, pts: `+${SCORING.goalBonus}`, cap: 'once a week' },
      ].map(r => (
        <RNView key={r.rule} style={styles.receiptLine}>
          <Image source={EMBLEMS[r.emblem]} style={styles.receiptEmblem} />
          <Text variant="meta" tone="secondary" style={styles.receiptLabel}>
            {r.rule} <Text variant="meta" tone="faint">· {r.cap}</Text>
          </Text>
          <Text variant="meta" weight="semiBold" style={{ color: r.color }}>{r.pts}</Text>
        </RNView>
      ))}
    </RNView>
  );

  // What I'd earn next — turns the rules into a to-do list.
  const nextPointsLine = useMemo(() => {
    if (!me) return null;
    const hints: string[] = [];
    if (me.breakdown.activeDays < SCORING.activeDayCap) hints.push(`Train tomorrow +${SCORING.pointsPerActiveDay}`);
    if (me.breakdown.prCount < SCORING.prCap) hints.push(`PR a lift +${SCORING.pointsPerPR}`);
    if (me.breakdown.goalBonus === 0 && me.breakdown.activeDays < SCORING.goalBonusDays) {
      hints.push(`${SCORING.goalBonusDays - me.breakdown.activeDays} more ${SCORING.goalBonusDays - me.breakdown.activeDays === 1 ? 'day' : 'days'} for +${SCORING.goalBonus}`);
    }
    return hints.slice(0, 2).join(' · ') || null;
  }, [me]);

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
        <View style={styles.list}>
          <EmptyState
            art={EMBLEMS.sword}
            title="Set the pace"
            subtitle="Nobody has taken this week yet. Log a session and put a score on the board."
          />
          {renderRules()}
        </View>
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
            {renderReceipt(me)}
            {nextPointsLine && (
              <RNView style={styles.receiptLine}>
                <Image source={EMBLEMS.lightning} style={styles.receiptEmblem} />
                <Text variant="meta" tone="faint" style={styles.receiptLabel}>
                  Next: {nextPointsLine}
                </Text>
              </RNView>
            )}
          </RNView>
        )}

        <TouchableOpacity onPress={() => setShowRules(!showRules)} activeOpacity={0.7}>
          <Text variant="meta" weight="semiBold" tone="muted" style={styles.rulesToggle}>
            {showRules ? 'HIDE SCORING' : 'HOW SCORING WORKS'}
          </Text>
        </TouchableOpacity>
        {showRules && renderRules()}

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
    gap: 5,
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
  sourceBar: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  valueCell: {
    alignItems: 'flex-end',
    gap: 2,
  },
  receipt: {
    paddingLeft: 32 + space.md + space.md,
    paddingRight: space.md,
    paddingBottom: space.md,
    gap: space.sm,
  },
  receiptEmpty: {
    paddingLeft: 32 + space.md + space.md,
    paddingBottom: space.md,
  },
  receiptLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  receiptEmblem: {
    width: 14,
    height: 14,
  },
  receiptLabel: {
    flex: 1,
  },
  rules: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space.md,
    gap: space.sm,
    marginTop: space.sm,
  },
  rulesToggle: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
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
