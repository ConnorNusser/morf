import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor, getStrengthTier } from '@/lib/data/strengthStandards';
import { PendingStrengthProgress } from '@/lib/storage/storage';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Solo Leveling inspired - dramatic tier
const ProgressiveTierWithGlow = ({
  from,
  to,
  tierChanged,
  style,
  delay = 400,
  duration = 2500,
}: {
  from: number;
  to: number;
  tierChanged: boolean;
  style: any;
  delay?: number;
  duration?: number;
}) => {
  const [currentTier, setCurrentTier] = useState(getStrengthTier(from));
  const [currentColor, setCurrentColor] = useState(getTierColor(getStrengthTier(from)));
  const [showRankUp, setShowRankUp] = useState(false);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Initial anticipation pulse
    scale.value = withTiming(1.05, { duration: 300 });
    scale.value = withTiming(1, { duration: 300 });

    const timeout = setTimeout(() => {
      const startTime = Date.now();
      let lastTier = getStrengthTier(from);
      let hasShownRankUp = false;
      let tierChangeCount = 0;

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Gentler ease-out (quadratic instead of quartic)
        const eased = 1 - Math.pow(1 - progress, 2);
        const currentValue = Math.round(from + (to - from) * eased);
        const tier = getStrengthTier(currentValue);

        // Update tier if it changed
        if (tier !== lastTier) {
          tierChangeCount++;
          setCurrentTier(tier);
          setCurrentColor(getTierColor(tier));
          // Show RANK UP on first tier change
          if (!hasShownRankUp && tierChanged) {
            setShowRankUp(true);
            hasShownRankUp = true;
          }
          // Dramatic pulse on tier change
          scale.value = 1.25;
          scale.value = withTiming(1, { duration: 500 });
          lastTier = tier;
        }

        if (progress >= 1) {
          clearInterval(interval);
          setCurrentTier(getStrengthTier(to));
          setCurrentColor(getTierColor(getStrengthTier(to)));

          // If no tier change, just pulse to acknowledge
          if (!tierChanged) {
            scale.value = 1.15;
            scale.value = withTiming(1, { duration: 400 });
          }
        }
      }, 16);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, delay, duration, tierChanged]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={tierStyles.container}>
      {/* Header text - different for tier change vs no change */}
      {showRankUp ? (
        <Animated.Text
          entering={FadeIn.duration(300)}
          style={tierStyles.rankUpText}
        >
          NEW RANK
        </Animated.Text>
      ) : (
        <Text style={tierStyles.currentRankText}>
          CURRENT RANK
        </Text>
      )}

      {/* The tier itself */}
      <Animated.Text style={[style, { color: currentColor }, animatedStyle]}>
        {currentTier}
      </Animated.Text>

      {/* No label below - cleaner */}
    </View>
  );
};

const tierStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  rankUpText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 6,
    marginBottom: 12,
  },
  currentRankText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 4,
    marginBottom: 12,
  },
});

interface StrengthProgressOverlayProps {
  progress: PendingStrengthProgress;
  visible: boolean;
  onDismiss: () => void;
}

// Percentile journey display: "45 → 52 percentile"
const PercentileJourney = ({
  from,
  to,
  fromStyle,
  toStyle,
  arrowStyle,
  labelStyle,
  delay = 400,
  duration = 2500,
}: {
  from: number;
  to: number;
  fromStyle: any;
  toStyle: any;
  arrowStyle: any;
  labelStyle: any;
  delay?: number;
  duration?: number;
}) => {
  const [value, setValue] = useState(from);
  const [currentColor, setCurrentColor] = useState(getTierColor(getStrengthTier(from)));
  const [showFinal, setShowFinal] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const startTime = Date.now();

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Gentler ease-out (quadratic instead of quartic)
        const eased = 1 - Math.pow(1 - progress, 2);
        const currentValue = Math.round(from + (to - from) * eased);
        setValue(currentValue);

        // Update color based on current value's tier (discrete, not interpolated)
        setCurrentColor(getTierColor(getStrengthTier(currentValue)));

        if (progress >= 1) {
          clearInterval(interval);
          setValue(to);
          setCurrentColor(getTierColor(getStrengthTier(to)));
          setShowFinal(true);
        }
      }, 16);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, delay, duration]);

  // During animation, show counting number
  // After animation, show "from → to"
  if (!showFinal) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[toStyle, { color: currentColor }]}>{value}</Text>
        <Text style={labelStyle}>{getOrdinalSuffix(value)} percentile</Text>
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{ flexDirection: 'row', alignItems: 'baseline' }}
    >
      <Text style={fromStyle}>{from}</Text>
      <Text style={arrowStyle}> → </Text>
      <Text style={[toStyle, { color: currentColor }]}>{to}</Text>
      <Text style={labelStyle}> percentile</Text>
    </Animated.View>
  );
};

export default function StrengthProgressOverlay({
  progress,
  visible,
  onDismiss,
}: StrengthProgressOverlayProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();

  // Derive tiers from percentiles
  const previousTier = getStrengthTier(progress.previousPercentile);
  const newTier = getStrengthTier(progress.newPercentile);

  const tierChanged = previousTier !== newTier;
  const delta = progress.newPercentile - progress.previousPercentile;

  // Animation timing - scale with delta size (min 2s, max 8s)
  const animationDelay = 400;
  const animationDuration = Math.max(2000, Math.min(8000, delta * 400));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={styles.overlay}
        >
          <View style={styles.content}>
            {/* Solo Leveling inspired - RANK is everything */}
            <ProgressiveTierWithGlow
              from={progress.previousPercentile}
              to={progress.newPercentile}
              tierChanged={tierChanged}
              style={[styles.rankText, { fontFamily: currentTheme.fonts.bold }]}
              delay={animationDelay}
              duration={animationDuration}
            />

            {/* Percentile journey below */}
            <View style={styles.statsRow}>
              <PercentileJourney
                from={progress.previousPercentile}
                to={progress.newPercentile}
                fromStyle={[styles.percentileFrom, { fontFamily: currentTheme.fonts.regular }]}
                toStyle={[styles.percentileTo, { fontFamily: currentTheme.fonts.medium }]}
                arrowStyle={[styles.percentileArrow, { fontFamily: currentTheme.fonts.regular }]}
                labelStyle={[styles.percentileLabel, { fontFamily: currentTheme.fonts.regular }]}
                delay={animationDelay}
                duration={animationDuration}
              />
            </View>
          </View>

          {/* Dismiss hint */}
          <Text style={[styles.hint, { fontFamily: currentTheme.fonts.regular, paddingBottom: insets.bottom + 20 }]}>
            tap anywhere to continue
          </Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  // The rank - massive and dominant
  rankText: {
    fontSize: 140,
    lineHeight: 150,
    letterSpacing: 2,
    textAlign: 'center',
  },
  // Percentile journey at bottom
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 40,
  },
  percentileFrom: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.4)',
  },
  percentileArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.3)',
  },
  percentileTo: {
    fontSize: 24,
  },
  percentileLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.4)',
  },
  hint: {
    position: 'absolute',
    bottom: 0,
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
  },
});
