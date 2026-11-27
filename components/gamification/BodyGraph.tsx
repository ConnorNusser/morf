// Front/back body map: each region is filled by its strength tier, hatched
// when it's trained but unranked, and dim when untrained. Path data lives in
// bodyGraphPaths.ts; fill rules in lib/gamification/bodyGraphDisplay.ts.
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { BodyRegion } from '@/lib/data/bodyRegions';
import { getTierColor, StrengthTierBase, TIER_COLORS } from '@/lib/data/strengthStandards';
import { RegionState } from '@/lib/gamification/bodyGraph';
import { RegionFill, regionFill } from '@/lib/gamification/bodyGraphDisplay';
import { Ink, radius, space, withAlpha } from '@/lib/ui/tokens';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, G, Line, Path, Pattern, Rect } from 'react-native-svg';
import {
  BODY_VIEWBOX,
  FigureView,
  REGION_PATHS,
  RegionShapes,
  regionsInView,
  SILHOUETTE,
} from './bodyGraphPaths';

const AnimatedG = Animated.createAnimatedComponent(G);

const MIRROR = `matrix(-1 0 0 1 ${BODY_VIEWBOX.width} 0)`;
const ASPECT = BODY_VIEWBOX.height / BODY_VIEWBOX.width;
const BOTH_MIN_WIDTH = 280; // below this, Front/Back become a toggle
const SINGLE_MAX_HEIGHT = 380;
const COMPACT_HEIGHT = 120;
const DIMMED_OPACITY = 0.2;
const PULSE_PEAK = 0.4;

export type BodyGraphView = 'front' | 'back' | 'both';

interface Props {
  regions: RegionState[];
  onRegionPress?: (region: RegionState) => void;
  /** Dims every other region (completion-screen mini view). */
  highlight?: BodyRegion[];
  /** Small and non-interactive; shows only the views that contain a highlighted region. */
  compact?: boolean;
  /** Fixed view. Omit to show both side by side when there's room, else a Front/Back toggle. */
  view?: BodyGraphView;
  /** 'dark' for always-dark screens (workout complete), which ignore the theme. */
  surface?: 'theme' | 'dark';
  showLegend?: boolean;
}

const WHITE = '#FFFFFF';
const DARK_INK: Ink = {
  primary: WHITE,
  secondary: withAlpha(WHITE, 'secondary'),
  muted: withAlpha(WHITE, 'muted'),
  faint: withAlpha(WHITE, 'faint'),
  ghost: withAlpha(WHITE, 'ghost'),
  hairline: withAlpha(WHITE, 'hairline'),
};

function useGraphInk(surface: 'theme' | 'dark'): Ink {
  const themeInk = useInk();
  return surface === 'dark' ? DARK_INK : themeInk;
}

