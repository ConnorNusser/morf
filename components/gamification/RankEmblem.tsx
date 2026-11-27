// Anime-style rank crest for the account level, drawn from the rank's
// EmblemSpec. Drama escalates with stage: 1 crest → 2 + starburst & speed
// lines → 3 + wings & aura ring → 4 + flame aura & a slow pulsing glow.
// Colors come from the BLENDED level gradient (rankGradientForLevel), so the
// crest drifts toward the next rank's palette as you level.
import { useInk } from '@/components/Themed';
import { Gradient, mixHex, PRISMATIC_STOPS, rankForLevel, rankGradientForLevel, rankStep, rankStepCount } from '@/lib/gamification/ranks';
import React, { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  level: number;
  /** 0..1 through the current level; nudges the blended gradient. */
  progress?: number;
  size?: number;
  /** 1–5 step-within-rank pips under the crest. */
  showPips?: boolean;
  /** Empty-pip color; defaults to theme ink. Pass one on always-dark screens. */
  pipTrackColor?: string;
}

// ---- Geometry (viewBox 0 0 100 100, crest centered on 50,52) ----

const CX = 50;
const CY = 52;

const CREST = 'M50 27 L71 35 V54 C71 67 62 75 50 81 C38 75 29 67 29 54 V35 Z';
const CREST_INNER = 'M50 31.5 L67 38 V54 C67 64.5 59.5 71.5 50 76.5 C40.5 71.5 33 64.5 33 54 V38 Z';

// Feathered left wing; the right one is mirrored.
const WING =
  'M31 42 C21 31 10 28 2 31 C9 34 13 37 15 40 C7 40 3 43 1 48 C8 46 14 47 17 49 ' +
  'C10 51 6 55 6 60 C13 56 21 55 29 56 Z';
const WING_FEATHERS = 'M15 40 C21 41 26 43 30 46 M17 49 C22 49 26 50 29 52';

function sparklePath(cx: number, cy: number, r: number): string {
  const k = r * 0.2;
  return (
    `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} ` +
    `Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} ` +
    `Q${cx - k} ${cy - k} ${cx} ${cy - r} Z`
  );
}

const SPARKLES: Record<1 | 2 | 3, [number, number, number][]> = {
  1: [[50, 53, 13]],
  2: [[43.5, 50, 9.5], [56.5, 58, 8]],
  3: [[50, 49, 11], [39.5, 62, 6], [60.5, 62, 6]],
};

