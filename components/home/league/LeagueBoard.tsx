import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import { Text, useInk, View } from '@/components/Themed';
import EmptyState from '@/components/ui/EmptyState';
import NavRow from '@/components/ui/NavRow';
import SectionLabel from '@/components/ui/SectionLabel';
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
import { buildWeekStory, LeagueEvent, StoryDay, StoryMoment } from '@/lib/leagues/story';
import { LeagueStanding, SCORING } from '@/lib/leagues/types';
import { userSyncService } from '@/lib/services/userSyncService';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { dateKey } from '@/lib/utils/utils';
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

// League iconography is the pixel emblem set — no Ionicons, no emoji (spec).
const EMBLEMS = {
  trophy: require('@/assets/achievements/trophy.png'),
  sword: require('@/assets/achievements/sword.png'),
  flame: require('@/assets/achievements/flame.png'),
  barbell: require('@/assets/achievements/barbell.png'),
  laurel: require('@/assets/achievements/laurel.png'),
};

// One neon stroke (theme primary); gold is reserved for PR/champion moments.
// docs/league-visual-goal.md — do not add hues.
const GOLD = TIER_COLORS.S;

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
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [champion, setChampion] = useState<LeagueStanding | null>(null);
  const [myUser, setMyUser] = useState<RemoteUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showLadder, setShowLadder] = useState(false);
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

      const [me, friends, rows, weekEvents, prevRows] = await Promise.all([
        userSyncService.getCurrentUser(),
        userSyncService.getFriends(),
        userSyncService.getLeagueWeek(start, end),
        userSyncService.getLeagueEvents(start, end),
        userSyncService.getLeagueWeek(prevStart, start),
      ]);
      setMyUser(me);
      if (!me) {
        setStandings(null);
        setEvents([]);
        return;
      }

      setStandings(buildStandings(rows, friends, me.id));
      setEvents(weekEvents);
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
      setShowLadder(false);
      loadLeague();
    }
  }, [visible, loadLeague]);

  const daysLeft = useMemo(() => {
    const { end } = weekBounds(new Date());
    return Math.max(1, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  }, []);

  const me = standings?.me ?? null;
  const active = standings?.active ?? [];
  const story = useMemo(() => buildWeekStory(events), [events]);
  const todayKey = dateKey(new Date());
  const storyHasToday = story.some(d => d.dayKey === todayKey);

  const handleUserPress = (userId: string, username: string, profilePictureUrl: string | null) => {
    setSelectedUser({
      id: userId,
      device_id: '',
      username,
      profile_picture_url: profilePictureUrl ?? undefined,
    });
  };

  const renderAvatar = (username: string, profilePictureUrl: string | null, size: number) => {
    if (profilePictureUrl) {
      return (
        <Image
          source={{ uri: profilePictureUrl }}
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
          {username ? username.charAt(0).toUpperCase() : '?'}
        </Text>
      </RNView>
    );
  };

  // ——— The standings strip: always visible, one line, taps open the ladder ———

  const renderStrip = () => {
    if (active.length === 0) return null;
    return (
      <TouchableOpacity onPress={() => setShowLadder(!showLadder)} activeOpacity={0.7}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {active.map((row, index) => {
            const isYou = myUser != null && row.userId === myUser.id;
            return (
              <RNView key={row.userId} style={styles.stripEntry}>
                <Text variant="meta" weight="bold" tone={index === 0 ? 'primary' : 'faint'}>
                  {row.rank}
                </Text>
                <Text
                  variant="meta"
                  weight={isYou ? 'bold' : 'medium'}
                  tone={isYou || row.isFriend || index === 0 ? 'primary' : 'secondary'}
                  numberOfLines={1}
                  style={isYou ? { color: currentTheme.colors.primary } : undefined}
                >
                  {isYou ? 'you' : row.username}
                </Text>
                <Text variant="meta" weight="semiBold" tone="muted">
                  {row.points}
                </Text>
                {index < active.length - 1 && (
                  <Text variant="meta" tone="ghost">·</Text>
                )}
              </RNView>
            );
          })}
        </ScrollView>
      </TouchableOpacity>
    );
  };

  // ——— The story ———

  const renderMoment = (moment: StoryMoment, index: number) => {
    const { event } = moment;
    const isYou = myUser != null && event.userId === myUser.id;
    const name = isYou ? 'You' : event.username;
    const isPR = event.kind === 'pr';

    return (
      <Animated.View
        key={`${event.userId}-${event.occurredAt}-${event.kind}-${event.exerciseId ?? ''}`}
        entering={FadeInDown.duration(200).delay(Math.min(index, 10) * 25)}
      >
        <TouchableOpacity
          style={styles.momentRow}
          onPress={() => handleUserPress(event.userId, event.username, event.profilePictureUrl)}
          activeOpacity={0.7}
        >
          {renderAvatar(event.username, event.profilePictureUrl, 22)}
          <RNView style={styles.momentBody}>
            <Text variant="body" tone={isYou || event.isFriend ? 'primary' : 'secondary'} numberOfLines={2}>
              <Text variant="body" weight="semiBold" tone={isYou || event.isFriend ? 'primary' : 'secondary'}>
                {name}
              </Text>
              {isPR
                ? <> PR&apos;d {liftName(event.exerciseId ?? '')} <Text variant="body" weight="semiBold" style={{ color: GOLD }}>+{(event.gainPct ?? 0).toFixed(1)}%</Text></>
                : <> trained{event.title ? ` · ${event.title}` : ''}</>}
            </Text>
            {moment.bonusPoints > 0 && (
              <RNView style={styles.leadLine}>
                <Image source={EMBLEMS.laurel} style={styles.momentEmblem} />
                <Text variant="meta" weight="semiBold" tone="secondary">
                  {SCORING.goalBonusDays}-day week <Text variant="meta" weight="semiBold" tone="primary">+{moment.bonusPoints}</Text>
                </Text>
              </RNView>
            )}
            {moment.tookLead && (
              <RNView style={styles.leadLine}>
                <Image source={EMBLEMS.trophy} style={styles.momentEmblem} />
                <Text variant="meta" weight="semiBold" style={{ color: GOLD }}>
                  took the lead
                </Text>
              </RNView>
            )}
          </RNView>
          {moment.points > 0 && (
            <Text variant="body" weight="semiBold" style={isPR ? { color: GOLD } : undefined} tone={isPR ? undefined : 'primary'}>
              +{moment.points}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderStory = () => (
    <RNView style={styles.story}>
      {story.map(day => (
        <RNView key={day.dayKey} style={styles.storyDay}>
          <SectionLabel>{day.label}</SectionLabel>
          {day.moments.map(renderMoment)}
        </RNView>
      ))}

      {/* Today's open move — the story always ends with what you'd earn. */}
      {!storyHasToday && (
        <RNView style={styles.storyDay}>
          <SectionLabel>Today</SectionLabel>
        </RNView>
      )}
      {nextPointsLine && (
        <RNView style={styles.momentRow}>
          <Image source={EMBLEMS.sword} style={styles.nextEmblem} />
          <Text variant="body" tone="secondary" style={styles.momentBody}>
            {nextPointsLine}
          </Text>
        </RNView>
      )}
    </RNView>
  );

  // ——— The ladder (strip tap / fallback when events are unavailable) ———

  const renderWeekPips = (row: LeagueStanding) => {
    const filled = Math.min(row.breakdown.activeDays, 7);
    return (
      <RNView style={styles.pipsRow}>
        <RNView style={styles.pips}>
          {Array.from({ length: 7 }, (_, i) => (
            <RNView
              key={i}
              style={[
                styles.pip,
                { backgroundColor: i < filled ? currentTheme.colors.primary : ink.hairline },
              ]}
            />
          ))}
        </RNView>
        {row.breakdown.prCount > 0 && (
          <Text variant="meta" weight="semiBold" style={{ color: GOLD }}>
            {row.breakdown.prCount} PR{row.breakdown.prCount === 1 ? '' : 's'}
          </Text>
        )}
      </RNView>
    );
  };

  const renderReceipt = (row: LeagueStanding) => {
    const countedPRs = row.prs.slice(0, SCORING.prCap);
    const lines: { key: string; emblem: keyof typeof EMBLEMS; gold?: boolean; label: string; pts: number }[] = [];

    if (row.breakdown.activeDayPoints > 0) {
      lines.push({
        key: 'days',
        emblem: 'flame',
        label: `Trained ${row.breakdown.activeDays} ${row.breakdown.activeDays === 1 ? 'day' : 'days'}${row.breakdown.activeDays > SCORING.activeDayCap ? ` (${SCORING.activeDayCap} score)` : ''}`,
        pts: row.breakdown.activeDayPoints,
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

    if (lines.length === 0) {
      return (
        <Text variant="meta" tone="faint" style={styles.receiptEmpty}>
          No points yet this week.
        </Text>
      );
    }

    return (
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
              tone={index < 3 ? 'primary' : 'faint'}
            >
              {row.rank}
            </Text>
          </RNView>

          <TouchableOpacity
            onPress={() => handleUserPress(row.userId, row.username, row.profilePictureUrl)}
            activeOpacity={0.7}
          >
            {renderAvatar(row.username, row.profilePictureUrl, isHero ? 44 : 32)}
          </TouchableOpacity>

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
            </RNView>
            {renderWeekPips(row)}
          </RNView>

          <RNView style={styles.valueCell}>
            <Text variant={isHero ? 'statHero' : 'body'} weight={isHero ? 'bold' : 'medium'} tone="primary">
              {row.points}
            </Text>
            {isHero && <Text variant="meta" weight="regular" tone="faint">pts</Text>}
          </RNView>
        </TouchableOpacity>
        {isExpanded && renderReceipt(row)}
      </Animated.View>
    );
  };

  const renderGap = (row: LeagueStanding) => {
    if (row.gapToAhead == null || row.gapToAhead <= 0) return null;
    return (
      <RNView style={styles.gapRow}>
        <RNView style={styles.rankCell}>
          <Text variant="meta" weight="semiBold" tone="ghost">
            ▲{row.gapToAhead}
          </Text>
        </RNView>
        <RNView style={[styles.gapRule, { backgroundColor: ink.hairline }]} />
      </RNView>
    );
  };

  const renderLadder = () => (
    <RNView style={styles.list}>
      {champion && (
        <RNView style={styles.championLine}>
          <Image source={EMBLEMS.trophy} style={styles.inlineEmblem} />
          <Text variant="meta" tone="muted">
            Last week: <Text variant="meta" weight="semiBold" tone="primary">{champion.username}</Text>
          </Text>
        </RNView>
      )}
      {active.map((row, index) => (
        <React.Fragment key={row.userId}>
          {index > 0 && renderGap(row)}
          {renderRow(row, index)}
        </React.Fragment>
      ))}
      {standings != null && standings.restingFriends.length > 0 && (
        <Text variant="meta" tone="faint" numberOfLines={2} style={styles.restingLine}>
          Resting this week: {standings.restingFriends.map(f => f.user.username).join(', ')}
        </Text>
      )}
    </RNView>
  );

  // The legend that answers "why": every way to score, emblem + rule + points.
  const renderRules = () => (
    <RNView style={styles.rules}>
      {[
        { emblem: 'flame' as const, rule: 'Train a day', pts: `+${SCORING.pointsPerActiveDay}`, cap: `up to ${SCORING.activeDayCap} days` },
        { emblem: 'barbell' as const, gold: true, rule: 'PR any lift', pts: `+${SCORING.pointsPerPR}`, cap: `up to ${SCORING.prCap}, bigger gain = bigger bonus` },
        { emblem: 'laurel' as const, rule: `Hit ${SCORING.goalBonusDays} days`, pts: `+${SCORING.goalBonus}`, cap: 'once a week' },
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
    const trainedToday = story.some(
      d => d.dayKey === todayKey && d.moments.some(m => m.event.kind === 'session' && myUser != null && m.event.userId === myUser.id),
    );
    if (!trainedToday && me.breakdown.activeDays < SCORING.activeDayCap) {
      hints.push(`Train today +${SCORING.pointsPerActiveDay}`);
    }
    if (me.breakdown.prCount < SCORING.prCap) hints.push(`PR a lift +${SCORING.pointsPerPR}`);
    if (me.breakdown.goalBonus === 0 && me.breakdown.activeDays < SCORING.goalBonusDays) {
      hints.push(`${SCORING.goalBonusDays - me.breakdown.activeDays} more ${SCORING.goalBonusDays - me.breakdown.activeDays === 1 ? 'day' : 'days'} for +${SCORING.goalBonus}`);
    }
    return hints.slice(0, 2).join(' · ') || null;
  }, [me, story, todayKey, myUser]);

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
        {/* Story is the default lens; the ladder opens from the strip, and is
            the fallback when the events RPC isn't available. */}
        {showLadder || story.length === 0 ? renderLadder() : renderStory()}

        <TouchableOpacity onPress={() => setShowRules(!showRules)} activeOpacity={0.7} style={styles.rulesToggle}>
          <SectionLabel style={styles.rulesToggleLabel}>
            {showRules ? 'Hide scoring' : 'How scoring works'}
          </SectionLabel>
        </TouchableOpacity>
        {showRules && renderRules()}

        <NavRow label="Add friends" variant="plain" onPress={() => setShowSocial(true)} />
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

        {!isLoading && renderStrip()}

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {renderWeekBoard()}
        </ScrollView>

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
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
  },
  stripEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
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
  story: {
    gap: space.lg,
    paddingTop: space.sm,
  },
  storyDay: {
    gap: space.xs,
  },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  momentBody: {
    flex: 1,
    gap: 3,
  },
  momentEmblem: {
    width: 14,
    height: 14,
  },
  nextEmblem: {
    width: 22,
    height: 22,
  },
  leadLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  championLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.sm,
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
    gap: 6,
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
  pipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  pips: {
    flexDirection: 'row',
    gap: 5,
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  valueCell: {
    alignItems: 'flex-end',
  },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  gapRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  receipt: {
    marginLeft: 36 + space.md,
    paddingLeft: space.md,
    paddingBottom: space.md,
    gap: space.sm,
    borderLeftWidth: 2,
  },
  receiptEmpty: {
    marginLeft: 36 + space.md,
    paddingLeft: space.md,
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
  restingLine: {
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
