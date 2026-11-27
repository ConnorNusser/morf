// Anime-style rank crest for the competitive ladder, drawn from the rank's
// EmblemSpec. The silhouette upgrades per tier and keeps what's below it:
// Bronze shield → Silver + side blades → Gold + crown point → Platinum +
// layered plates → Emerald + gem inset → Diamond faceted gem + small wings →
// Master full wings + aura ring → Grandmaster flame wings → Challenger grand
// crown + animated prismatic aura. The division shows as 1–3 chevrons on the
// crest (III = 1, II = 2, I = 3).
//
// Colors come from the BLENDED tier metal (rankGradientForLevel +
// rankShineForLevel), so the crest drifts toward the next tier as you level.
// At ≤28px fine detail (feathers, facets, crown jewel, plate rivets) drops out
// and chevrons thicken so the header badge stays crisp.
import { useInk } from '@/components/Themed';
import {
  EmblemSpec,
  mixHex,
  PRISMATIC_STOPS,
  rankForLevel,
  rankGradientForLevel,
  rankShineForLevel,
  rankStep,
  rankStepCount,
} from '@/lib/gamification/ranks';
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
  /** Step-within-tier pips under the crest (3 divisions, or 10 levels on master tiers). */
  showPips?: boolean;
  /** Empty-pip color; defaults to theme ink. Pass one on always-dark screens. */
  pipTrackColor?: string;
}

// ---- Geometry (viewBox 0 0 100 100, crest centered on 50,52) ----

const CX = 50;
const CY = 52;

const CREST = 'M50 27 L71 35 V54 C71 67 62 75 50 81 C38 75 29 67 29 54 V35 Z';
const CREST_INNER = 'M50 31.5 L67 38 V54 C67 64.5 59.5 71.5 50 76.5 C40.5 71.5 33 64.5 33 54 V38 Z';
// Platinum+: a second, raised plate inside the crest.
const PLATE = 'M50 35 L63.5 40.5 V54 C63.5 62.5 57.5 68.5 50 72.5 C42.5 68.5 36.5 62.5 36.5 54 V40.5 Z';
const PLATE_RIVETS: [number, number][] = [[39.5, 43], [60.5, 43]];
// Specular streak on the upper-left of the shield: the "metal" highlight.
const HIGHLIGHT = 'M33.5 39 L48 33.5 L44 37 C39 39 36.5 42 35.5 48 L33.5 52 Z';

// Silver+: side blades jutting from the shoulders (left; right is mirrored).
const BLADE = 'M31 36 L8 25 Q17 36 30.5 49 Z';
const BLADE_EDGE = 'M30 38.5 L13 28.5';

// Gold+: crown point rising behind the crest; Challenger: three-point crown.
const CROWN_POINT = 'M42 32 L50 11 L58 32 Z';
const CROWN_GRAND = 'M35 34 L37 16 L44 26 L50 7 L56 26 L63 16 L65 34 Z';
const CROWN_JEWELS: Record<'point' | 'grand', [number, number, number][]> = {
  point: [[50, 20, 2.4]],
  grand: [[50, 16, 2.6], [37.5, 21, 1.8], [62.5, 21, 1.8]],
};

// Wings (left; right is mirrored).
const WING_SMALL =
  'M31 42 C25 36 18 34 11 36 C15 38 18 40 19 42 C14 43 12 45 11 48 C16 47 20 48 22 49 ' +
  'C18 51 16 54 16 57 C21 54 25 54 30 55 Z';
const WING =
  'M31 42 C21 31 10 28 2 31 C9 34 13 37 15 40 C7 40 3 43 1 48 C8 46 14 47 17 49 ' +
  'C10 51 6 55 6 60 C13 56 21 55 29 56 Z';
