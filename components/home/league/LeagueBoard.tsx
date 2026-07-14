import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import TierBadge from '@/components/TierBadge';
import { Text, useInk, View } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import SectionLabel from '@/components/ui/SectionLabel';
import UserAvatar from '@/components/ui/UserAvatar';
import UserProfileModal from '@/components/profile/UserProfileModal';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor, StrengthTier, TIER_COLORS } from '@/lib/data/strengthStandards';
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
import { radius, screenGutter, space, tint, track } from '@/lib/ui/tokens';
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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  runOnJS,
  withRepeat,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Motion system (M3 Expressive, m3.material.io/styles/motion): physics springs
// in two schemes — EXPRESSIVE (low damping, visible settle) for the one hero
// moment, STANDARD (critically damped) for utilitarian movement — plus the
// emphasized-decelerate curve for spatial entrances (~350ms "fast" token).
const EMPHASIZED_DECEL = Easing.bezier(0.05, 0.7, 0.1, 1);

/** Spatial entrance on the emphasized-decelerate curve (web-safe, no Keyframe). */
function FadeSlideIn({
  delay = 0,
  distance = 10,
  style,
  children,
}: {
  delay?: number;
  distance?: number;
  style?: object;
  children: React.ReactNode;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 350, easing: EMPHASIZED_DECEL }));
  }, [delay, progress]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Height-animated disclosure: expanding pushes siblings smoothly (no snap). */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const height = useSharedValue(0);
  const measured = useSharedValue(0);
  useEffect(() => {
    height.value = withTiming(open ? measured.value : 0, { duration: 300, easing: EMPHASIZED_DECEL });
  }, [open, height, measured]);
  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: measured.value > 0 ? Math.min(1, height.value / measured.value) : 0,
  }));
  return (
    <Animated.View style={[styles.collapse, animatedStyle]}>
      <RNView
        style={styles.collapseInner}
        onLayout={e => {
          measured.value = e.nativeEvent.layout.height;
          if (open) height.value = withTiming(e.nativeEvent.layout.height, { duration: 300, easing: EMPHASIZED_DECEL });
        }}
      >
        {children}
      </RNView>
    </Animated.View>
  );
}

/** Micro-label for on-card use — one ink step brighter than SectionLabel. */
function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="meta" tone="secondary" weight="medium" style={styles.capsLabel}>
      {children}
    </Text>
  );
}

// League iconography stays in the pixel emblem set, used sparingly (spec).
const EMBLEMS = {
  trophy: require('@/assets/achievements/trophy.png'),
  sword: require('@/assets/achievements/sword.png'),
};

// One accent (theme primary) + gold strictly for PR/champion; tier colors live
// in TierBadge chips only. No gradients, no glows — type carries the weight.
const GOLD = TIER_COLORS.S;

interface LeagueBoardProps {
  visible: boolean;
  onClose: () => void;
}

const liftName = (exerciseId: string) => getCatalogExercise(exerciseId)?.name ?? exerciseId;
const pts = (value: number) => formatCompact(value);

/**
 * Rank mapped through the tier ladder, relative to the field: 1st of N sits at
 * the 100th percentile (S gold), last at the 0th (E gray). Points wear this.
 */
const rankTierColors = (
  rank: number | null,
  field: number,
): { pure: string; text: string } | null => {
  if (rank == null || field < 2) return null;
  const percentile = ((field - rank) / (field - 1)) * 100;
  const pure = getTierColor(getStrengthTier(percentile));
  // Text variant lifts toward white so numerals clear contrast on the
  // near-black canvas; strokes and fills use the pure hue.
  return { pure, text: lightenForText(pure) };
};

const lightenForText = (hex: string, amount = 0.35): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

/** The member's color for the week: the tier of their best lift (null = untinted). */
const weekTierColor = (row: LeagueStanding): string | null => {
  const tier = row.topLifts[0]?.strength_tier;
  return tier ? getTierColor(tier as StrengthTier) : null;
};

/** UI-thread count-up on the emphasized-decelerate curve (hero numeral only). */
function useCountUp(target: number, duration = 600): number {
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(80, withTiming(target, { duration, easing: EMPHASIZED_DECEL }));
  }, [target, duration, progress]);
  useAnimatedReaction(
    () => Math.round(progress.value),
    (value, previous) => {
      if (value !== previous) runOnJS(setDisplay)(value);
    },
  );
  return display;
}

