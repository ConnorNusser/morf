import { useTheme } from '@/contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode, useEffect, useState } from 'react';
import { Dimensions, LayoutChangeEvent, Platform, StyleProp, StyleSheet, View as RNView, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// Perceived luminance of a #rrggbb color → pick blur tint / overlay polarity.
const isDarkColor = (hex: string) => {
  const m = hex.replace('#', '');
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
};

// ── drifting aurora blob ─────────────────────────────────────────────────────

interface BlobProps {
  size: number;
  colors: [string, string];
  from: { x: number; y: number };
  to: { x: number; y: number };
  duration: number;
  delay: number;
}

function AuroraBlob({ size, colors, from, to, duration, delay }: BlobProps) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
  }, [t, duration, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [from.x, to.x]) },
      { translateY: interpolate(t.value, [0, 1], [from.y, to.y]) },
      { scale: interpolate(t.value, [0, 1], [1, 1.35]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: size / 2 }}
      />
    </Animated.View>
  );
}

// ── aurora surface ───────────────────────────────────────────────────────────

interface AuroraSurfaceProps {
  children: ReactNode;
  /** Container overrides (height, margin, radius). */
  style?: StyleProp<ViewStyle>;
  /** Padding/layout for the content layer above the aurora. */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * A rounded card whose background is a living aurora: drifting gradient blobs
 * (theme primary/accent) smeared by a blur layer, a legibility scrim, and an
 * optional shimmer sweep. Measures itself so blob placement scales to any
 * height — shared by HistoryHero and WeeklyOverview.
 */
export function AuroraSurface({ children, style, contentStyle }: AuroraSurfaceProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const dark = isDarkColor(colors.background);

  const [dims, setDims] = useState({ w: Dimensions.get('window').width - 40, h: 220 });
  const { w, h } = dims;
  const blurI = Platform.OS === 'android' ? 28 : 36;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height && (Math.abs(width - w) > 1 || Math.abs(height - h) > 1)) {
      setDims({ w: width, h: height });
    }
  };

  const shim = useSharedValue(0);
  useEffect(() => {
    shim.value = withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [shim]);
  const shimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shim.value, [0, 1], [-w, w]) }, { rotateZ: '18deg' }],
    opacity: interpolate(shim.value, [0, 0.5, 1], [0, 0.5, 0]),
  }));

  return (
    <RNView
      onLayout={onLayout}
      style={[
        styles.surface,
        { borderRadius: currentTheme.borderRadius + 6, backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <RNView style={[StyleSheet.absoluteFill, { opacity: 0.45 }]} pointerEvents="none">
        <AuroraBlob
          size={w * 0.85}
          colors={[colors.primary, colors.accent]}
          from={{ x: -w * 0.18, y: -h * 0.25 }}
          to={{ x: w * 0.05, y: h * 0.05 }}
          duration={7000}
          delay={0}
        />
        <AuroraBlob
          size={w * 0.72}
          colors={[colors.accent, colors.primary]}
          from={{ x: w * 0.52, y: -h * 0.18 }}
          to={{ x: w * 0.34, y: h * 0.12 }}
          duration={9000}
          delay={400}
        />
        <AuroraBlob
          size={w * 0.68}
          colors={[colors.accent, colors.primary]}
          from={{ x: w * 0.12, y: h * 0.42 }}
          to={{ x: w * 0.45, y: h * 0.72 }}
          duration={8000}
          delay={800}
        />
      </RNView>

      <BlurView intensity={blurI} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient
        pointerEvents="none"
        colors={[colors.surface + '00', colors.surface + (dark ? '40' : '66')]}
        style={StyleSheet.absoluteFill}
      />

      <RNView style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.shimmer, { width: w * 0.4 }, shimStyle]}>
          <LinearGradient
            colors={['#FFFFFF00', dark ? '#FFFFFF22' : '#FFFFFF55', '#FFFFFF00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </RNView>

      <RNView style={contentStyle}>{children}</RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  shimmer: { position: 'absolute', top: -40, bottom: -40, left: 0 },
});
