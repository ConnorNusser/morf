import AchievementBadge from '@/components/gamification/AchievementBadge';
import { AchievementFact, CareerSnapshot } from '@/contexts/WorkoutLaunchContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { formatCompact } from '@/lib/gamification/careerStats';
import { formatRelativeTime } from '@/lib/ui/formatters';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
  achievement?: AchievementFact; // when set, render its emblem
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

// Build the rotating pool: personal fun facts interleaved with the user's
// achievements (achievement-first, so they show often). Only include facts we
// actually have data for.
function buildPool(c: CareerSnapshot): Brief[] {
  const facts: Brief[] = [];
  const unit = c.unit || 'lbs';
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

// A calm "session brief" — no bounce. Rotates a personal fun fact, a recent
// achievement, or a research-backed cue each launch. Tier is the accent; tap
// anywhere to skip straight in.
export default function WorkoutLaunch({ visible, routineName, subtitle, exercises = [], career, onLaunch, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
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
              <Text style={[styles.tierChip, { color: tierColor, borderColor: tierColor + '55' }]}>{tier}</Text>
              <Text style={[styles.routine, { color: colors.text }]} numberOfLines={1}>
                {routineName}
              </Text>
            </Animated.View>
            {!!meta && (
              <Animated.Text entering={FadeIn.delay(120).duration(240)} style={[styles.meta, { color: colors.text + '80' }]}>
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
                  <Text style={[styles.achDesc, { color: colors.text + 'B0' }]}>{item.achievement.description}</Text>
                  <Text style={[styles.achDate, { color: colors.text + '66' }]}>
                    Earned {formatRelativeTime(new Date(item.achievement.unlockedAt))}
                  </Text>
                </Animated.View>
              )}
            </View>
          </View>

          <Text style={[styles.hint, { color: colors.text + '4D' }]}>Tap to start</Text>
        </Pressable>

        <View style={[styles.timeTrack, { backgroundColor: colors.text + '12' }]}>
          <Animated.View style={[styles.timeFill, timebarStyle, { backgroundColor: tierColor }]} />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 34 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierChip: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  routine: { fontSize: 17, fontWeight: '700', flex: 1 },
  meta: { fontSize: 13, fontWeight: '500', marginTop: 6 },

  brief: { marginTop: 34 },
  badge: { marginBottom: 18 },
  tag: { fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  cue: { fontSize: 25, fontWeight: '700', lineHeight: 33, letterSpacing: -0.3 },
  achDesc: { fontSize: 16, fontWeight: '500', lineHeight: 22, marginTop: 12 },
  achDate: { fontSize: 13, fontWeight: '600', marginTop: 8 },

  hint: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 22 },
  timeTrack: { height: 3, width: '100%' },
  timeFill: { height: '100%' },
});
