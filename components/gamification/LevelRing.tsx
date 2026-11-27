import AnimatedBar from '@/components/AnimatedBar';
import { Text, TextVariant, useInk } from '@/components/Themed';
import { LevelProgress } from '@/lib/gamification/levelCurve';
import { levelPillParts } from '@/lib/gamification/levelDisplay';
import { radius, space, track, xpAccent } from '@/lib/ui/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Level number sized to the ring, snapped to the type scale (floor 14).
function numberVariant(size: number): TextVariant {
  if (size >= 120) return 'header';
  if (size >= 88) return 'screenTitle';
  if (size >= 64) return 'statHero';
  if (size >= 48) return 'title';
  return 'meta';
}

interface LevelRingProps {
  level: number;
  progress: number; // 0..1 through the current level
  size?: number;
  stroke?: number;
  /** Shows a small "LEVEL" caption above the number (rings ≥ 88 only). */
  showCaption?: boolean;
  /** XP accent; pass xpAccentForPercentile(overall) to match the lifter's tier. */
  color?: string;
}

// Account level inside an XP-progress ring. Mirrors TierRing: the arc sweeps
// from empty to its value once data lands, honoring Reduce Motion.
export default function LevelRing({ level, progress, size = 44, stroke, showCaption = true, color }: LevelRingProps) {
  const ink = useInk();
  const sw = stroke ?? Math.max(3, Math.round(size / 14));
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  const clamped = Math.max(0, Math.min(1, progress));

  const reduced = useReducedMotion();
  const fill = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      fill.value = clamped;
      return;
    }
    fill.value = withDelay(120, withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [clamped, reduced, fill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - fill.value),
  }));

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel={`Level ${level}, ${Math.round(clamped * 100)}% to next level`}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={r} stroke={ink.ghost} strokeWidth={sw} fill="none" />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke={color ?? xpAccent}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.center}>
        {showCaption && size >= 88 && (
          <Text variant="meta" weight="bold" tone="muted" style={styles.caption}>
            LEVEL
          </Text>
        )}
        <Text variant={numberVariant(size)} weight="bold" tone="primary" style={styles.number}>
          {level}
        </Text>
      </View>
    </View>
  );
}

interface LevelPillProps {
  level: LevelProgress;
  onPress?: () => void;
  color?: string;
}

// Compact header pill: "Lv 23  Iron  370 to 24" over a thin XP bar. Flexes to
// fill whatever width it's given; the title truncates first, and on very
// narrow rows the "to next" label drops so the level + bar always fit.
export function LevelPill({ level, onPress, color }: LevelPillProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const parts = levelPillParts(level);
  const [width, setWidth] = React.useState(0);
  // Below this the title is gone anyway and "370 to 24" would crowd "Lv 23".
  const showToNext = width === 0 || width >= 128;

  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: currentTheme.colors.surface }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="button"
      accessibilityLabel={`Level ${level.level}, ${level.title}, ${level.xpToNext} XP to level ${level.level + 1}. View career`}
    >
      <View style={styles.pillRow}>
        <Text variant="meta" weight="bold" tone="primary" style={styles.noShrink} numberOfLines={1}>
          {parts.levelLabel}
        </Text>
        <Text variant="meta" weight="medium" tone="secondary" style={styles.pillTitle} numberOfLines={1}>
          {parts.title}
        </Text>
        {showToNext && (
          <Text variant="meta" tone="muted" style={styles.noShrink} numberOfLines={1}>
            {parts.toNextLabel}
          </Text>
        )}
      </View>
      <AnimatedBar progress={level.progress} color={color ?? xpAccent} trackColor={ink.hairline} height={3} delay={120} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  caption: { letterSpacing: track.caps, marginBottom: -space.xs },
  number: { letterSpacing: track.display, fontVariant: ['tabular-nums'] },

  pill: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.card,
  },
  pillRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  // Title is the one element that gives up width — it truncates first.
  pillTitle: { flexShrink: 1, flexGrow: 1, minWidth: 0 },
  noShrink: { flexShrink: 0 },
});
