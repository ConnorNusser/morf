import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import playHapticFeedback from '@/lib/utils/haptic';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInLeft,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  visible: boolean;
  routineName: string;
  subtitle?: string;
  exercises?: string[];
  percentile: number; // overall strength percentile → sets the tier theme
  onLaunch: () => void; // fire the navigation (overlay still covering)
  onClose: () => void; // unmount the overlay once the workout is mounted underneath
}

const MAX_ROWS = 6;
const NAME_DELAY = 60;
const LIST_START = 330;
const STEP = 78;

// "Loadout reveal" launch interstitial: the routine name slams in, the exercises
// tick in one by one (each with a haptic tap) like a game loading your loadout,
// and a tier-coloured energy bar sweeps as it fires you into the session.
export default function WorkoutLaunch({ visible, routineName, subtitle, exercises = [], percentile, onLaunch, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const tier = getStrengthTier(percentile);
  const tierColor = getTierColor(tier);

  const shown = exercises.slice(0, MAX_ROWS);
  const extra = exercises.length - shown.length;

  const root = useSharedValue(1);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    playHapticFeedback('medium', false);
    root.value = 1;
    sweep.value = 0;

    const rows = shown.length;
    const listEnd = LIST_START + rows * STEP;

    // A crisp tap as each exercise snaps into the loadout.
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < rows; i++) {
      timers.push(setTimeout(() => playHapticFeedback('light', false), LIST_START + i * STEP));
    }

    sweep.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });

    const total = Math.max(1250, listEnd + 380);
    timers.push(setTimeout(onLaunch, total));
    timers.push(setTimeout(() => {
      root.value = withTiming(0, { duration: 240 });
    }, total + 180));
    timers.push(setTimeout(onClose, total + 440));
    return () => timers.forEach(clearTimeout);
  }, [visible, onLaunch, onClose, root, sweep, shown.length]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const sweepStyle = useAnimatedStyle(() => ({ width: `${sweep.value * 100}%` }));

  return (
    <Modal visible={visible} transparent={false} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.fill, { backgroundColor: colors.background }, rootStyle]}>
        <LinearGradient
          colors={[colors.background, tierColor + '2E', colors.background]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.center}>
          <Text style={[styles.eyebrow, { color: tierColor }]}>{tier} · GET READY</Text>

          <Animated.Text
            entering={FadeInDown.delay(NAME_DELAY).duration(300).springify().damping(14)}
            style={[styles.name, { color: colors.text }]}
            numberOfLines={2}
          >
            {routineName}
          </Animated.Text>

          {shown.length > 0 ? (
            <View style={styles.list}>
              {shown.map((ex, i) => (
                <Animated.View
                  key={`${ex}-${i}`}
                  entering={FadeInLeft.delay(LIST_START + i * STEP).duration(230)}
                  style={styles.row}
                >
                  <Ionicons name="chevron-forward" size={14} color={tierColor} />
                  <Text style={[styles.rowText, { color: colors.text + 'E6' }]} numberOfLines={1}>
                    {ex}
                  </Text>
                </Animated.View>
              ))}
              {extra > 0 && (
                <Animated.Text
                  entering={FadeInLeft.delay(LIST_START + shown.length * STEP).duration(230)}
                  style={[styles.more, { color: colors.text + '80' }]}
                >
                  +{extra} more
                </Animated.Text>
              )}
            </View>
          ) : (
            !!subtitle && (
              <Animated.Text
                entering={FadeInDown.delay(LIST_START).duration(260)}
                style={[styles.meta, { color: colors.text + '99' }]}
              >
                {subtitle}
              </Animated.Text>
            )
          )}

          <View style={[styles.track, { backgroundColor: colors.text + '14' }]}>
            <Animated.View style={[styles.charge, sweepStyle, { backgroundColor: tierColor }]} />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 40 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 3, marginBottom: 10 },
  name: { fontSize: 32, fontWeight: '800', letterSpacing: -0.4 },

  list: { alignSelf: 'stretch', marginTop: 20, gap: 3, maxWidth: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { fontSize: 16, fontWeight: '600', flex: 1 },
  more: { fontSize: 13, fontWeight: '600', marginLeft: 22, marginTop: 2 },

  meta: { fontSize: 15, fontWeight: '500', marginTop: 10 },

  track: { alignSelf: 'stretch', maxWidth: 320, height: 4, borderRadius: 3, overflow: 'hidden', marginTop: 30 },
  charge: { height: '100%', borderRadius: 3 },
});