export default function BodyGraph({
  regions,
  onRegionPress,
  highlight,
  compact = false,
  view,
  surface = 'theme',
  showLegend = !compact,
}: Props) {
  const { currentTheme } = useTheme();
  const ink = useGraphInk(surface);
  const [width, setWidth] = useState(0);
  const [toggled, setToggled] = useState<FigureView>('front');
  const hatchId = `hatch${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const outline = surface === 'dark' ? '#000000' : currentTheme.colors.background;

  const byRegion = useMemo(() => new Map(regions.map(r => [r.region, r])), [regions]);
  const highlightSet = useMemo(() => (highlight ? new Set(highlight) : null), [highlight]);

  // One-shot pulse for regions trained in the last 72h.
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  const anyFresh = !compact && regions.some(r => r.fresh);
  useEffect(() => {
    if (!anyFresh || reduced) return;
    pulse.value = withDelay(
      350,
      withSequence(withTiming(PULSE_PEAK, { duration: 450 }), withTiming(0, { duration: 800 })),
    );
  }, [anyFresh, reduced, pulse]);

  const views: FigureView[] = useMemo(() => {
    if (compact) {
      if (view && view !== 'both') return [view];
      if (view === 'both') return ['front', 'back'];
      if (!highlightSet) return ['front'];
      const shown = (['front', 'back'] as FigureView[]).filter(v =>
        regionsInView(v).some(r => highlightSet.has(r)),
      );
      return shown.length ? shown : ['front'];
    }
    if (view === 'both') return ['front', 'back'];
    if (view) return [view];
    return width >= BOTH_MIN_WIDTH ? ['front', 'back'] : [toggled];
  }, [compact, view, highlightSet, width, toggled]);

  const showToggle = !compact && !view && width > 0 && width < BOTH_MIN_WIDTH;
  const gap = compact ? space.sm : space.lg;
  const figureWidth = compact
    ? COMPACT_HEIGHT / ASPECT
    : views.length === 2
      ? Math.max(0, (width - gap) / 2)
      : Math.min(width, SINGLE_MAX_HEIGHT / ASPECT);
  const figureHeight = figureWidth * ASPECT;
  const interactive = !compact && !!onRegionPress;

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <View onLayout={compact ? undefined : onLayout}>
      {showToggle && (
        <View style={styles.toggle}>
          <SegmentedTabs
            tabs={[
              { key: 'front', label: 'Front' },
              { key: 'back', label: 'Back' },
            ]}
            active={toggled}
            onChange={setToggled}
          />
        </View>
      )}
      {(compact || width > 0) && (
        <View style={[styles.figures, { gap }]}>
          {views.map(v => (
            <View key={v} style={styles.figureCol}>
              <Svg
                width={figureWidth}
                height={figureHeight}
                viewBox={`0 0 ${BODY_VIEWBOX.width} ${BODY_VIEWBOX.height}`}
              >
                <Defs>
                  <HatchPattern id={hatchId} ink={ink} />
                </Defs>
                <Shapes shapes={SILHOUETTE[v]} fill={ink.hairline} />
                {regionsInView(v).map(region => {
                  const state = byRegion.get(region);
                  const fill = regionFill(state);
                  const dimmed = !!highlightSet && !highlightSet.has(region);
                  return (
                    <G
                      key={region}
                      opacity={dimmed ? DIMMED_OPACITY : 1}
                      onPress={interactive && state ? () => onRegionPress?.(state) : undefined}
                    >
                      <G opacity={fill.kind === 'volume' ? fill.intensity : 1}>
                        <Shapes
                          shapes={REGION_PATHS[v][region]!}
                          fill={fillColor(fill, ink, hatchId)}
                          stroke={outline}
                        />
                      </G>
                      {anyFresh && state?.fresh && (
                        <FreshPulse shapes={REGION_PATHS[v][region]!} pulse={pulse} />
                      )}
                    </G>
                  );
                })}
              </Svg>
              {!compact && views.length === 2 && (
                <Text variant="meta" tone="faint" style={styles.viewLabel}>
                  {v === 'front' ? 'Front' : 'Back'}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
      {showLegend && <Legend ink={ink} />}
    </View>
  );
}

function fillColor(fill: RegionFill, ink: Ink, hatchId: string): string {
  if (fill.kind === 'tier') return getTierColor(fill.tier);
  if (fill.kind === 'volume') return `url(#${hatchId})`;
  return ink.ghost;
}

function Shapes({ shapes, fill, stroke }: { shapes: RegionShapes; fill: string; stroke?: string }) {
  const sw = stroke ? 1.5 : 0;
  return (
    <>
      {shapes.center?.map((d, i) => <Path key={`c${i}`} d={d} fill={fill} stroke={stroke} strokeWidth={sw} />)}
      {shapes.side?.map((d, i) => <Path key={`l${i}`} d={d} fill={fill} stroke={stroke} strokeWidth={sw} />)}
      {shapes.side && (
        <G transform={MIRROR}>
          {shapes.side.map((d, i) => <Path key={`r${i}`} d={d} fill={fill} stroke={stroke} strokeWidth={sw} />)}
        </G>
      )}
    </>
  );
}

// Each pulsing region owns its animated props; the clock is shared.
function FreshPulse({ shapes, pulse }: { shapes: RegionShapes; pulse: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({ opacity: pulse.value }));
  return (
    <AnimatedG animatedProps={animatedProps} opacity={0}>
      <Shapes shapes={shapes} fill={WHITE} />
    </AnimatedG>
  );
}

function HatchPattern({ id, ink }: { id: string; ink: Ink }) {
  return (
    <Pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
      <Rect width={6} height={6} fill={ink.ghost} />
      <Line x1={0} y1={0} x2={0} y2={6} stroke={ink.secondary} strokeWidth={3} />
    </Pattern>
  );
}

// ---- Legend ----

const LEGEND_TIERS: { label: string; base: StrengthTierBase }[] = [
  { label: 'S', base: 'S' },
  { label: 'A', base: 'A' },
  { label: 'B', base: 'B' },
  { label: 'C', base: 'C' },
  { label: 'D–E', base: 'D' },
];
const SWATCH = 12;

function Legend({ ink }: { ink: Ink }) {
  const swatchHatchId = `legend${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={styles.legend}>
      {LEGEND_TIERS.map(t => (
        <View key={t.label} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: TIER_COLORS[t.base] }]} />
          <Text variant="meta" tone="muted">{t.label}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <Svg width={SWATCH} height={SWATCH} style={styles.swatch}>
          <Defs>
            <HatchPattern id={swatchHatchId} ink={ink} />
          </Defs>
          <Rect width={SWATCH} height={SWATCH} fill={`url(#${swatchHatchId})`} />
        </Svg>
        <Text variant="meta" tone="muted">Volume only</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, { backgroundColor: ink.ghost }]} />
        <Text variant="meta" tone="muted">Untrained</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { marginBottom: space.md },
  figures: { flexDirection: 'row', justifyContent: 'center' },
  figureCol: { alignItems: 'center' },
  viewLabel: { marginTop: space.xs },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: space.md,
    rowGap: space.sm,
    marginTop: space.lg,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: radius.pill, overflow: 'hidden' },
});
