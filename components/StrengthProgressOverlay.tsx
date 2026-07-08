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

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

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
    scale.value = withTiming(1.05, { duration: 300 });
    scale.value = withTiming(1, { duration: 300 });

    const timeout = setTimeout(() => {
      const startTime = Date.now();
      let lastTier = getStrengthTier(from);
      let hasShownRankUp = false;

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 2);
        const currentValue = Math.round(from + (to - from) * eased);
        const tier = getStrengthTier(currentValue);

        if (tier !== lastTier) {
          setCurrentTier(tier);
          setCurrentColor(getTierColor(tier));
          if (!hasShownRankUp && tierChanged) {
            setShowRankUp(true);
            hasShownRankUp = true;
          }
          scale.value = 1.25;
          scale.value = withTiming(1, { duration: 500 });
          lastTier = tier;
        }

        if (progress >= 1) {
          clearInterval(interval);
          setCurrentTier(getStrengthTier(to));
          setCurrentColor(getTierColor(getStrengthTier(to)));

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

      <Animated.Text style={[style, { color: currentColor }, animatedStyle]}>
        {currentTier}
      </Animated.Text>
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
        const eased = 1 - Math.pow(1 - progress, 2);
        const currentValue = Math.round(from + (to - from) * eased);
        setValue(currentValue);

        // Discrete per-tier color, not interpolated
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
   
  }, [from, to, delay, duration]);

  // Mid-animation: counting number. After: "from → to"
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
  const insets = useSafeAreaInsets();

  const previousTier = getStrengthTier(progress.previousPercentile);
  const newTier = getStrengthTier(progress.newPercentile);

  const tierChanged = previousTier !== newTier;
  const delta = progress.newPercentile - progress.previousPercentile;

  // Duration scales with delta size (clamped 2s–8s)
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
            <ProgressiveTierWithGlow
              from={progress.previousPercentile}
              to={progress.newPercentile}
              tierChanged={tierChanged}
              style={[styles.rankText, { fontWeight: '700' }]}
              delay={animationDelay}
              duration={animationDuration}
            />

            <View style={styles.statsRow}>
              <PercentileJourney
                from={progress.previousPercentile}
                to={progress.newPercentile}
                fromStyle={[styles.percentileFrom, { fontWeight: '400' }]}
                toStyle={[styles.percentileTo, { fontWeight: '500' }]}
                arrowStyle={[styles.percentileArrow, { fontWeight: '400' }]}
                labelStyle={[styles.percentileLabel, { fontWeight: '400' }]}
                delay={animationDelay}
                duration={animationDuration}
              />
            </View>
          </View>

          <Text style={[styles.hint, { fontWeight: '400', paddingBottom: insets.bottom + 20 }]}>
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
  rankText: {
    fontSize: 140,
    lineHeight: 150,
    letterSpacing: 2,
    textAlign: 'center',
  },
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
