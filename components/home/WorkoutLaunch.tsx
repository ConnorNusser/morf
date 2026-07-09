import AchievementBadge from '@/components/gamification/AchievementBadge';
import { Text, useInk } from '@/components/Themed';
import { AchievementFact, CareerSnapshot } from '@/contexts/WorkoutLaunchContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { formatCompact } from '@/lib/gamification/careerStats';
import { formatRelativeTime } from '@/lib/ui/formatters';
import { radius, space, withAlpha } from '@/lib/ui/tokens';
import { type as typeScale } from '@/lib/ui/typography';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  visible: boolean;
  routineName: string;
  subtitle?: string;
  exercises?: string[];
  career: CareerSnapshot;
  onLaunch: () => void; // fire the navigation (overlay still covering)
  onClose: () => void; // unmount the overlay once the workout is mounted underneath
}

interface Brief {
  tag: string;
  text: string;
  achievement?: AchievementFact;
}

const HOLD_MS = 2800;

// Relatable comparisons for total volume (weights in lb, largest first).
const OBJECTS: { w: number; s: string; p: string }[] = [
  { w: 300000, s: 'blue whale', p: 'blue whales' },
  { w: 40000, s: 'school bus', p: 'school buses' },
  { w: 12000, s: 'elephant', p: 'elephants' },
  { w: 4000, s: 'car', p: 'cars' },
  { w: 45, s: 'barbell plate', p: 'barbell plates' },
];

function volumeComparison(volumeLbs: number): string {
  for (const o of OBJECTS) {
    const n = Math.round(volumeLbs / o.w);
    if (n >= 1) return `${n.toLocaleString()} ${n > 1 ? o.p : o.s}`;
  }
  return 'a solid warm-up';
}

function buildPool(c: CareerSnapshot): Brief[] {
  const facts: Brief[] = [];
  const unit = c.unit || 'lbs';
  // Lead with what today could earn — the anticipation half of the reward loop.
  // Past facts reassure; a near unlock gives this session a reason to exist.
  for (const u of c.nextUnlocks || []) {
    facts.push({ tag: 'NEXT UP', text: `${u.percentLabel} of the way to “${u.title}”. Today could be the day.` });
  }
  if (c.totalVolume && c.totalVolume > 0) {
    const lbs = unit === 'kg' ? c.totalVolume * 2.20462 : c.totalVolume;
    facts.push({ tag: 'TOTAL VOLUME', text: `You’ve moved ${formatCompact(c.totalVolume)} ${unit} — about ${volumeComparison(lbs)}.` });
  }
  if (c.percentile > 0) facts.push({ tag: 'STRENGTH RANK', text: `You out-lift ${c.percentile}% of lifters. Extend the lead today.` });
  if (c.currentStreak && c.currentStreak > 0) facts.push({ tag: 'MOMENTUM', text: `${c.currentStreak}-week streak going. Don’t break the chain.` });
  if (c.totalWorkouts && c.totalWorkouts > 0) facts.push({ tag: 'SESSIONS', text: `${c.totalWorkouts} workouts logged. Every rep compounds.` });
  if (c.totalSets && c.totalSets > 0) facts.push({ tag: 'WORK DONE', text: `${formatCompact(c.totalSets)} hard sets in the books.` });
  if (c.daysActive && c.daysActive > 0) facts.push({ tag: 'TIME UNDER THE BAR', text: `${c.daysActive} days trained with Morf.` });

  const achievements: Brief[] = (c.achievements || []).map(a => ({
    tag: a.isNew ? 'JUST UNLOCKED' : 'ACHIEVEMENT',
    text: a.title,
    achievement: a,
  }));

  // Interleave achievement, fact, achievement, fact … so achievements show often.
  const pool: Brief[] = [];
  const max = Math.max(facts.length, achievements.length);
  for (let i = 0; i < max; i++) {
    if (achievements[i]) pool.push(achievements[i]);
    if (facts[i]) pool.push(facts[i]);
  }
  return pool.length ? pool : [{ tag: 'READY', text: 'Let’s move some weight.' }];
}