const WING_FEATHERS = 'M15 40 C21 41 26 43 30 46 M17 49 C22 49 26 50 29 52';
// Grandmaster+: flame wings, tongues licking up and out.
const WING_FLAME =
  'M31 40 C25 29 17 20 6 15 C12 23 14 29 13 34 C8 31 4 32 0 35 C6 39 9 43 10 47 ' +
  'C6 47 2 49 1 53 C8 53 13 54 16 56 C12 58 10 61 10 65 C17 60 23 58 30 58 Z';
const WING_FLAME_CORE = 'M29 43 C24 36 19 31 13 28 C16 33 17 37 16 41 C21 42 25 44 29 47 Z';

// Emerald: round cabochon. Diamond+: faceted gem.
const GEM_FACETED = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} L${cx + r * 0.9} ${cy - r * 0.3} L${cx + r * 0.55} ${cy + r * 0.85} ` +
  `L${cx - r * 0.55} ${cy + r * 0.85} L${cx - r * 0.9} ${cy - r * 0.3} Z`;
const GEM_FACETS = (cx: number, cy: number, r: number) =>
  `M${cx - r * 0.9} ${cy - r * 0.3} H${cx + r * 0.9} ` +
  `M${cx - r * 0.4} ${cy - r * 0.3} L${cx} ${cy + r * 0.85} L${cx + r * 0.4} ${cy - r * 0.3} ` +
  `M${cx} ${cy - r} L${cx - r * 0.4} ${cy - r * 0.3} M${cx} ${cy - r} L${cx + r * 0.4} ${cy - r * 0.3}`;

// Division chevron pointing up, apex at (cx, y): half-width w, thickness t.
function chevronPath(cx: number, y: number, w: number, t: number): string {
  const drop = w * 0.62;
  return (
    `M${cx - w} ${y + drop} L${cx} ${y} L${cx + w} ${y + drop} ` +
    `L${cx + w} ${y + drop + t} L${cx} ${y + t} L${cx - w} ${y + drop + t} Z`
  );
}

interface ChevronLayout {
  w: number;
  t: number;
  gap: number;
  top: number;
}

// Chevrons stack upward (I = 3 reads as climbing). Below the gem when there is
// one, otherwise centered on the crest; chunkier at tiny sizes.
function chevronLayout(count: number, hasGem: boolean, tiny: boolean): ChevronLayout {
  const [w, t, gap] = hasGem ? (tiny ? [9, 4.5, 7] : [8, 3.4, 6]) : tiny ? [11, 5.5, 8.5] : [10, 4.2, 7.5];
  const height = w * 0.62 + t + (count - 1) * gap;
  const centerY = hasGem ? 63.5 : 55;
  return { w, t, gap, top: centerY - height / 2 };
}

const SPEED_LINES = 'M4 45 H19 M1 52 H17 M6 59 H20 M81 45 H96 M83 52 H99 M80 59 H94';

const AURA_R = 41;
const AURA_C = 2 * Math.PI * AURA_R;

function Mirrored({ children }: { children: React.ReactNode }) {
  return (
    <>
      <G>{children}</G>
      <G transform="translate(100 0) scale(-1 1)">{children}</G>
    </>
  );
}

export default function RankEmblem({ level, progress = 0, size = 48, showPips = false, pipTrackColor }: Props) {
  const ink = useInk();
  const rank = rankForLevel(level);
  const spec: EmblemSpec = rank.emblem;
  const [light, deep] = rankGradientForLevel(level, progress);
  const shine = rankShineForLevel(level, progress);
  const outline = mixHex(deep, '#000000', 0.45);
  const plateDeep = mixHex(deep, '#000000', 0.15);
  const tiny = size <= 28;

  // Gradient ids must be unique per instance (web shares one document).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (k: string) => `${k}${uid}`;
  const url = (k: string) => `url(#${id(k)})`;

  const reduced = useReducedMotion();
  const glow = useSharedValue(0.45);
  const flow = useSharedValue(0);
  const animate = spec.prismatic && !reduced;
  useEffect(() => {
    if (!animate) {
      glow.value = 0.45;
      flow.value = 0;
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    glow.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 1800, easing: ease }), withTiming(0.3, { duration: 1800, easing: ease })),
      -1,
    );
    flow.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
  }, [animate, glow, flow]);
  const glowProps = useAnimatedProps(() => ({ opacity: glow.value }));
  const flowProps = useAnimatedProps(() => ({ strokeDashoffset: -AURA_C * flow.value }));

  const auraStops = spec.prismatic ? PRISMATIC_STOPS : [light, deep, light];
  const hasGem = spec.gem !== 'none';
  const gemCY = spec.pips > 0 ? (tiny ? 42 : 45) : 52;
  const gemR = spec.pips > 0 ? (tiny ? 6 : 6.5) : tiny ? 10 : 9;
  const chev = spec.pips > 0 ? chevronLayout(spec.pips, hasGem, tiny) : null;
  const label = `${rank.name} rank emblem`;

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id('metal')} x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor={shine} />
            <Stop offset="0.4" stopColor={light} />
            <Stop offset="1" stopColor={deep} />
          </LinearGradient>
          <LinearGradient id={id('plate')} x1="0.2" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={light} />
            <Stop offset="1" stopColor={plateDeep} />
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
            <Stop offset="0.35" stopColor={spec.prismatic ? PRISMATIC_STOPS[1] : light} stopOpacity={0.9} />
            <Stop offset="1" stopColor={light} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={id('flame')} x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={spec.prismatic ? PRISMATIC_STOPS[1] : shine} />
            <Stop offset="0.45" stopColor={light} />
            <Stop offset="1" stopColor={deep} />
          </LinearGradient>
          <RadialGradient id={id('gem')} cx="38%" cy="32%" r="70%">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.35" stopColor={light} />
            <Stop offset="1" stopColor={outline} />
          </RadialGradient>
        </Defs>

        {/* Challenger: pulsing prismatic glow */}
        {spec.prismatic && <AnimatedCircle cx={CX} cy={CY} r={50} fill={url('glow')} animatedProps={glowProps} />}

        {/* Aura ring (Master+); Challenger's flows prismatic */}
        {spec.aura === 'ring' && (
          <Circle cx={CX} cy={CY} r={AURA_R} fill="none" stroke={url('aura')} strokeWidth={tiny ? 4 : 3} opacity={0.85} />
        )}
        {spec.aura === 'prismatic' && (
          <>
            <Circle cx={CX} cy={CY} r={AURA_R} fill="none" stroke={url('aura')} strokeWidth={tiny ? 4.5 : 3.5} opacity={0.9} />
            {!tiny && (
              <AnimatedCircle
                cx={CX}
                cy={CY}
                r={AURA_R}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={`${AURA_C * 0.08} ${AURA_C * 0.17}`}
                opacity={0.75}
                animatedProps={flowProps}
              />
            )}
          </>
        )}

        {/* Wings */}
        {spec.wings === 'small' && (
          <Mirrored>
            <Path d={WING_SMALL} fill={url('wing')} stroke={outline} strokeWidth={1.4} strokeLinejoin="round" />
          </Mirrored>
        )}
        {spec.wings === 'full' && (
          <Mirrored>
            <Path d={WING} fill="#000000" opacity={0.25} transform="translate(0 2.5)" />
            <Path d={WING} fill={url('wing')} stroke={outline} strokeWidth={1.4} strokeLinejoin="round" />
            {!tiny && <Path d={WING_FEATHERS} stroke={outline} strokeWidth={1} fill="none" opacity={0.6} />}
          </Mirrored>
        )}
        {spec.wings === 'flame' && (
          <Mirrored>
            <Path d={WING_FLAME} fill="#000000" opacity={0.25} transform="translate(0 2.5)" />
            <Path d={WING_FLAME} fill={url('flame')} stroke={outline} strokeWidth={1.4} strokeLinejoin="round" />
            {!tiny && <Path d={WING_FLAME_CORE} fill={shine} opacity={0.55} />}
          </Mirrored>
        )}
        {spec.wings === 'none' && spec.blades && !tiny && spec.stage <= 3 && (
          // A touch of anime motion on the bladed tiers before wings arrive.
          <Path d={SPEED_LINES} stroke={light} strokeWidth={2.4} strokeLinecap="round" opacity={0.35} />
        )}

        {/* Side blades (Silver+) */}
        {spec.blades && (
          <Mirrored>
            <Path d={BLADE} fill={url('metal')} stroke={outline} strokeWidth={1.4} strokeLinejoin="round" />
            {!tiny && <Path d={BLADE_EDGE} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1} />}
          </Mirrored>
        )}

        {/* Crown (Gold+; Challenger's has three points) */}
        {spec.crown !== 'none' && (
          <>
            <Path
              d={spec.crown === 'grand' ? CROWN_GRAND : CROWN_POINT}
              fill={url('metal')}
              stroke={outline}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            {!tiny &&
              CROWN_JEWELS[spec.crown].map(([x, y, r], i) => (
                <Circle key={i} cx={x} cy={y} r={r} fill={spec.prismatic ? PRISMATIC_STOPS[i + 1] : shine} stroke={outline} strokeWidth={0.8} />
              ))}
          </>
        )}

        {/* Crest: drop shadow, metal body, outline, specular highlight, inner bevel */}
        <Path d={CREST} fill="#000000" opacity={0.3} transform="translate(0 3)" />
        <Path d={CREST} fill={url('metal')} stroke={outline} strokeWidth={1.8} strokeLinejoin="round" />
        <Path d={HIGHLIGHT} fill="#FFFFFF" opacity={0.4} />
        {!tiny && <Path d={CREST_INNER} fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1.2} strokeLinejoin="round" />}

        {/* Layered plate (Platinum+) */}
        {spec.plates && (
          <>
            <Path d={PLATE} fill={url('plate')} stroke={outline} strokeWidth={1.2} strokeLinejoin="round" />
            {!tiny && PLATE_RIVETS.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={1.3} fill={shine} opacity={0.9} />)}
          </>
        )}

        {/* Gem: cabochon (Emerald) or faceted (Diamond+) */}
        {spec.gem === 'inset' && (
          <>
            <Circle cx={CX} cy={gemCY} r={gemR + 1.6} fill={outline} />
            <Circle cx={CX} cy={gemCY} r={gemR} fill={url('gem')} />
          </>
        )}
        {spec.gem === 'faceted' && (
          <>
            <Path d={GEM_FACETED(CX, gemCY, gemR + 1.6)} fill={outline} />
            <Path d={GEM_FACETED(CX, gemCY, gemR)} fill={url('gem')} />
            {!tiny && <Path d={GEM_FACETS(CX, gemCY, gemR)} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={0.7} fill="none" />}
          </>
        )}

        {/* Division chevrons: III = 1, II = 2, I = 3 */}
        {chev &&
          Array.from({ length: spec.pips }, (_, i) => {
            // Bottom chevron first so stacks grow upward.
            const y = chev.top + (spec.pips - 1 - i) * chev.gap;
            return (
              <G key={i}>
                <Path d={chevronPath(CX, y + 1.2, chev.w, chev.t)} fill={outline} opacity={0.5} />
                <Path d={chevronPath(CX, y, chev.w, chev.t)} fill="#FFFFFF" stroke={outline} strokeWidth={0.8} strokeLinejoin="round" />
              </G>
            );
          })}
      </Svg>
      {showPips && <Pips level={level} size={size} fill={deep} light={light} track={pipTrackColor ?? ink.ghost} />}
    </View>
  );
}

function Pips({ level, size, fill, light, track }: { level: number; size: number; fill: string; light: string; track: string }) {
  const total = rankStepCount(level);
  const step = rankStep(level);
  // Ten level pips on master tiers sit smaller than three division pips.
  const d = Math.max(4, Math.round(size / (total > 5 ? 16 : 12)));
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