/**
 * Share-of-leader × composition bar with a slow specular sweep across the
 * fill — the board's one piece of ambient motion (it reads as "live").
 */
function CompositionBar({
  sharePct,
  volumePoints,
  prPoints,
  accent,
  trackColor,
}: {
  sharePct: number;
  volumePoints: number;
  prPoints: number;
  accent: string;
  trackColor: string;
}) {
  const [trackW, setTrackW] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(
      withDelay(900, withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) })),
      -1,
      false,
    );
  }, [sweep]);
  const fillW = (trackW * Math.min(100, Math.max(sharePct, 0.5))) / 100;
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -48 + sweep.value * (fillW + 96) }],
  }));

  return (
    <RNView
      style={[styles.rowBarTrack, { backgroundColor: trackColor }]}
      onLayout={e => setTrackW(e.nativeEvent.layout.width)}
    >
      <RNView style={[styles.rowBar, { width: fillW }]}>
        {volumePoints > 0 && <RNView style={{ flex: volumePoints, backgroundColor: accent }} />}
        {prPoints > 0 && <RNView style={{ flex: prPoints, backgroundColor: GOLD }} />}
        <Animated.View pointerEvents="none" style={[styles.sweepBand, sweepStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.18)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sweepFill}
          />
        </Animated.View>
      </RNView>
    </RNView>
  );
}

