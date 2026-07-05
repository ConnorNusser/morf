import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
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

// Minimal "get ready" launch interstitial with a light Morf-system flavour: the
// brand mark springs in over a soft glow, a small eyebrow + routine name reveal,
// and a primary energy bar charges before diving into the session. Flat and dark
// to match the rest of the app — no photo background, no neon.
export default function WorkoutLaunch({ visible, routineName, subtitle, onLaunch, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;

  const root = useSharedValue(0);
  const markScale = useSharedValue(0.5);
  const nameScale = useSharedValue(0.9);
  const nameOpacity = useSharedValue(0);
  const metaOpacity = useSharedValue(0);
  const energy = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    playHapticFeedback('medium', false);

    root.value = 0;
    markScale.value = 0.5;
    nameScale.value = 0.9;
    nameOpacity.value = 0;
    metaOpacity.value = 0;
    energy.value = 0;

    root.value = withTiming(1, { duration: 180 });
    markScale.value = withDelay(60, withSpring(1, { damping: 11, stiffness: 150 }));
    nameOpacity.value = withDelay(180, withTiming(1, { duration: 260 }));
    nameScale.value = withDelay(180, withSpring(1, { damping: 14, stiffness: 150 }));
    metaOpacity.value = withDelay(320, withTiming(1, { duration: 240 }));
    energy.value = withDelay(320, withTiming(1, { duration: 780, easing: Easing.inOut(Easing.cubic) }));

    const launchT = setTimeout(onLaunch, 1140);
    const fadeT = setTimeout(() => {
      root.value = withTiming(0, { duration: 220 });
    }, 1320);
    const closeT = setTimeout(onClose, 1580);
    return () => {
      clearTimeout(launchT);
      clearTimeout(fadeT);
      clearTimeout(closeT);
    };
  }, [visible, onLaunch, onClose, root, markScale, nameScale, nameOpacity, metaOpacity, energy]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: markScale.value }] }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ scale: nameScale.value }],
  }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaOpacity.value }));
  const energyStyle = useAnimatedStyle(() => ({ width: `${energy.value * 100}%` }));

  return (
    <Modal visible={visible} transparent={false} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.fill, { backgroundColor: colors.background }, rootStyle]}>
        <View style={styles.center}>
          <Animated.View style={[styles.markWrap, markStyle, { shadowColor: colors.primary }]}>
            <Image
              source={require('@/assets/images/icon-original.png')}
              style={styles.mark}
              resizeMode="contain"
            />
          </Animated.View>

          <Text style={[styles.eyebrow, { color: colors.text + '66' }]}>MORF · GET READY</Text>

          <Animated.Text style={[styles.name, { color: colors.text }, nameStyle]} numberOfLines={2}>
            {routineName}
          </Animated.Text>

          {!!subtitle && (
            <Animated.Text style={[styles.meta, { color: colors.text + '99' }, metaStyle]}>
              {subtitle}
            </Animated.Text>
          )}

          <View style={[styles.track, { backgroundColor: colors.text + '15' }]}>
            <Animated.View style={[styles.energyFill, energyStyle, { backgroundColor: colors.primary }]} />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  markWrap: {
    marginBottom: 22,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  mark: { width: 56, height: 56 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },
  name: { fontSize: 30, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  meta: { fontSize: 14, fontWeight: '500', marginTop: 8 },
  track: { width: 170, height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 30 },
  energyFill: { height: '100%', borderRadius: 2 },
});
