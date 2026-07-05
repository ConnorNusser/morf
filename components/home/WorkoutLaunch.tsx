import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 184;
const STROKE = 9;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

interface Props {
  visible: boolean;
  routineName: string;
  subtitle?: string;
  exercises?: string[];
  percentile: number; // overall strength percentile → drives the ring + tier
  onLaunch: () => void; // fire the navigation (overlay still covering)
  onClose: () => void; // unmount the overlay once the workout is mounted underneath
}

// Launch interstitial: a strength-tier ring. The arc sweeps to your percentile in
// your tier colour, your rank stamps into the centre, and the routine name resolves
// below — flat black, no gradient. Your rank is the whole visual.
export default function WorkoutLaunch({ visible, routineName, subtitle, exercises = [], percentile, onLaunch, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const tier = getStrengthTier(percentile);
  const tierColor = getTierColor(tier);
  const pct = Math.max(0, Math.min(100, percentile));
  const meta = subtitle || (exercises.length ? `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}` : '');

  const root = useSharedValue(0);
  const progress = useSharedValue(0);
  const stamp = useSharedValue(0.55);
  const stampOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    playHapticFeedback('medium', false);
    root.value = 0;
    progress.value = 0;
    stamp.value = 0.55;
    stampOpacity.value = 0;

    root.value = withTiming(1, { duration: 200 });
    stampOpacity.value = withDelay(180, withTiming(1, { duration: 240 }));
    stamp.value = withDelay(180, withSpring(1, { damping: 9, stiffness: 150 }));
    progress.value = withDelay(220, withTiming(pct / 100, { duration: 900, easing: Easing.out(Easing.cubic) }));

    const ding = setTimeout(() => playHapticFeedback('light', false), 1080);
    const launchT = setTimeout(onLaunch, 1420);
    const fadeT = setTimeout(() => {
      root.value = withTiming(0, { duration: 240 });
    }, 1600);
    const closeT = setTimeout(onClose, 1860);
    return () => {
      clearTimeout(ding);
      clearTimeout(launchT);
      clearTimeout(fadeT);
      clearTimeout(closeT);
    };
  }, [visible, onLaunch, onClose, pct, root, progress, stamp, stampOpacity]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const stampStyle = useAnimatedStyle(() => ({ opacity: stampOpacity.value, transform: [{ scale: stamp.value }] }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - progress.value) }));

  return (
    <Modal visible={visible} transparent={false} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.fill, { backgroundColor: colors.background }, rootStyle]}>
        <View style={styles.center}>
          <View style={styles.ringWrap}>
            <Svg width={SIZE} height={SIZE} style={styles.ringSvg}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.text + '14'} strokeWidth={STROKE} fill="none" />
              <AnimatedCircle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={tierColor}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                animatedProps={ringProps}
              />
            </Svg>
            <Animated.View style={[StyleSheet.absoluteFill, styles.ringCenter, stampStyle]}>
              <Text style={[styles.tierLetter, { color: tierColor }]}>{tier}</Text>
              <Text style={[styles.tierLabel, { color: colors.text + '80' }]}>{pct}TH PERCENTILE</Text>
            </Animated.View>
          </View>

          <Animated.Text
            entering={FadeInDown.delay(360).duration(320)}
            style={[styles.name, { color: colors.text }]}
            numberOfLines={2}
          >
            {routineName}
          </Animated.Text>

          {!!meta && (
            <Animated.Text
              entering={FadeInDown.delay(480).duration(280)}
              style={[styles.meta, { color: colors.text + '99' }]}
            >
              {meta}
            </Animated.Text>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  tierLetter: { fontSize: 58, fontWeight: '800', letterSpacing: -1 },
  tierLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginTop: 4 },

  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center', marginTop: 34 },
  meta: { fontSize: 14, fontWeight: '500', marginTop: 8 },
});