// A calm "session brief": rotates a personal fun fact / recent achievement / cue each launch; tap anywhere to skip in.
export default function WorkoutLaunch({ visible, routineName, subtitle, exercises = [], career, onLaunch, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const ink = useInk();
  const tier = getStrengthTier(career.percentile);
  const tierColor = getTierColor(tier);
  const meta = subtitle || (exercises.length ? `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}` : '');

  const pool = buildPool(career);
  const counter = useRef(0);
  const [displayIdx, setDisplayIdx] = useState(0);
  const item = pool[displayIdx % Math.max(1, pool.length)] ?? { tag: 'READY', text: 'Let’s move some weight.' };

  const root = useSharedValue(0);
  const timebar = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const done = useRef(false);

  const finish = React.useCallback(() => {
    if (done.current) return;
    done.current = true;
    timers.current.forEach(clearTimeout);
    onLaunch();
    root.value = withTiming(0, { duration: 240 });
    setTimeout(onClose, 260);
  }, [onLaunch, onClose, root]);

  useEffect(() => {
    if (!visible) return;
    done.current = false;
    setDisplayIdx(counter.current % Math.max(1, pool.length));
    counter.current += 1;
    playHapticFeedback('medium', false);
    root.value = 0;
    timebar.value = 0;
    root.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    timebar.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });

    timers.current = [setTimeout(finish, HOLD_MS)];
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const timebarStyle = useAnimatedStyle(() => ({ width: `${timebar.value * 100}%` }));

  return (
    <Modal visible={visible} transparent={false} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.fill, { backgroundColor: colors.background }, rootStyle]}>
        <Pressable style={styles.fill} onPress={finish}>
          <View style={styles.center}>
            <Animated.View entering={FadeIn.duration(240)} style={styles.headerRow}>
              <Text
                variant="meta"
                weight="bold"
                style={[styles.tierChip, { color: tierColor, borderColor: withAlpha(tierColor, 'muted') }]}
              >
                {tier}
              </Text>
              <Text variant="title" tone="primary" weight="bold" style={styles.routine} numberOfLines={1}>
                {routineName}
              </Text>
            </Animated.View>
            {!!meta && (
              <Animated.Text entering={FadeIn.delay(120).duration(240)} style={[styles.meta, { color: ink.secondary }]}>
                {meta}
              </Animated.Text>
            )}

            <View style={styles.brief}>
              {item.achievement && (
                <Animated.View
                  key={`${item.tag}-badge`}
                  entering={FadeIn.delay(180).duration(360)}
                  style={styles.badge}
                >
                  <AchievementBadge
                    icon={item.achievement.icon}
                    emblem={emblemFor(item.achievement.id)}
                    rarity={item.achievement.rarity}
                    size={72}
                    isNew={item.achievement.isNew}
                  />
                </Animated.View>
              )}
              <Animated.Text
                key={`${item.tag}-tag`}
                entering={FadeInDown.delay(220).duration(340).easing(Easing.out(Easing.cubic))}
                style={[styles.tag, { color: tierColor }]}
              >
                {item.tag}
              </Animated.Text>
              <Animated.Text
                key={`${item.tag}-text`}
                entering={FadeInDown.delay(320).duration(440).easing(Easing.out(Easing.cubic))}
                style={[styles.cue, { color: colors.text }]}
              >
                {item.text}
              </Animated.Text>
              {item.achievement && (
                <Animated.View key={`${item.tag}-ach`} entering={FadeInDown.delay(430).duration(360)}>
                  <Text variant="body" tone="secondary" weight="medium" style={styles.achDesc}>
                    {item.achievement.description}
                  </Text>
                  <Text variant="meta" tone="muted" weight="semiBold" style={styles.achDate}>
                    Earned {formatRelativeTime(new Date(item.achievement.unlockedAt))}
                  </Text>
                </Animated.View>
              )}
            </View>
          </View>

          <Text variant="meta" tone="faint" weight="semiBold" style={styles.hint}>
            Tap to start
          </Text>
        </Pressable>

        <View style={[styles.timeTrack, { backgroundColor: ink.hairline }]}>
          <Animated.View style={[styles.timeFill, timebarStyle, { backgroundColor: tierColor }]} />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 34 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tierChip: {
    letterSpacing: 0.5,
    borderWidth: 1,
    borderRadius: radius.badge,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    overflow: 'hidden',
  },
  routine: { flex: 1 },
  meta: { fontSize: typeScale.meta, fontWeight: '500', marginTop: space.sm },

  brief: { marginTop: 34 },
  badge: { marginBottom: space.xl },
  tag: { fontSize: typeScale.meta, fontWeight: '800', letterSpacing: 2, marginBottom: space.md },
  cue: { fontSize: typeScale.screenTitle, fontWeight: '700', lineHeight: 34, letterSpacing: -0.3 },
  achDesc: { lineHeight: 22, marginTop: space.md },
  achDate: { marginTop: space.sm },

  hint: { textAlign: 'center', marginBottom: space.section },
  timeTrack: { height: 3, width: '100%' },
  timeFill: { height: '100%' },
});
