import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import { Text, useInk, View } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import SectionLabel from '@/components/ui/SectionLabel';
import UserProfileModal from '@/components/profile/UserProfileModal';
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
import { screenGutter, space, tint } from '@/lib/ui/tokens';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { formatVolume } from '@/lib/utils/utils';
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
import Svg, { Polygon } from 'react-native-svg';

// League iconography is the pixel emblem set — no Ionicons, no emoji (spec).
const EMBLEMS = {
  trophy: require('@/assets/achievements/trophy.png'),
  sword: require('@/assets/achievements/sword.png'),
  plate: require('@/assets/achievements/plate.png'),
  barbell: require('@/assets/achievements/barbell.png'),
  laurel: require('@/assets/achievements/laurel.png'),
};

// One neon stroke (theme primary); gold is reserved for PR/champion moments.
// docs/league-visual-goal.md — do not add hues.
const GOLD = TIER_COLORS.S;

interface LeagueBoardProps {
  visible: boolean;
  onClose: () => void;
}

const liftName = (exerciseId: string) => getCatalogExercise(exerciseId)?.name ?? exerciseId;

/** Pointy-top hexagon vertices inside a size×size box, inset for the stroke. */
const hexPoints = (size: number): string => {
  const c = size / 2;
  const r = size / 2 - 2;
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90);
    return `${(c + r * Math.cos(angle)).toFixed(2)},${(c + r * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
};

export default function LeagueBoard({ visible, onClose }: LeagueBoardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [isLoading, setIsLoading] = useState(false);
  const [standings, setStandings] = useState<LeagueStandings | null>(null);
  const [champion, setChampion] = useState<LeagueStanding | null>(null);
  const [myUser, setMyUser] = useState<RemoteUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      // The viewer's own hex starts selected so their receipt is one glance away.
      setSelectedId(built.me?.rank != null ? me.id : built.active[0]?.userId ?? null);

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
      loadLeague();
    }
  }, [visible, loadLeague]);

  const daysLeft = useMemo(() => {
    const { end } = weekBounds(new Date());
    return Math.max(1, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  }, []);

  const me = standings?.me ?? null;
  const active = standings?.active ?? [];
  const selected = active.find(s => s.userId === selectedId) ?? null;

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

  // ——— Hexes ———

  const renderHex = (row: LeagueStanding, size: number, ghosted = false) => {
    const isYou = myUser != null && row.userId === myUser.id;
    const isSelected = selectedId === row.userId;
    const isChampion = champion != null && row.userId === champion.userId;
    const stroke = isYou || isSelected ? currentTheme.colors.primary : ink.faint;
    const avatarSize = Math.round(size * 0.38);

    return (
      <TouchableOpacity
        key={row.userId}
        style={[styles.hexCell, ghosted && styles.ghosted]}
        onPress={() => setSelectedId(isSelected ? null : row.userId)}
        activeOpacity={0.7}
      >
        <RNView style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Polygon
              points={hexPoints(size)}
              fill={isYou ? tint(currentTheme.colors.primary) : 'none'}
              stroke={stroke}
              strokeWidth={isYou || isSelected ? 2 : 1}
            />
          </Svg>
          {renderAvatar(row, avatarSize)}
          <Text
            variant={size >= 100 ? 'emphasis' : 'meta'}
            weight="bold"
            tone="primary"
            style={styles.hexPoints}
          >
            {row.points}
          </Text>
          {isChampion && <Image source={EMBLEMS.trophy} style={styles.hexTrophy} />}
        </RNView>
        <Text
          variant="meta"
          weight={isYou ? 'bold' : 'medium'}
          tone={isYou || row.isFriend ? 'primary' : 'secondary'}
          numberOfLines={1}
          style={styles.hexName}
        >
          {isYou ? 'you' : row.username}
        </Text>
        {row.breakdown.prCount > 0 && !ghosted && (
          <Text variant="meta" weight="semiBold" style={{ color: GOLD }}>
            {row.breakdown.prCount} PR{row.breakdown.prCount === 1 ? '' : 's'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderArena = () => {
    const [leader, ...rest] = active;
    const contenders = rest.slice(0, 2);
    const field = rest.slice(2);
    const resting = standings?.restingFriends ?? [];

    return (
      <RNView style={styles.arena}>
        <Animated.View entering={FadeInDown.duration(240)} style={styles.arenaRow}>
          {leader && renderHex(leader, 128)}
        </Animated.View>
        {contenders.length > 0 && (
          <Animated.View entering={FadeInDown.duration(240).delay(60)} style={styles.arenaRow}>
            {contenders.map(row => renderHex(row, 92))}
          </Animated.View>
        )}
        {field.length > 0 && (
          <Animated.View entering={FadeInDown.duration(240).delay(120)} style={[styles.arenaRow, styles.arenaWrap]}>
            {field.map(row => renderHex(row, 68))}
          </Animated.View>
        )}
        {resting.length > 0 && (
          <RNView style={styles.restingBlock}>
            <SectionLabel style={styles.restingLabel}>Resting</SectionLabel>
            <RNView style={[styles.arenaRow, styles.arenaWrap]}>
              {resting.map(f =>
                renderHex(
                  {
                    userId: f.user.id,
                    username: f.user.username,
                    profilePictureUrl: f.user.profile_picture_url ?? null,
                    isFriend: true,
                    rank: null,
                    points: 0,
                    prs: [],
                    gapToAhead: null,
                    breakdown: {
                      volumePoints: 0, prPoints: 0, gainPoints: 0, goalBonus: 0,
                      total: 0, volumeLbs: 0, activeDays: 0, prCount: 0, bestGainPct: null,
                    },
                  },
                  48,
                  true,
                ),
              )}
            </RNView>
          </RNView>
        )}
      </RNView>
    );
  };

  // ——— Receipt for the selected hex ———

  const renderReceipt = (row: LeagueStanding) => {
    const countedPRs = row.prs.slice(0, SCORING.prCap);
    const lines: { key: string; emblem: keyof typeof EMBLEMS; gold?: boolean; label: string; pts: number }[] = [];

    if (row.breakdown.volumePoints > 0) {
      lines.push({
        key: 'volume',
        emblem: 'plate',
        label: `Lifted ${formatVolume(row.breakdown.volumeLbs, 'lbs')} over ${row.breakdown.activeDays} ${row.breakdown.activeDays === 1 ? 'day' : 'days'}`,
        pts: row.breakdown.volumePoints,
      });
    }
    countedPRs.forEach((pr, i) => {
      lines.push({
        key: `pr-${pr.exercise_id}`,
        emblem: 'barbell',
        gold: true,
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
        label: `${SCORING.goalBonusDays}-day week`,
        pts: row.breakdown.goalBonus,
      });
    }

    const isYou = myUser != null && row.userId === myUser.id;

    return (
      <RNView style={styles.receiptPanel}>
        <TouchableOpacity style={styles.receiptHeader} onPress={() => openProfile(row)} activeOpacity={0.7}>
          <SectionLabel style={styles.receiptTitle}>
            {isYou ? 'Your week' : `${row.username}'s week`}
          </SectionLabel>
        </TouchableOpacity>
        {lines.length === 0 ? (
          <Text variant="meta" tone="faint">No points yet this week.</Text>
        ) : (
          <RNView style={[styles.receipt, { borderLeftColor: ink.hairline }]}>
            {lines.map(line => (
              <RNView key={line.key} style={styles.receiptLine}>
                <Image source={EMBLEMS[line.emblem]} style={styles.receiptEmblem} />
                <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.receiptLabel}>
                  {line.label}
                </Text>
                <Text variant="meta" weight="semiBold" style={line.gold ? { color: GOLD } : undefined}>
                  +{line.pts}
                </Text>
              </RNView>
            ))}
          </RNView>
        )}
      </RNView>
    );
  };

  // The legend that answers "why": every way to score, emblem + rule + points.
  const renderRules = () => (
    <RNView style={styles.rules}>
      {[
        { emblem: 'plate' as const, rule: `Every ${formatVolume(SCORING.lbsPerPoint, 'lbs')} lifted`, pts: '+1', cap: `up to ${SCORING.volumePointsCap}/week` },
        { emblem: 'barbell' as const, gold: true, rule: 'PR any lift', pts: `+${SCORING.pointsPerPR}`, cap: `up to ${SCORING.prCap}, bigger gain = bigger bonus` },
        { emblem: 'laurel' as const, rule: `Train ${SCORING.goalBonusDays} days`, pts: `+${SCORING.goalBonus}`, cap: 'once a week' },
      ].map(r => (
        <RNView key={r.rule} style={styles.receiptLine}>
          <Image source={EMBLEMS[r.emblem]} style={styles.receiptEmblem} />
          <Text variant="meta" tone="secondary" style={styles.receiptLabel}>
            {r.rule} <Text variant="meta" tone="faint">· {r.cap}</Text>
          </Text>
          <Text variant="meta" weight="semiBold" style={r.gold ? { color: GOLD } : undefined}>{r.pts}</Text>
        </RNView>
      ))}
    </RNView>
  );

  // What I'd earn next — turns the rules into a to-do list.
  const nextPointsLine = useMemo(() => {
    if (!me) return null;
    const hints: string[] = [];
    if (me.breakdown.volumePoints < SCORING.volumePointsCap) {
      hints.push(`+1 per ${formatVolume(SCORING.lbsPerPoint, 'lbs')} lifted`);
    }
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

        {renderArena()}

        {selected && renderReceipt(selected)}

        {nextPointsLine && (
          <RNView style={styles.nextRow}>
            <Image source={EMBLEMS.sword} style={styles.nextEmblem} />
            <Text variant="meta" tone="secondary" style={styles.receiptLabel}>
              Next: {nextPointsLine}
            </Text>
          </RNView>
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

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
    paddingTop: space.md,
  },
  arena: {
    gap: space.lg,
    paddingTop: space.lg,
  },
  arenaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.section,
  },
  arenaWrap: {
    flexWrap: 'wrap',
    gap: space.lg,
  },
  hexCell: {
    alignItems: 'center',
    gap: 2,
  },
  ghosted: {
    opacity: 0.45,
  },
  hexPoints: {
    marginTop: 2,
  },
  hexTrophy: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
  },
  hexName: {
    maxWidth: 110,
    marginTop: space.xs,
  },
  inlineEmblem: {
    width: 16,
    height: 16,
  },
  receiptPanel: {
    marginTop: space.section,
    gap: space.xs,
  },
  receiptHeader: {
    alignSelf: 'flex-start',
  },
  receiptTitle: {
    marginBottom: 0,
  },
  receipt: {
    paddingLeft: space.md,
    gap: space.sm,
    borderLeftWidth: 2,
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
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
  nextEmblem: {
    width: 18,
    height: 18,
  },
  rules: {
    gap: space.sm,
    paddingBottom: space.md,
  },
  rulesToggle: {
    paddingVertical: space.sm,
    marginTop: space.lg,
  },
  rulesToggleLabel: {
    marginBottom: 0,
  },
  restingBlock: {
    marginTop: space.sm,
    gap: space.xs,
  },
  restingLabel: {
    textAlign: 'center',
    marginBottom: 0,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
