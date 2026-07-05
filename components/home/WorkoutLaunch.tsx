import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  visible: boolean;
  routineName: string;
  subtitle?: string;
  onLaunch: () => void; // fire the navigation (overlay still covering)
  onClose: () => void; // unmount the overlay once the workout is mounted underneath
}

// Full-screen "get ready" interstitial shown after tapping Start workout: the
// routine name springs in, a meta line follows, and a progress bar fills — the
// beat that launches you into the session. Navigation fires while the overlay is
// still opaque, then it fades to reveal the mounted workout screen underneath.
export default function WorkoutLaunch({ visible, routineName, subtitle, onLaunch, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;

  const root = useSharedValue(0);
  const iconScale = useSharedValue(0.4);
  const nameScale = useSharedValue(0.85);
  const nameOpacity = useSharedValue(0);
  const metaOpacity = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    playHapticFeedback('medium', false);

    root.value = 0;
    iconScale.value = 0.4;
    nameScale.value = 0.85;
    nameOpacity.value = 0;
    metaOpacity.value = 0;
    progress.value = 0;

    root.value = withTiming(1, { duration: 180 });
    iconScale.value = withDelay(60, withSpring(1, { damping: 10, stiffness: 150 }));
    nameOpacity.value = withDelay(140, withTiming(1, { duration: 260 }));
    nameScale.value = withDelay(140, withSpring(1, { damping: 13, stiffness: 150 }));
    metaOpacity.value = withDelay(300, withTiming(1, { duration: 240 }));
    progress.value = withDelay(320, withTiming(1, { duration: 780, easing: Easing.inOut(Easing.cubic) }));

    const launchT = setTimeout(onLaunch, 1120);
    const fadeT = setTimeout(() => {
      root.value = withTiming(0, { duration: 220 });
    }, 1300);
    const closeT = setTimeout(onClose, 1560);
    return () => {
      clearTimeout(launchT);
      clearTimeout(fadeT);
      clearTimeout(closeT);
    };
  }, [visible, onLaunch, onClose, root, iconScale, nameScale, nameOpacity, metaOpacity, progress]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ scale: nameScale.value }],
  }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaOpacity.value }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Modal visible={visible} transparent={false} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.fill, { backgroundColor: colors.background }, rootStyle]}>
        <View style={styles.center}>
          <Animated.View style={[styles.iconWrap, { backgroundColor: colors.text }, iconStyle]}>
            <Ionicons name="barbell" size={30} color={colors.background} />
          </Animated.View>
          <Text style={[styles.eyebrow, { color: colors.text + '80' }]}>GET READY</Text>
          <Animated.Text style={[styles.name, { color: colors.text }, nameStyle]}>{routineName}</Animated.Text>
          {!!subtitle && (
            <Animated.Text style={[styles.meta, { color: colors.text + '99' }, metaStyle]}>{subtitle}</Animated.Text>
          )}
          <View style={[styles.track, { backgroundColor: colors.text + '15' }]}>
            <Animated.View style={[styles.bar, barStyle, { backgroundColor: colors.primary }]} />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
  },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },
  name: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  meta: { fontSize: 15, fontWeight: '500', marginTop: 8 },
  track: { width: 180, height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 34 },
  bar: { height: '100%', borderRadius: 2 },
});
