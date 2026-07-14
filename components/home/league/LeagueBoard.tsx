import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import TierBadge from '@/components/TierBadge';
import { Text, useInk, View } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import SectionLabel from '@/components/ui/SectionLabel';
import UserProfileModal from '@/components/profile/UserProfileModal';
import { useTheme } from '@/contexts/ThemeContext';
import { StrengthTier, TIER_COLORS } from '@/lib/data/strengthStandards';
import { recordClosedWeeks } from '@/lib/leagues/recordClosedWeeks';
import {
  buildStandings,
  LeagueStandings,
  leagueWinner,
  prPoints,
  weekBounds,
} from '@/lib/leagues/scoring';
import { LeagueStanding, SCORING } from '@/lib/leagues/types';
import { userSyncService } from '@/lib/services/userSyncService';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { formatCompact, formatVolume } from '@/lib/utils/utils';
import { RemoteUser } from '@/types';
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

const LEAGUE_HEADER = require('@/assets/images/league-header.png');

// League iconography is the pixel emblem set — no Ionicons, no emoji (spec).
const EMBLEMS = {
  trophy: require('@/assets/achievements/trophy.png'),
  sword: require('@/assets/achievements/sword.png'),
  plate: require('@/assets/achievements/plate.png'),
  barbell: require('@/assets/achievements/barbell.png'),
};

// Primary = your identity; gold = glory (leader, PRs, champion). Lift rows may
// additionally carry their tier color — docs/league-visual-goal.md.
const GOLD = TIER_COLORS.S;

interface LeagueBoardProps {
  visible: boolean;
  onClose: () => void;
}

const liftName = (exerciseId: string) => getCatalogExercise(exerciseId)?.name ?? exerciseId;
const pts = (value: number) => formatCompact(value);