function starburstPath(spikes: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

// Flame/energy aura: tongues that lick taller toward the top.
function flamePath(): string {
  const n = 14;
  const step = (2 * Math.PI) / n;
  const pt = (a: number, r: number) => `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;
  const tipR = (a: number) => 36 + 12 * Math.max(0, -Math.sin(a));
  const valleyR = 31;
  let d = `M${pt(-Math.PI / 2 - step / 2, valleyR)}`;
  for (let i = 0; i < n; i++) {
    const tip = -Math.PI / 2 + i * step;
    d += ` Q${pt(tip - step * 0.3, tipR(tip) * 0.82)} ${pt(tip + step * 0.08, tipR(tip))}`;
    d += ` Q${pt(tip + step * 0.25, valleyR + 3)} ${pt(tip + step / 2, valleyR)}`;
  }
  return `${d} Z`;
}

const SPEED_LINES = 'M4 45 H19 M1 52 H17 M6 59 H20 M81 45 H96 M83 52 H99 M80 59 H94';
const STARBURST = starburstPath(16, 41, 31);
const FLAME = flamePath();

export default function RankEmblem({ level, progress = 0, size = 48, showPips = false, pipTrackColor }: Props) {
  const ink = useInk();
  const rank = rankForLevel(level);
  const { stage, sparkles, prismatic } = rank.emblem;
  const [light, deep] = rankGradientForLevel(level, progress) as Gradient;
  const outline = mixHex(deep, '#000000', 0.45);
  const shine = mixHex(light, '#FFFFFF', 0.55);
  const tiny = size < 28;

  // Gradient ids must be unique per instance (web shares one document).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (k: string) => `${k}${uid}`;
  const url = (k: string) => `url(#${id(k)})`;

  const reduced = useReducedMotion();
  const glow = useSharedValue(0.45);
  const animateGlow = stage === 4 && !reduced;
  useEffect(() => {
    if (!animateGlow) {
      glow.value = 0.45;
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    glow.value = withRepeat(
      withSequence(withTiming(0.75, { duration: 1800, easing: ease }), withTiming(0.3, { duration: 1800, easing: ease })),
      -1,
    );
  }, [animateGlow, glow]);
  const glowProps = useAnimatedProps(() => ({ opacity: glow.value }));

  const auraStops = prismatic ? PRISMATIC_STOPS : [light, deep, light];

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel={`${rank.name} rank emblem`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id('metal')} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={shine} />
            <Stop offset="0.45" stopColor={light} />
            <Stop offset="1" stopColor={deep} />
          </LinearGradient>
          <LinearGradient id={id('wing')} x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={light} />
            <Stop offset="1" stopColor={deep} />
          </LinearGradient>
          <LinearGradient id={id('aura')} x1="0" y1="0" x2="1" y2="1">
            {auraStops.map((c, i) => (
              <Stop key={i} offset={i / (auraStops.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
          <RadialGradient id={id('glow')} cx="50%" cy="52%" r="50%">
            <Stop offset="0.35" stopColor={light} stopOpacity={0.9} />
            <Stop offset="1" stopColor={light} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={id('flame')} x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={prismatic ? PRISMATIC_STOPS[1] : light} />
            <Stop offset="0.6" stopColor={deep} />
            <Stop offset="1" stopColor={deep} stopOpacity={0.6} />
          </LinearGradient>
        </Defs>

        {/* Stage 4: pulsing glow + flame aura */}
        {stage === 4 && (
          <>
            <AnimatedCircle cx={CX} cy={CY} r={50} fill={url('glow')} animatedProps={glowProps} />
            <Path d={FLAME} fill={url('flame')} opacity={0.9} />
          </>
        )}

        {/* Stage 2: starburst + speed lines (stage 3+ keep a quieter burst) */}
        {stage >= 2 && <Path d={STARBURST} fill={url('aura')} opacity={stage === 2 ? 0.55 : 0.3} />}
        {stage === 2 && !tiny && (
          <Path d={SPEED_LINES} stroke={light} strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
        )}

        {/* Stage 3+: aura ring */}
        {stage >= 3 && (
          <Circle cx={CX} cy={CY} r={33} fill="none" stroke={url('aura')} strokeWidth={stage === 4 ? 3.5 : 2.5} opacity={0.9} />
        )}

        {/* Stage 3+: wings */}
        {stage >= 3 && (
          <>
            <G>
              <Path d={WING} fill="#000000" opacity={0.25} transform="translate(0 2.5)" />
              <Path d={WING} fill={url('wing')} stroke={outline} strokeWidth={1.4} strokeLinejoin="round" />
              {!tiny && <Path d={WING_FEATHERS} stroke={outline} strokeWidth={1} fill="none" opacity={0.6} />}
            </G>
            <G transform="translate(100 0) scale(-1 1)">
              <Path d={WING} fill="#000000" opacity={0.25} transform="translate(0 2.5)" />
              <Path d={WING} fill={url('wing')} stroke={outline} strokeWidth={1.4} strokeLinejoin="round" />
              {!tiny && <Path d={WING_FEATHERS} stroke={outline} strokeWidth={1} fill="none" opacity={0.6} />}
            </G>
          </>
        )}

        {/* Crest: drop shadow, metal body, outline, inner bevel */}
        <Path d={CREST} fill="#000000" opacity={0.3} transform="translate(0 3)" />
        <Path d={CREST} fill={url('metal')} stroke={outline} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d={CREST_INNER} fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1.2} strokeLinejoin="round" />

        {/* Sparkle marks */}
        {SPARKLES[sparkles].map(([x, y, r], i) => (
          <G key={i}>
            <Path d={sparklePath(x, y + 1.5, r)} fill={outline} opacity={0.45} />
            <Path d={sparklePath(x, y, r)} fill="#FFFFFF" stroke={outline} strokeWidth={0.8} />
          </G>
        ))}
      </Svg>
      {showPips && <Pips level={level} size={size} fill={deep} light={light} track={pipTrackColor ?? ink.ghost} />}
    </View>
  );
}

function Pips({ level, size, fill, light, track }: { level: number; size: number; fill: string; light: string; track: string }) {
  const total = rankStepCount(level);
  const step = rankStep(level);
  const d = Math.max(4, Math.round(size / 12));
  return (
    <View style={[styles.pips, { gap: Math.max(2, Math.round(d * 0.6)), marginTop: Math.max(2, Math.round(d * 0.5)) }]}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: d,
            height: d,
            borderRadius: d / 2,
            backgroundColor: i < step ? fill : track,
            borderWidth: i < step ? StyleSheet.hairlineWidth : 0,
            borderColor: light,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pips: { flexDirection: 'row', justifyContent: 'center' },
});
