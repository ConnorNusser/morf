import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
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
  percentile: number; // overall strength percentile → tier accent
  onLaunch: () => void; // fire the navigation (overlay still covering)
  onClose: () => void; // unmount the overlay once the workout is mounted underneath
}

// Evidence-based cues surfaced before each session — grounded in the strength &
// hypertrophy literature (progressive overload, proximity-to-failure, double
// progression, volume landmarks, eccentric control, specificity). One per launch.
const CUES: { tag: string; text: string }[] = [
  { tag: 'PROGRESSIVE OVERLOAD', text: 'Beat last session by one rep — or the smallest plate. That’s the whole game.' },
  { tag: 'PROXIMITY TO FAILURE', text: 'Leave 1–2 reps in the tank on your top sets. Close enough to grow, not so close it wrecks recovery.' },
  { tag: 'DOUBLE PROGRESSION', text: 'Add reps first. Only add load once you top your rep range on every set.' },
  { tag: 'EFFECTIVE VOLUME', text: '10–20 hard sets per muscle per week is the range that builds it. Quality over count.' },
  { tag: 'ECCENTRIC CONTROL', text: 'Own the way down. A controlled eccentric loads the muscle more than the drop.' },
  { tag: 'SPECIFICITY', text: 'Log every set. Progress is only real if it’s measured against last time.' },
  { tag: 'FATIGUE MANAGEMENT', text: 'Strength is built between sessions. Bring intent today, not ego.' },
];

// A calm, research-grounded "session brief" — no bounce. The cue and routine
// resolve with smooth linear/cubic motion while a time bar tracks the hold.
export default function WorkoutLaunch({ visible, routineName, subtitle, exercises = [], percentile, onLaunch, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const tier = getStrengthTier(percentile);
  const tierColor = getTierColor(tier);
  const meta = subtitle || (exercises.length ? `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}` : '');

  const [cueIdx, setCueIdx] = useState(0);
  const cue = CUES[cueIdx];

  const root = useSharedValue(0);
  const timebar = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    setCueIdx(i => (i + 1) % CUES.length);
    playHapticFeedback('medium', false);
    root.value = 0;
    timebar.value = 0;

    root.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    timebar.value = withTiming(1, { duration: 1700, easing: Easing.linear });

    const launchT = setTimeout(onLaunch, 1780);
    const fadeT = setTimeout(() => {
      root.value = withTiming(0, { duration: 240 });
    }, 1960);
    const closeT = setTimeout(onClose, 2220);
    return () => {
      clearTimeout(launchT);
      clearTimeout(fadeT);
      clearTimeout(closeT);
    };
  }, [visible, onLaunch, onClose, root, timebar]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const timebarStyle = useAnimatedStyle(() => ({ width: `${timebar.value * 100}%` }));

  return (
    <Modal visible={visible} transparent={false} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.fill, { backgroundColor: colors.background }, rootStyle]}>
        <View style={styles.center}>
          {/* Context: rank + what you're about to do. */}
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

          {/* The brief. */}
          <View style={styles.brief}>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(340).easing(Easing.out(Easing.cubic))}
              style={[styles.tag, { color: tierColor }]}
            >
              {cue.tag}
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(320).duration(420).easing(Easing.out(Easing.cubic))}
              style={[styles.cue, { color: colors.text }]}
            >
              {cue.text}
            </Animated.Text>
          </View>
        </View>

        {/* Time bar tracks the hold — a real, linear countdown, not a bounce. */}
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

  timeTrack: { height: 3, width: '100%' },
  timeFill: { height: '100%' },
});
