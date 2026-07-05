import ProgressBar from '@/components/ProgressBar';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
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
  percentile: number; // overall strength percentile → drives the tier ladder
  onLaunch: () => void; // fire the navigation (overlay still covering)
  onClose: () => void; // unmount the overlay once the workout is mounted underneath
}

// Minimal "get ready" launch interstitial. The Morf mark springs in, the routine
// name reveals, and the energy bar IS the strength tier ladder — it fills to your
// percentile in your tier colour with the E→S grades marked, so every launch
// reminds you of your rank before you dive into the session.
export default function WorkoutLaunch({ visible, routineName, subtitle, percentile, onLaunch, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const tier = getStrengthTier(percentile);
  const tierColor = getTierColor(tier);

  const root = useSharedValue(0);
  const markScale = useSharedValue(0.5);
  const nameScale = useSharedValue(0.9);
  const nameOpacity = useSharedValue(0);
  const metaOpacity = useSharedValue(0);
  const tierOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    playHapticFeedback('medium', false);

    root.value = 0;
    markScale.value = 0.5;
    nameScale.value = 0.9;
    nameOpacity.value = 0;
    metaOpacity.value = 0;
    tierOpacity.value = 0;

    root.value = withTiming(1, { duration: 180 });
    markScale.value = withDelay(60, withSpring(1, { damping: 11, stiffness: 150 }));
    nameOpacity.value = withDelay(160, withTiming(1, { duration: 240 }));
    nameScale.value = withDelay(160, withSpring(1, { damping: 14, stiffness: 150 }));
    metaOpacity.value = withDelay(300, withTiming(1, { duration: 220 }));
    tierOpacity.value = withDelay(420, withTiming(1, { duration: 260 }));

    const launchT = setTimeout(onLaunch, 1500);
    const fadeT = setTimeout(() => {
      root.value = withTiming(0, { duration: 240 });
    }, 1680);
    const closeT = setTimeout(onClose, 1960);
    return () => {
      clearTimeout(launchT);
      clearTimeout(fadeT);
      clearTimeout(closeT);
    };
  }, [visible, onLaunch, onClose, root, markScale, nameScale, nameOpacity, metaOpacity, tierOpacity]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: markScale.value }] }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ scale: nameScale.value }],
  }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaOpacity.value }));
  const tierStyle = useAnimatedStyle(() => ({ opacity: tierOpacity.value }));

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

          {/* The energy bar is the strength tier ladder — fills to your rank. */}
          <Animated.View style={[styles.tierBlock, tierStyle]}>
            <View style={styles.tierRow}>
              <Text style={[styles.tierLabel, { color: colors.text + '80' }]}>STRENGTH RANK</Text>
              <View style={styles.tierRight}>
                <Text style={[styles.tierPct, { color: colors.text + '99' }]}>{percentile}th</Text>
                <TierBadge tier={tier} size="medium" variant="text" showTooltip={false} />
              </View>
            </View>
            <ProgressBar progress={percentile} showTicks color={tierColor} height={10} />
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  markWrap: {
    marginBottom: 22,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  mark: { width: 52, height: 52 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },
  name: { fontSize: 30, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  meta: { fontSize: 14, fontWeight: '500', marginTop: 8 },

  tierBlock: { width: '100%', maxWidth: 300, marginTop: 34 },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tierLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  tierRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierPct: { fontSize: 13, fontWeight: '600' },
});
