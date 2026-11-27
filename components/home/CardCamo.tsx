// Absolute-fill camo layer for the rank card (and its mini previews). Sits at the
// bottom of the card, above the tier tint and below the Sheen + content. Geometry
// is seeded + cached (lib/ui/camoPatterns), drawn in a fixed viewBox so it scales
// to any card size. Low layer opacity keeps theme ink legible on every camo.
// Only the final camo animates — a slow UI-thread drift, off under Reduce Motion.
import { useTheme } from '@/contexts/ThemeContext';
import { CardCamo as CardCamoSpec, camoPalette } from '@/lib/gamification/cardCamos';
import { CAMO_H, CAMO_W, CamoShape, camoGeometry } from '@/lib/ui/camoPatterns';
import { readableInkOn } from '@/lib/ui/contrast';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

interface Props {
  camo: CardCamoSpec;
  tierColor: string; // TierFoil.color — pattern palettes lean toward it
  dark?: boolean; // force a surface (e.g. the always-dark completion screen); defaults to theme
  animate?: boolean; // false for previews: no drift even on the animated camo
}

const DRIFT_MS = 16000;
const DRIFT_PX = 18;

function useThemeIsDark(): boolean {
  const { currentTheme } = useTheme();
  return readableInkOn(currentTheme.colors.background) === '#FFFFFF';
}

export default function CardCamo({ camo, tierColor, dark, animate = true }: Props) {
  const themeDark = useThemeIsDark();
  const isDark = dark ?? themeDark;
  const rawId = useId();
  const uid = useMemo(() => rawId.replace(/[^a-zA-Z0-9]/g, ''), [rawId]);
  const palette = useMemo(() => camoPalette(camo, tierColor), [camo, tierColor]);
  const geo = useMemo(() => camoGeometry(camo.pattern), [camo.pattern]);
  const opacity = isDark ? camo.opacity.dark : camo.opacity.light;

  if (camo.pattern === 'none' || opacity <= 0) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {camo.pattern === 'cosmic' ? (
        <Cosmic uid={uid} palette={palette} geo={geo} animate={animate && !!camo.animated} />
      ) : (
        <Svg width="100%" height="100%" viewBox={`0 0 ${CAMO_W} ${CAMO_H}`} preserveAspectRatio="xMidYMid slice">
          <Defs>
            {camo.pattern === 'brushed' && (
              <SvgLinearGradient id={`metal${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={palette[0]} />
                <Stop offset="0.35" stopColor={palette[1]} />
                <Stop offset="0.55" stopColor={palette[2]} />
                <Stop offset="1" stopColor={palette[3]} />
              </SvgLinearGradient>
            )}
            {camo.pattern === 'facets' && (
              <SvgLinearGradient id={`prism${uid}`} x1="0" y1="0" x2="1" y2="0.4">
                {palette.map((c, i) => (
                  <Stop key={i} offset={i / (palette.length - 1)} stopColor={c} />
                ))}
              </SvgLinearGradient>
            )}
            {geo.tile && (
              <Pattern id={`tile${uid}`} patternUnits="userSpaceOnUse" width={geo.tile.size} height={geo.tile.size}>
                {geo.tile.shapes.map((s, i) => renderShape(s, i, palette))}
              </Pattern>
            )}
          </Defs>
          {camo.pattern === 'brushed' && <Rect x={0} y={0} width={CAMO_W} height={CAMO_H} fill={`url(#metal${uid})`} />}
          {geo.tile && <Rect x={0} y={0} width={CAMO_W} height={CAMO_H} fill={`url(#tile${uid})`} />}
          {geo.shapes.map((s, i) => renderShape(s, i, palette))}
          {camo.pattern === 'facets' && (
            <Rect x={0} y={0} width={CAMO_W} height={CAMO_H} fill={`url(#prism${uid})`} opacity={0.45} />
          )}
        </Svg>
      )}
      {(camo.pattern === 'weave' || camo.pattern === 'brushed') && (
        // Soft diagonal falloff so weave/metal read as a lit surface, not a flat print.
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.12)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

function renderShape(s: CamoShape, key: number, palette: string[]) {
  const fill = palette[s.color % palette.length];
  switch (s.kind) {
    case 'path':
      return <Path key={key} d={s.d} fill={fill} opacity={s.opacity} />;
    case 'rect':
      return <Rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} fill={fill} opacity={s.opacity} />;
    case 'circle':
      return <Circle key={key} cx={s.cx} cy={s.cy} r={s.r} fill={fill} opacity={s.opacity} />;
    default:
      return null;
  }
}

// Nebula: clouds and stars on two layers drifting in opposite directions — a
// cheap parallax. Transforms run on the UI thread (no per-frame JS).
function Cosmic({
  uid,
  palette,
  geo,
  animate,
}: {
  uid: string;
  palette: string[];
  geo: ReturnType<typeof camoGeometry>;
  animate: boolean;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const moving = animate && !reduced;

  useEffect(() => {
    if (!moving) return;
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [moving, t]);

  const cloudStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (t.value - 0.5) * 2 * DRIFT_PX }, { translateY: (t.value - 0.5) * DRIFT_PX * 0.6 }],
  }));
  const starStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (0.5 - t.value) * DRIFT_PX * 0.8 }],
  }));

  const clouds = geo.shapes.filter((s): s is Extract<CamoShape, { kind: 'cloud' }> => s.kind === 'cloud');
  const cloudColors = palette.slice(0, 3);

  return (
    <>
      <Animated.View style={[styles.overscan, cloudStyle]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${CAMO_W} ${CAMO_H}`} preserveAspectRatio="xMidYMid slice">
          <Defs>
            {cloudColors.map((c, i) => (
              <RadialGradient key={i} id={`cloud${i}${uid}`} cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={c} stopOpacity={0.9} />
                <Stop offset="0.6" stopColor={c} stopOpacity={0.35} />
                <Stop offset="1" stopColor={c} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {clouds.map((s, i) => (
            <Ellipse
              key={i}
              cx={s.cx}
              cy={s.cy}
              rx={s.rx}
              ry={s.ry}
              fill={`url(#cloud${s.color % cloudColors.length}${uid})`}
              opacity={s.opacity}
            />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.overscan, starStyle]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${CAMO_W} ${CAMO_H}`} preserveAspectRatio="xMidYMid slice">
          {(geo.stars ?? []).map((s, i) => renderShape(s, i, palette))}
        </Svg>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  // Oversized by the drift distance so the edges never show while moving.
  overscan: { position: 'absolute', top: -DRIFT_PX, bottom: -DRIFT_PX, left: -DRIFT_PX * 2, right: -DRIFT_PX * 2 },
});