export default function LeagueBoard({ visible, onClose }: LeagueBoardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [isLoading, setIsLoading] = useState(false);
  const [standings, setStandings] = useState<LeagueStandings | null>(null);
  const [champion, setChampion] = useState<LeagueStanding | null>(null);
  const [myUser, setMyUser] = useState<RemoteUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

      const built = buildStandings(rows, friends, me.id);
      setStandings(built);
      setChampion(leagueWinner(buildStandings(prevRows, [], me.id)));
      // Your own recap is one glance away by default.
      setExpandedId(built.me?.rank != null ? me.id : null);

      // Record any freshly-closed weeks so league achievements can unlock.
      recordClosedWeeks(now);
    } catch (error) {
      console.error('Error loading league:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadLeague();
  }, [visible, loadLeague]);

  const daysLeft = useMemo(() => {
    const { end } = weekBounds(new Date());
    return Math.max(1, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  }, []);

  const me = standings?.me ?? null;
  const active = standings?.active ?? [];

  const openProfile = (row: LeagueStanding) => {
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

  // ——— The recap: where every point came from, in real units ———

  const renderRecap = (row: LeagueStanding) => {
    const isYou = myUser != null && row.userId === myUser.id;
    const prs = row.topLifts.filter(lift => lift.is_pr);
    const leaderPoints = active[0]?.points ?? 0;
    const chase = isYou && row.rank !== 1 && row.rank != null && leaderPoints > 0
      ? { pct: Math.min(100, Math.round((row.points / leaderPoints) * 100)), gap: leaderPoints - row.points }
      : null;

    return (
      <RNView style={styles.recap}>
        {/* Volume — a pound is a point. */}
        {row.breakdown.volumePoints > 0 && (
          <RNView style={styles.recapLine}>
            <Image source={EMBLEMS.plate} style={styles.recapEmblem} />
            <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.recapLabel}>
              Lifted {formatVolume(row.breakdown.volumeLbs, 'lbs')} over {row.breakdown.activeDays} {row.breakdown.activeDays === 1 ? 'day' : 'days'}
            </Text>
            <Text variant="meta" weight="semiBold" tone="primary">
              +{pts(row.breakdown.volumePoints)}
            </Text>
          </RNView>
        )}

        {/* PRs — the lift's e1RM × 50, tier-colored. */}
        {prs.map(lift => (
          <RNView key={`pr-${lift.exercise_id}`} style={styles.recapLine}>
            <Image source={EMBLEMS.barbell} style={styles.recapEmblem} />
            <RNView style={[styles.recapLabel, styles.liftLabel]}>
              {lift.strength_tier != null && (
                <TierBadge tier={lift.strength_tier as StrengthTier} size="tiny" bordered={false} showTooltip={false} />
              )}
              <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.liftText}>
                PR — {liftName(lift.exercise_id)} ×{SCORING.prMultiplier}
              </Text>
            </RNView>
            <Text variant="meta" weight="bold" style={{ color: GOLD }}>
              +{pts(prPoints(lift))}
            </Text>
          </RNView>
        ))}

        {/* Top lifts of the week — the recap half: what they actually moved. */}
        {row.topLifts.length > 0 && (
          <RNView style={styles.topLifts}>
            <SectionLabel style={styles.topLiftsLabel}>Top lifts</SectionLabel>
            {row.topLifts.slice(0, 4).map(lift => (
              <RNView key={lift.exercise_id} style={styles.recapLine}>
                <RNView style={[styles.recapLabel, styles.liftLabel]}>
                  {lift.strength_tier != null && (
                    <TierBadge tier={lift.strength_tier as StrengthTier} size="tiny" bordered={false} showTooltip={false} />
                  )}
                  <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.liftText}>
                    {liftName(lift.exercise_id)}
                  </Text>
                  {lift.is_pr && (
                    <Text variant="meta" weight="bold" style={{ color: GOLD }}>PR</Text>
                  )}
                </RNView>
                <Text variant="meta" weight="semiBold" tone="primary">
                  {Math.round(lift.week_best)} lbs
                </Text>
              </RNView>
            ))}
          </RNView>
        )}

        {row.points === 0 && (
          <Text variant="meta" tone="faint">No points yet this week.</Text>
        )}

        {/* The chase — XP-bar to the leader. */}
        {chase && (
          <RNView style={styles.chaseBlock}>
            <RNView style={[styles.chaseTrack, { backgroundColor: ink.hairline }]}>
              <RNView style={[styles.chaseFill, { width: `${chase.pct}%`, backgroundColor: GOLD }]} />
            </RNView>
            <Text variant="meta" tone="secondary">
              <Text variant="meta" weight="bold" style={{ color: GOLD }}>{pts(chase.gap)} pts</Text> to catch {active[0]?.username}
            </Text>
          </RNView>
        )}

        <TouchableOpacity onPress={() => openProfile(row)} activeOpacity={0.7}>
          <Text variant="meta" weight="semiBold" tone="faint">
            View profile
          </Text>
        </TouchableOpacity>
      </RNView>
    );
  };

  // ——— Rows ———

  const renderRow = (row: LeagueStanding, index: number) => {
    const isHero = index === 0;
    const isYou = myUser != null && row.userId === myUser.id;
    const isChampion = champion != null && row.userId === champion.userId;
    const isExpanded = expandedId === row.userId;

    return (
      <Animated.View key={row.userId} entering={FadeInDown.duration(220).delay(Math.min(index, 12) * 35)}>
        <TouchableOpacity
          style={[
            styles.entryRow,
            isHero && styles.heroRow,
            isYou && [styles.youRow, {
              backgroundColor: tint(currentTheme.colors.primary),
              borderLeftColor: currentTheme.colors.primary,
            }],
          ]}
          onPress={() => setExpandedId(isExpanded ? null : row.userId)}
          activeOpacity={0.7}
        >
          <RNView style={styles.rankCell}>
            <Text
              variant={isHero ? 'statHero' : 'body'}
              weight={isHero ? 'bold' : index < 3 ? 'semiBold' : 'regular'}
              tone={isHero ? undefined : index < 3 ? 'primary' : 'faint'}
              style={isHero ? { color: GOLD } : undefined}
            >
              {row.rank}
            </Text>
          </RNView>

          {renderAvatar(row, isHero ? 44 : 32)}

          <RNView style={styles.userInfo}>
            <RNView style={styles.usernameRow}>
              <Text
                variant={isHero ? 'emphasis' : 'body'}
                weight={isHero || isYou ? 'semiBold' : 'medium'}
                tone={isYou || row.isFriend || isHero ? 'primary' : 'secondary'}
                numberOfLines={1}
                style={styles.usernameText}
              >
                {row.username}
              </Text>
              {isChampion && <Image source={EMBLEMS.trophy} style={styles.inlineEmblem} />}
              {isYou && <Text variant="meta" tone="faint">you</Text>}
            </RNView>
            <Text variant="meta" tone="muted" numberOfLines={1}>
              {formatVolume(row.breakdown.volumeLbs, 'lbs')}
              {row.breakdown.prCount > 0 && (
                <Text variant="meta" weight="semiBold" style={{ color: GOLD }}>
                  {`  ·  ${row.breakdown.prCount} PR${row.breakdown.prCount === 1 ? '' : 's'}`}
                </Text>
              )}
            </Text>
          </RNView>

          <RNView style={styles.valueCell}>
            <Text
              variant={isHero ? 'statHero' : 'body'}
              weight={isHero ? 'bold' : 'medium'}
              tone={isHero ? undefined : 'primary'}
              style={isHero ? styles.glowGold : undefined}
            >
              {pts(row.points)}
            </Text>
            <Text variant="meta" weight="regular" tone="faint">pts</Text>
          </RNView>
        </TouchableOpacity>
        {isExpanded && renderRecap(row)}
      </Animated.View>
    );
  };

  // The legend that answers "why": every way to score, in real units.
  const renderRules = () => (
    <RNView style={styles.rules}>
      {[
        { emblem: 'plate' as const, rule: 'Every pound you lift', pts: '+1', cap: 'weight × reps, all week' },
        { emblem: 'barbell' as const, gold: true, rule: 'PR any lift', pts: `×${SCORING.prMultiplier}`, cap: 'its e1RM × 50 — a 600 lb pull pays 30K' },
      ].map(r => (
        <RNView key={r.rule} style={styles.recapLine}>
          <Image source={EMBLEMS[r.emblem]} style={styles.recapEmblem} />
          <Text variant="meta" tone="secondary" style={styles.recapLabel}>
            {r.rule} <Text variant="meta" tone="faint">· {r.cap}</Text>
          </Text>
          <Text variant="meta" weight="semiBold" style={r.gold ? { color: GOLD } : undefined}>{r.pts}</Text>
        </RNView>
      ))}
    </RNView>
  );

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
              Last week&apos;s champion: <Text variant="meta" weight="bold" style={{ color: GOLD }}>{champion.username}</Text>
            </Text>
          </RNView>
        )}

        {active.map(renderRow)}

        {standings != null && standings.restingFriends.length > 0 && (
          <Text variant="meta" tone="faint" numberOfLines={2} style={styles.restingLine}>
            Resting this week: {standings.restingFriends.map(f => f.user.username).join(', ')}
          </Text>
        )}

        <TouchableOpacity onPress={() => setShowRules(!showRules)} activeOpacity={0.7} style={styles.rulesToggle}>
          <SectionLabel style={styles.rulesToggleLabel}>
            {showRules ? 'Hide scoring' : 'How scoring works'}
          </SectionLabel>
        </TouchableOpacity>
        {showRules && renderRules()}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <IconButton icon="close" onPress={onClose} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <RNView style={styles.bannerWrap}>
            <Image source={LEAGUE_HEADER} style={styles.banner} resizeMode="contain" />
            <RNView style={styles.bannerTextWrap}>
              <Text variant="title" weight="bold" style={styles.bannerTitle}>
                WEEKLY LEAGUE
              </Text>
              <Text variant="meta" weight="semiBold" style={styles.bannerSub}>
                {daysLeft} {daysLeft === 1 ? 'DAY' : 'DAYS'} LEFT
              </Text>
            </RNView>
          </RNView>
          {renderWeekBoard()}
        </ScrollView>

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
    paddingTop: space.sm,
  },
  headerSpacer: {
    width: 40,
  },
  bannerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    width: '100%',
    height: 150,
  },
  bannerTextWrap: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
  },
  bannerTitle: {
    color: '#F5C84C',
    letterSpacing: 2,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  bannerSub: {
    color: '#C7CBD4',
    letterSpacing: 2,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  glowGold: {
    color: '#F5C84C',
    textShadowColor: '#F59E0B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: space.section,
  },
  list: {
    gap: space.xs,
  },
  championLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingBottom: space.md,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    gap: space.md,
  },
  heroRow: {
    paddingVertical: space.lg,
  },
  youRow: {
    borderLeftWidth: 2,
    borderRadius: radius.badge,
    paddingLeft: space.sm,
    marginLeft: -space.sm,
  },
  rankCell: {
    width: 36,
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 3,
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
  recap: {
    marginLeft: 36 + space.md,
    paddingLeft: space.md,
    paddingBottom: space.lg,
    gap: space.sm,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(245, 158, 11, 0.35)',
  },
  recapLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  recapEmblem: {
    width: 14,
    height: 14,
  },
  recapLabel: {
    flex: 1,
  },
  liftLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  liftText: {
    flexShrink: 1,
  },
  topLifts: {
    marginTop: space.sm,
    gap: space.sm,
  },
  topLiftsLabel: {
    marginBottom: 0,
  },
  chaseBlock: {
    gap: space.xs,
    marginTop: space.sm,
  },
  chaseTrack: {
    height: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  chaseFill: {
    height: '100%',
  },
  rules: {
    gap: space.sm,
    paddingVertical: space.md,
  },
  rulesToggle: {
    paddingVertical: space.sm,
    marginTop: space.lg,
  },
  rulesToggleLabel: {
    marginBottom: 0,
  },
  restingLine: {
    paddingTop: space.md,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
