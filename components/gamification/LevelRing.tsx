import AnimatedBar from '@/components/AnimatedBar';
import RankEmblem from '@/components/gamification/RankEmblem';
import RankMark from '@/components/ui/RankMark';
import { Text, TextVariant, useInk } from '@/components/Themed';
import TierGlass from '@/components/ui/TierGlass';
import { LevelProgress, levelTitle } from '@/lib/gamification/levelCurve';
import { levelPillParts } from '@/lib/gamification/levelDisplay';
import { radius, space, track } from '@/lib/ui/tokens';
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
  /** Ring stroke. Defaults to neutral ink: level/XP never take a hue (tier owns color). */
  color?: string;
  /**
   * Rank emblem: 'inside' replaces the number with the crest; 'beside' puts
   * the crest to the left of the ring. Omit for the plain number ring.
   */
  emblem?: 'inside' | 'beside';
}

// Account level inside an XP-progress ring. Mirrors TierRing: the arc sweeps
// from empty to its value once data lands, honoring Reduce Motion.
export default function LevelRing(props: LevelRingProps) {
  if (props.emblem === 'beside') {
    const size = props.size ?? 44;
    return (
      <View style={styles.beside}>
        <RankEmblem level={props.level} progress={props.progress} size={size} />
        <Ring {...props} />
      </View>
    );
  }
  return <Ring {...props} />;
}

function Ring({ level, progress, size = 44, stroke, showCaption = true, color, emblem }: LevelRingProps) {
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
      accessibilityLabel={`Level ${level}, ${levelTitle(level)}, ${Math.round(clamped * 100)}% to next level`}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={r} stroke={ink.ghost} strokeWidth={sw} fill="none" />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke={color ?? ink.secondary}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {emblem === 'inside' ? (
        <View style={styles.center}>
          <RankEmblem level={level} progress={clamped} size={Math.round((size - sw * 2) * 0.86)} />
        </View>
      ) : (
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
      )}
    </View>
  );
}

interface LevelPillProps {
  level: LevelProgress;
  onPress?: () => void;
  color?: string;
}

// Compact header pill: "[crest] Lv 23  Gold II  370 to 24" over a thin XP bar. Flexes to
// fill whatever width it's given; the title truncates first, and on very
// narrow rows the "to next" label drops so the level + bar always fit.
// Compact header badge: rank crest + level number on tier glass, sized to its
// content (no title or XP line — those live on the Home card and in Career).
export function LevelPill({ level, onPress }: LevelPillProps) {
  const { currentTheme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Level ${level.level}, ${level.title}. View career`}
    >
      <TierGlass style={styles.pill}>
        {/* Swiss: the typographic rank mark, not the shaded crest. */}
        <RankMark level={level.level} progress={level.progress} compact />
      </TierGlass>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  caption: { letterSpacing: track.caps, marginBottom: -space.xs },
  number: { letterSpacing: track.display, fontVariant: ['tabular-nums'] },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.sm,
    paddingRight: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.control,
  },
  beside: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
