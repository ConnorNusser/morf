import { CareerSnapshot } from '@/contexts/WorkoutLaunchContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import { formatCompact } from '@/lib/gamification/careerStats';
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
}

const HOLD_MS = 2800;

// Evidence-based cues grounded in the strength & hypertrophy literature.
const CUES: Brief[] = [
  { tag: 'PROGRESSIVE OVERLOAD', text: 'Beat last session by one rep — or the smallest plate. That’s the whole game.' },
  { tag: 'PROXIMITY TO FAILURE', text: 'Leave 1–2 reps in the tank on your top sets. Close enough to grow, not so close it wrecks recovery.' },
  { tag: 'DOUBLE PROGRESSION', text: 'Add reps first. Only add load once you top your rep range on every set.' },
  { tag: 'EFFECTIVE VOLUME', text: '10–20 hard sets per muscle per week is the range that builds it. Quality over count.' },
  { tag: 'ECCENTRIC CONTROL', text: 'Own the way down. A controlled eccentric loads the muscle more than the drop.' },
];

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

// Build the rotating pool: personal fun facts + a recent achievement + research
// cues. Only include facts we actually have data for.
function buildPool(c: CareerSnapshot): Brief[] {
  const facts: Brief[] = [];
  const unit = c.unit || 'lbs';
  if (c.recentAchievement) facts.push({ tag: 'ACHIEVEMENT UNLOCKED', text: c.recentAchievement });
  if (c.totalVolume && c.totalVolume > 0) {
    const lbs = unit === 'kg' ? c.totalVolume * 2.20462 : c.totalVolume;
    facts.push({ tag: 'TOTAL VOLUME', text: `You’ve moved ${formatCompact(c.totalVolume)} ${unit} — about ${volumeComparison(lbs)}.` });
  }
  if (c.percentile > 0) facts.push({ tag: 'STRENGTH RANK', text: `You out-lift ${c.percentile}% of lifters. Extend the lead today.` });
  if (c.currentStreak && c.currentStreak > 0) facts.push({ tag: 'MOMENTUM', text: `${c.currentStreak}-week streak going. Don’t break the chain.` });
  if (c.totalWorkouts && c.totalWorkouts > 0) facts.push({ tag: 'SESSIONS', text: `${c.totalWorkouts} workouts logged. Every rep compounds.` });
  if (c.totalSets && c.totalSets > 0) facts.push({ tag: 'WORK DONE', text: `${formatCompact(c.totalSets)} hard sets in the books.` });
  if (c.daysActive && c.daysActive > 0) facts.push({ tag: 'TIME UNDER THE BAR', text: `${c.daysActive} days trained with Morf.` });
  return [...facts, ...CUES];
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
  const [idx, setIdx] = useState(0);
  const item = pool[idx % pool.length] ?? CUES[0];

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
    setIdx(i => (i + 1) % Math.max(1, pool.length));
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
  tag: { fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  cue: { fontSize: 25, fontWeight: '700', lineHeight: 33, letterSpacing: -0.3 },

  hint: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 22 },
  timeTrack: { height: 3, width: '100%' },
  timeFill: { height: '100%' },
});