/** WHOOP-style ring: your share of the leader's total, rank in the center. */
function RankRing({
  pct,
  rank,
  color,
  trackColor,
  size = 96,
}: {
  pct: number;
  rank: number | null;
  color: string;
  trackColor: string;
  size?: number;
}) {
  const strokeWidth = 7;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);
  useEffect(() => {
    // A gauge is a measurement, not an object in motion: one decelerating
    // sweep, no overshoot (an underdamped spring here reads as error).
    progress.value = withTiming(pct, { duration: 700, easing: EMPHASIZED_DECEL });
  }, [pct, progress]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.min(progress.value, 100) / 100),
  }));

  // Same specular sheen as the bars: a short bright arc travelling the fill.
  const SHEEN_LEN = 22;
  const sheen = useSharedValue(0);
  useEffect(() => {
    sheen.value = withRepeat(
      withDelay(900, withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) })),
      -1,
      false,
    );
  }, [sheen]);
  const sheenProps = useAnimatedProps(() => {
    const fillLen = (circumference * Math.min(progress.value, 100)) / 100;
    const travel = Math.max(fillLen - SHEEN_LEN, 0);
    return {
      strokeDashoffset: -(sheen.value * travel),
      opacity: fillLen > SHEEN_LEN * 1.5 ? 1 : 0,
    };
  });

  return (
    <RNView style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${SHEEN_LEN} ${circumference}`}
          animatedProps={sheenProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="title" weight="bold" tone="primary">
        {rank != null ? `#${rank}` : '—'}
      </Text>
    </RNView>
  );
}

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
  const leaderPoints = active[0]?.points ?? 0;
  const heroPoints = useCountUp(me?.points ?? 0);

  const openProfile = (row: LeagueStanding) => {
    setSelectedUser({
      id: row.userId,
      device_id: '',
      username: row.username,
      profile_picture_url: row.profilePictureUrl ?? undefined,
    });
  };

  // ——— Hero: your week compressed into one numeral + the ring (WHOOP grammar) ———

  const renderHero = () => {
    if (!me) return null;
    const pct = me.rank === 1 ? 100 : leaderPoints > 0 ? (me.points / leaderPoints) * 100 : 0;
    const gap = leaderPoints - me.points;
    const heroColor = rankTierColors(me.rank, active.length);

    return (
      <FadeSlideIn distance={6} style={styles.hero}>
        <RankRing
          pct={pct}
          rank={me.rank}
          color={heroColor?.pure ?? currentTheme.colors.primary}
          trackColor={ink.ghost}
        />
        <RNView style={styles.heroBody}>
          <SectionLabel style={styles.heroLabel}>Weekly points</SectionLabel>
          <RNView>
            <Text variant="header" weight="bold" tone="primary" style={[styles.tabularNums, styles.ghostNumeral]}>
              {pts(me.points)}
            </Text>
            <Text
              variant="header"
              weight="bold"
              tone={heroColor ? undefined : 'primary'}
              style={[styles.tabularNums, StyleSheet.absoluteFill, heroColor != null && { color: heroColor.text }]}
            >
              {pts(heroPoints)}
            </Text>
          </RNView>
          <Text variant="meta" tone="secondary" numberOfLines={1}>
            {me.rank === 1
              ? active.length > 1
                ? `Leading by ${pts(me.points - (active[1]?.points ?? 0))}`
                : 'Top of the board'
              : me.rank != null
              ? `${pts(gap)} behind ${active[0]?.username}`
              : 'Log a session to enter'}
          </Text>
          <Text variant="meta" tone="muted" numberOfLines={1}>
            {formatVolume(me.breakdown.volumeLbs, 'lbs')}
            {me.breakdown.prCount > 0 ? ` · ${me.breakdown.prCount} PR${me.breakdown.prCount === 1 ? '' : 's'}` : ''}
            {` · ${me.sessions} ${me.sessions === 1 ? 'session' : 'sessions'}`}
            {me.breakdown.activeDays !== me.sessions ? ` · ${me.breakdown.activeDays}d` : ''}
          </Text>
        </RNView>
      </FadeSlideIn>
    );
  };

  // ——— Recap: WHOOP stat grid + the lifts that made the week ———

  const renderRecap = (row: LeagueStanding) => {
    const prs = row.topLifts.filter(lift => lift.is_pr);

    return (
      <RNView
        style={[styles.recapCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
      >
        <RNView style={styles.statGrid}>
          {[
            { label: 'Volume', value: formatVolume(row.breakdown.volumeLbs, 'lbs') },
            { label: 'Volume pts', value: `+${pts(row.breakdown.volumePoints)}`, color: currentTheme.colors.primary },
            { label: 'Days', value: String(row.breakdown.activeDays) },
            { label: 'Sessions', value: String(row.sessions) },
            { label: 'Best lift', value: row.topLifts[0] ? `${Math.round(row.topLifts[0].week_best)} lbs` : '—', color: weekTierColor(row) ?? undefined },
            { label: 'PR pts', value: row.breakdown.prPoints > 0 ? `+${pts(row.breakdown.prPoints)}` : '0', color: row.breakdown.prPoints > 0 ? GOLD : undefined },
          ].map(cell => (
            <RNView key={cell.label} style={styles.statCell}>
              <Text
                variant="emphasis"
                weight="semiBold"
                tone={cell.color ? undefined : 'primary'}
                style={[styles.tabularNums, cell.color != null && { color: cell.color }]}
              >
                {cell.value}
              </Text>
              <CardLabel>{cell.label}</CardLabel>
            </RNView>
          ))}
        </RNView>

        {prs.map(lift => (
          <RNView key={`pr-${lift.exercise_id}`} style={styles.prBlock}>
            <RNView style={styles.liftLine}>
              {lift.strength_tier != null && (
                <TierBadge tier={lift.strength_tier as StrengthTier} size="tiny" bordered={false} showTooltip={false} />
              )}
              <Text variant="meta" weight="semiBold" tone="primary" numberOfLines={1} style={styles.liftText}>
                PR — {liftName(lift.exercise_id)}
              </Text>
              <Text variant="meta" weight="bold" style={{ color: GOLD }}>
                +{pts(prPoints(lift))}
              </Text>
            </RNView>
            <Text variant="meta" tone="secondary" style={styles.prDetail}>
              {lift.prior_best != null ? `${Math.round(lift.prior_best)} → ` : ''}{Math.round(lift.week_best)} lbs
              {lift.gain_pct != null ? ` · +${lift.gain_pct.toFixed(1)}%` : ''}
            </Text>
          </RNView>
        ))}

        {row.topLifts.length > 0 && (
          <RNView style={styles.topLifts}>
            <CardLabel>Top lifts</CardLabel>
            {row.topLifts.slice(0, 4).map(lift => (
              <RNView key={lift.exercise_id} style={styles.liftLine}>
                {lift.strength_tier != null && (
                  <TierBadge tier={lift.strength_tier as StrengthTier} size="tiny" bordered={false} showTooltip={false} />
                )}
                <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.liftText}>
                  {liftName(lift.exercise_id)}
                </Text>
                {lift.is_pr && (
                  <Text variant="meta" weight="bold" style={{ color: GOLD }}>PR</Text>
                )}
                <Text
                  variant="meta"
                  weight="semiBold"
                  tone={lift.strength_tier ? undefined : 'primary'}
                  style={[styles.tabularNums, lift.strength_tier != null && { color: getTierColor(lift.strength_tier as StrengthTier) }]}
                >
                  {Math.round(lift.week_best)} lbs
                </Text>
              </RNView>
            ))}
          </RNView>
        )}

        {row.points === 0 && (
          <Text variant="meta" tone="muted">No points yet this week.</Text>
        )}
      </RNView>
    );
  };

  // ——— Standings: Spotify chart rows — rank, identity, metric, relative bar ———

  const renderRow = (row: LeagueStanding, index: number) => {
    const isYou = myUser != null && row.userId === myUser.id;
    const isChampion = champion != null && row.userId === champion.userId;
    const isExpanded = expandedId === row.userId;
    const sharePct = leaderPoints > 0 ? (row.points / leaderPoints) * 100 : 0;
    const rankColor = rankTierColors(row.rank, active.length);

    return (
      <FadeSlideIn key={row.userId} delay={Math.min(index, 10) * 30}>
        <TouchableOpacity
          style={styles.entryRow}
          onPress={() => setExpandedId(isExpanded ? null : row.userId)}
          activeOpacity={0.6}
        >
        <RNView style={styles.entryContent}>
          <Text
            variant="body"
            weight={index === 0 ? 'bold' : 'medium'}
            tone={index === 0 ? undefined : 'secondary'}
            style={[styles.rankCell, styles.tabularNums, index === 0 && { color: GOLD }]}
          >
            {row.rank}
          </Text>

          <TouchableOpacity onPress={() => openProfile(row)} activeOpacity={0.7}>
            <RNView
              style={[
                styles.avatarRing,
                { borderColor: weekTierColor(row) ?? 'transparent' },
              ]}
            >
              <UserAvatar uri={row.profilePictureUrl} username={row.username} size={36} />
            </RNView>
          </TouchableOpacity>

          <RNView style={styles.userInfo}>
            <RNView style={styles.usernameRow}>
              <Text
                variant="body"
                weight={isYou || index === 0 ? 'semiBold' : 'medium'}
                tone={isYou || row.isFriend || index === 0 ? 'primary' : 'secondary'}
                numberOfLines={1}
                style={styles.usernameText}
              >
                {isYou ? 'You' : row.username}
              </Text>
              {isChampion && <Image source={EMBLEMS.trophy} style={styles.inlineEmblem} />}
            </RNView>
            <Text variant="meta" tone="muted" numberOfLines={1}>
              {row.breakdown.prCount > 0 ? (
                <>
                  {formatVolume(row.breakdown.volumeLbs, 'lbs')}
                  <Text variant="meta" weight="semiBold" style={{ color: GOLD }}>
                    {` · ${row.breakdown.prCount} PR${row.breakdown.prCount === 1 ? '' : 's'}`}
                  </Text>
                </>
              ) : row.topLifts[0] ? (
                `Best ${Math.round(row.topLifts[0].week_best)} lbs · ${row.sessions} ${row.sessions === 1 ? 'session' : 'sessions'}`
              ) : (
                `${row.sessions} ${row.sessions === 1 ? 'session' : 'sessions'} · ${row.breakdown.activeDays}d`
              )}
            </Text>
          </RNView>

          <RNView style={styles.valueCell}>
            <Text
              variant="body"
              weight="semiBold"
              tone={rankColor ? undefined : 'primary'}
              style={[styles.tabularNums, rankColor != null && { color: rankColor.text }]}
            >
              {pts(row.points)}
            </Text>
            <Text variant="meta" tone="muted">{isExpanded ? '▾' : '▸'}</Text>
          </RNView>
        </RNView>

        {/* Standing AND composition in one stroke: width = share of the
            leader; primary = volume points, gold = PR points. */}
        <CompositionBar
          sharePct={sharePct}
          volumePoints={row.breakdown.volumePoints}
          prPoints={row.breakdown.prPoints}
          accent={rankColor?.pure ?? currentTheme.colors.primary}
          trackColor={ink.ghost}
        />
        </TouchableOpacity>
        <Collapse open={isExpanded}>{renderRecap(row)}</Collapse>
      </FadeSlideIn>
    );
  };

  // The legend that answers "why": every way to score, in real units.
  const renderRules = () => (
    <RNView style={styles.rules}>
      {[
        { rule: 'Every pound you lift', pts: '+1', cap: 'weight × reps, all week' },
        { rule: 'PR any lift', pts: `×${SCORING.prMultiplier}`, cap: 'its e1RM × 50 — a 600 lb pull pays 30K', gold: true },
      ].map(r => (
        <RNView key={r.rule} style={styles.liftLine}>
          <Text variant="meta" tone="secondary" style={styles.liftText}>
            {r.rule} <Text variant="meta" tone="muted">· {r.cap}</Text>
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
        {renderHero()}

        {champion && (
          <RNView style={styles.championLine}>
            <Image source={EMBLEMS.trophy} style={styles.inlineEmblem} />
            <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.liftText}>
              Last week: <Text variant="meta" weight="semiBold" tone="primary">{champion.username}</Text>
            </Text>
            <Text variant="meta" weight="semiBold" tone="secondary" style={styles.tabularNums}>
              {pts(champion.points)} pts
            </Text>
          </RNView>
        )}

        <RNView style={styles.columnsRow}>
          <SectionLabel style={styles.standingsLabel}>This week</SectionLabel>
          <SectionLabel style={styles.standingsLabel}>Pts</SectionLabel>
        </RNView>
        {active.every(s => s.breakdown.prCount === 0) && (
          <Text variant="meta" tone="muted" style={styles.nudgeLine}>
            No PRs yet — the first one pays its e1RM ×{SCORING.prMultiplier}
          </Text>
        )}
        {active.map(renderRow)}

        {standings != null && standings.restingFriends.length > 0 && (
          <RNView style={styles.restingBlock}>
            <SectionLabel style={styles.statLabel}>Resting</SectionLabel>
            <RNView style={styles.restingChips}>
              {standings.restingFriends.map(f => (
                <RNView
                  key={f.user.id}
                  style={[styles.restingChip, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                >
                  <UserAvatar uri={f.user.profile_picture_url} username={f.user.username} size={20} />
                  <Text variant="meta" tone="secondary">{f.user.username}</Text>
                </RNView>
              ))}
            </RNView>
          </RNView>
        )}

        {active.length <= 5 ? (
          <RNView style={styles.rulesToggle}>
            <SectionLabel style={styles.statLabel}>Scoring</SectionLabel>
            {renderRules()}
          </RNView>
        ) : (
          <>
            <TouchableOpacity onPress={() => setShowRules(!showRules)} activeOpacity={0.7} style={styles.rulesToggle}>
              <SectionLabel style={styles.statLabel}>
                {showRules ? 'Scoring ▾' : 'Scoring ▸'}
              </SectionLabel>
            </TouchableOpacity>
            {showRules && renderRules()}
          </>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.header}>
          <RNView>
            <Text variant="heading" weight="bold" tone="primary">
              Weekly League
            </Text>
            <Text variant="meta" tone="muted">
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.md,
    paddingBottom: space.section,
  },
  list: {
    gap: space.xs,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    paddingVertical: space.lg,
  },
  heroBody: {
    flex: 1,
    gap: 3,
  },
  heroLabel: {
    marginBottom: 0,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'],
  },
  championLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    marginBottom: space.sm,
  },
  columnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nudgeLine: {
    paddingBottom: space.sm,
  },
  valueCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  standingsLabel: {
    marginBottom: 0,
    paddingBottom: space.xs,
  },
  entryRow: {
    paddingVertical: space.md,
    gap: space.sm,
  },
  entryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  rankCell: {
    width: 24,
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  avatarRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 14,
    height: 14,
  },
  rowBarTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginLeft: 24 + space.md + 40 + space.md,
  },
  rowBar: {
    flexDirection: 'row',
    height: '100%',
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  sweepBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 48,
  },
  sweepFill: {
    flex: 1,
  },
  recapCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
    marginBottom: space.sm,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.lg,
  },
  statCell: {
    width: '50%',
    gap: 2,
  },
  statLabel: {
    marginBottom: 0,
  },
  liftLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  liftText: {
    flex: 1,
  },
  topLifts: {
    gap: space.sm,
  },
  rules: {
    gap: space.sm,
    paddingVertical: space.md,
  },
  rulesToggle: {
    paddingVertical: space.sm,
    marginTop: space.lg,
  },
  restingBlock: {
    paddingTop: space.lg,
    gap: space.sm,
  },
  restingChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  restingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  collapse: {
    overflow: 'hidden',
  },
  collapseInner: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  ghostNumeral: {
    opacity: 0,
  },
  prBlock: {
    gap: 2,
  },
  prDetail: {
    paddingLeft: 26,
  },
  capsLabel: {
    letterSpacing: track.caps,
    textTransform: 'uppercase',
  },
});
