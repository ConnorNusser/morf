// UserAvatar wrapped in an animated ring in the lifter's rank colors. The ring
// is the rank gradient with a bright highlight arc; the whole ring rotates so
// the light appears to orbit. Higher levels get a thicker, faster ring, then a
// pulsing accent glow, then orbiting sparkles (see lib/ui/rankAura.ts).
//
// Perf: all motion is UI-thread transforms/opacity driven by ONE shared clock
// (rankAuraClock) — no per-frame JS, no per-avatar animation loops. The ring
// draws OUTSIDE the photo with no layout footprint (absolute, negative inset),
// so swapping UserAvatar for RankAvatar never shifts a row. `animated={false}`
// (or reduce-motion) renders the same ring static and detaches from the clock.
import UserAvatar from '@/components/ui/UserAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { rankAccentForLevel, rankGradientForLevel } from '@/lib/gamification/ranks';
import { readableInkOn } from '@/lib/ui/contrast';
import { auraGeometry, cyclesPerClock, rankAura, sparkleAngles } from '@/lib/ui/rankAura';
import React, { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { useAuraClock } from './rankAuraClock';

export interface RankAvatarProps {
  uri?: string | null;
  username?: string | null;
  size: number;
  /** Lifter level; null/undefined renders a plain UserAvatar with no ring. */
  level: number | null | undefined;
  /** 0..1 progress through the level (blends the gradient toward the next rank). */
  progress?: number;
  /** false = static ring (no clock subscription). Default true. */
  animated?: boolean;
}

const HIGHLIGHT = '#FFFFFF';
const TAU = Math.PI * 2;

function RankAvatar({ level, ...rest }: RankAvatarProps) {
  if (level == null || !Number.isFinite(level) || level < 1) {
    return <UserAvatar uri={rest.uri} username={rest.username} size={rest.size} />;
  }
  return <AuraAvatar level={level} {...rest} />;
}

function AuraAvatar({ uri, username, size, level, progress = 0, animated = true }: RankAvatarProps & { level: number }) {
  const { currentTheme } = useTheme();
  const dark = readableInkOn(currentTheme.colors.background) === '#FFFFFF';
  const reduceMotion = useReducedMotion();
  const moving = animated && !reduceMotion;
  const clock = useAuraClock(moving);

  const rawId = useId();
  const uid = useMemo(() => rawId.replace(/[^a-zA-Z0-9]/g, ''), [rawId]);

  const aura = useMemo(() => rankAura(level), [level]);
  const geo = useMemo(() => auraGeometry(size, aura), [size, aura]);
  const [start, end] = useMemo(() => rankGradientForLevel(level, progress), [level, progress]);
  const accent = useMemo(() => rankAccentForLevel(level, dark, progress), [level, dark, progress]);

  const box = size + geo.pad * 2;
  const r = (box - geo.ring) / 2;
  const circumference = TAU * r;
  const highlightLen = circumference * 0.22;
  const glowBox = box + geo.glowPad * 2;

  const orbitCycles = cyclesPerClock(aura.orbitMs);
  const pulseCycles = cyclesPerClock(aura.pulseMs);
  const sparkleCycles = cyclesPerClock(aura.sparkleOrbitMs);

  const ringStyle = useAnimatedStyle(() => {
    if (!moving) return { transform: [{ rotate: '0deg' }] };
    const t = clock.value * orbitCycles;
    return { transform: [{ rotate: `${(t - Math.floor(t)) * 360}deg` }] };
  }, [moving, orbitCycles]);

  const glowStyle = useAnimatedStyle(() => {
    if (!moving) return { opacity: 0.7, transform: [{ scale: 1 }] };
    const t = clock.value * pulseCycles;
    const wave = 0.5 - 0.5 * Math.cos((t - Math.floor(t)) * TAU);
    return { opacity: 0.45 + 0.45 * wave, transform: [{ scale: 0.96 + 0.06 * wave }] };
  }, [moving, pulseCycles]);

  const sparkleStyle = useAnimatedStyle(() => {
    if (!moving) return { opacity: 0.9, transform: [{ rotate: '0deg' }] };
    const s = clock.value * sparkleCycles;
    const p = clock.value * pulseCycles * 2;
    const twinkle = 0.5 - 0.5 * Math.cos((p - Math.floor(p)) * TAU);
    return { opacity: 0.55 + 0.45 * twinkle, transform: [{ rotate: `${-(s - Math.floor(s)) * 360}deg` }] };
  }, [moving, sparkleCycles, pulseCycles]);

  const sparkles = useMemo(() => {
    const orbitR = r + geo.ring * 0.5 + geo.sparkleR + 1;
    const c = box / 2;
    return sparkleAngles(aura.sparkles).map((a, i) => ({
      key: i,
      cx: c + Math.cos(a) * orbitR,
      cy: c + Math.sin(a) * orbitR,
      r: i % 2 === 0 ? geo.sparkleR : geo.sparkleR * 0.7,
    }));
  }, [aura.sparkles, box, r, geo.ring, geo.sparkleR]);
  // Sparkles sit just outside the ring; give their layer room past the box.
  const sparkleBox = box + (geo.sparkleR + 1) * 4;
  const sparkleOffset = (sparkleBox - box) / 2;

  return (
    <View style={{ width: size, height: size }}>
      {aura.glow && (
        <Animated.View
          pointerEvents="none"
          style={[styles.layer, { left: -(geo.pad + geo.glowPad), top: -(geo.pad + geo.glowPad), width: glowBox, height: glowBox }, glowStyle]}
        >
          <Svg width={glowBox} height={glowBox}>
            <Defs>
              <RadialGradient id={`glow${uid}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={accent} stopOpacity={0.6} />
                <Stop offset={String(box / 2 / (glowBox / 2))} stopColor={accent} stopOpacity={0.45} />
                <Stop offset="1" stopColor={accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={glowBox / 2} cy={glowBox / 2} r={glowBox / 2} fill={`url(#glow${uid})`} />
          </Svg>
        </Animated.View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[styles.layer, { left: -geo.pad, top: -geo.pad, width: box, height: box }, ringStyle]}
      >
        <Svg width={box} height={box}>
          <Defs>
            <LinearGradient id={`ring${uid}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={start} />
              <Stop offset="0.5" stopColor={end} />
              <Stop offset="1" stopColor={start} />
            </LinearGradient>
          </Defs>
          <Circle cx={box / 2} cy={box / 2} r={r} stroke={`url(#ring${uid})`} strokeWidth={geo.ring} fill="none" />
          {/* Comet highlight: a soft wide streak with a bright narrow core. */}
          <Circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            stroke={HIGHLIGHT}
            strokeOpacity={aura.highlight * 0.45}
            strokeWidth={geo.ring}
            strokeLinecap="round"
            strokeDasharray={[highlightLen, circumference]}
            fill="none"
          />
          <Circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            stroke={HIGHLIGHT}
            strokeOpacity={aura.highlight}
            strokeWidth={Math.max(1, geo.ring * 0.55)}
            strokeLinecap="round"
            strokeDasharray={[highlightLen * 0.45, circumference]}
            strokeDashoffset={-highlightLen * 0.3}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {sparkles.length > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.layer, { left: -geo.pad - sparkleOffset, top: -geo.pad - sparkleOffset, width: sparkleBox, height: sparkleBox }, sparkleStyle]}
        >
          <Svg width={sparkleBox} height={sparkleBox}>
            {sparkles.map(s => (
              <Circle key={s.key} cx={s.cx + sparkleOffset} cy={s.cy + sparkleOffset} r={s.r} fill={sparkleColor(s.key, dark, start, end)} />
            ))}
          </Svg>
        </Animated.View>
      )}

      <UserAvatar uri={uri} username={username} size={size} />
    </View>
  );
}

// Dark themes: alternate white and the rank's light stop. Light themes: the
// saturated stop (white would vanish on the background).
function sparkleColor(i: number, dark: boolean, light: string, deep: string): string {
  if (!dark) return deep;
  return i % 2 === 0 ? HIGHLIGHT : light;
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
  },
});

export default React.memo(RankAvatar);
