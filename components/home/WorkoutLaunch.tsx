import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import playHapticFeedback from '@/lib/utils/haptic';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  visible: boolean;
  routineName: string;
  subtitle?: string;
  percentile: number; // overall strength percentile → sets the tier theme
  onLaunch: () => void; // fire the navigation (overlay still covering)
  onClose: () => void; // unmount the overlay once the workout is mounted underneath
}

// Minimal "get ready" launch interstitial themed by your strength tier: the whole
// screen is washed in your tier colour, and the charge bar fills fully in that
// colour before diving into the session. Your rank sets the mood.
export default function WorkoutLaunch({ visible, routineName, subtitle, percentile, onLaunch, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const tier = getStrengthTier(percentile);
  const tierColor = getTierColor(tier);

  const root = useSharedValue(0);
  const contentY = useSharedValue(10);
  const nameOpacity = useSharedValue(0);
  const metaOpacity = useSharedValue(0);
  const charge = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    playHapticFeedback('medium', false);

    root.value = 0;
    contentY.value = 10;
    nameOpacity.value = 0;
    metaOpacity.value = 0;
    charge.value = 0;

    root.value = withTiming(1, { duration: 220 });
    nameOpacity.value = withDelay(120, withTiming(1, { duration: 300 }));
    contentY.value = withDelay(120, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));
    metaOpacity.value = withDelay(260, withTiming(1, { duration: 260 }));
    charge.value = withDelay(300, withTiming(1, { duration: 760, easing: Easing.inOut(Easing.cubic) }));

    const launchT = setTimeout(onLaunch, 1220);
    const fadeT = setTimeout(() => {
      root.value = withTiming(0, { duration: 240 });
    }, 1400);
    const closeT = setTimeout(onClose, 1660);
    return () => {
      clearTimeout(launchT);
      clearTimeout(fadeT);
      clearTimeout(closeT);
    };
  }, [visible, onLaunch, onClose, root, contentY, nameOpacity, metaOpacity, charge]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaOpacity.value }));
  const chargeStyle = useAnimatedStyle(() => ({ width: `${charge.value * 100}%` }));

  return (
    <Modal visible={visible} transparent={false} animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.fill, { backgroundColor: colors.background }, rootStyle]}>
        {/* Tier-themed wash: the screen glows in your rank's colour. */}
        <LinearGradient
          colors={[colors.background, tierColor + '33', colors.background]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.center}>
          <Text style={[styles.eyebrow, { color: tierColor }]}>{tier} · GET READY</Text>

          <Animated.Text style={[styles.name, { color: colors.text }, nameStyle]} numberOfLines={2}>
            {routineName}
          </Animated.Text>

          {!!subtitle && (
            <Animated.Text style={[styles.meta, { color: colors.text + '99' }, metaStyle]}>
              {subtitle}
            </Animated.Text>
          )}

          <View style={[styles.track, { backgroundColor: colors.text + '14' }]}>
            <Animated.View
              style={[
                styles.charge,
                chargeStyle,
                { backgroundColor: tierColor, shadowColor: tierColor },
              ]}
            />
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 3, marginBottom: 12 },
  name: { fontSize: 32, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  meta: { fontSize: 14, fontWeight: '500', marginTop: 8 },
  track: { width: 190, height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 30 },
  charge: {
    height: '100%',
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
