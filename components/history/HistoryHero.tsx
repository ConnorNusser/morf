import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getNextTierInfo, getStrengthTier, getTierColor } from '@/lib/data/strengthStandards';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING = 112;
const STROKE = 9;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

// Base-tier → the word the app already uses for it (see TierBadge tooltips).
const TIER_NAME: Record<string, string> = {
  S: 'Elite',
  A: 'Advanced',
  B: 'Intermediate',
  C: 'Developing',
  D: 'Novice',
  E: 'Beginner',
};

interface RankState {
  loaded: boolean;
  hasLifts: boolean;
  overall: number; // 0-100 overall percentile
}

// ── data ───────────────────────────────────────────────────────────────────

function useRank(): RankState {
  const [state, setState] = useState<RankState>({ loaded: false, hasLifts: false, overall: 0 });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [lifts, filters] = await Promise.all([
          userService.getAllFeaturedLifts(),
          storageService.getLiftDisplayFilters(),
        ]);
        const visible = lifts.filter(l => !filters.hiddenLiftIds.includes(l.workoutId));
        const pcts = visible.map(l => l.percentileRanking);
        const overall = pcts.length ? calculateOverallPercentile(pcts) : 0;
        if (alive) setState({ loaded: true, hasLifts: visible.length > 0, overall });
      } catch {
        if (alive) setState({ loaded: true, hasLifts: false, overall: 0 });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

// ── count-up ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, run: boolean, duration = 900, delay = 250) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    let started = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (ts: number) => {
      if (!started) started = ts;
      const p = Math.min(1, (ts - started - delay) / duration);
      if (p >= 0) setValue(target * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration, delay]);
  return value;
}

// ── ring ───────────────────────────────────────────────────────────────────

function RankRing({ progress, color, track }: { progress: number; color: string; track: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(220, withTiming(progress, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [p, progress]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - p.value) }));
  return (
    <Svg width={RING} height={RING}>
      <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={track} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={RING / 2}
        cy={RING / 2}
        r={R}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
      />
    </Svg>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function HistoryHero() {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;

  const { loaded, hasLifts, overall } = useRank();
  const ranked = loaded && hasLifts && overall > 0;

  const band = getTierBandProgress(overall);
  const next = getNextTierInfo(overall);
  const tier = getStrengthTier(overall);
  const tierColor = getTierColor(tier);
  const baseLetter = tier.charAt(0);
  const subTier = tier.slice(1);
  const tierName = TIER_NAME[baseLetter] ?? '';

  const pctVal = Math.round(useCountUp(overall, ranked));

  if (!loaded) {
    return <RNView style={[styles.card, styles.placeholder, { borderRadius: currentTheme.borderRadius, backgroundColor: colors.surface, borderColor: colors.border }]} />;
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={[
        styles.card,
        { borderRadius: currentTheme.borderRadius, backgroundColor: colors.surface, borderColor: colors.border, shadowColor: '#000' },
      ]}
    >
      <RNView style={styles.header}>
        <Text style={[styles.kicker, { color: colors.text + '99', fontFamily: fonts.semiBold }]}>Strength rank</Text>
        {ranked && (
          <Text style={[styles.kickerSub, { color: colors.text + '55', fontFamily: fonts.medium }]}>
            across your main lifts
          </Text>
        )}
      </RNView>

      {ranked ? (
        <RNView style={styles.body}>
          <RNView style={[styles.ringWrap, { shadowColor: tierColor }]}>
            <RankRing progress={band.progress} color={tierColor} track={colors.text + '12'} />
            <Animated.View entering={FadeIn.delay(320).duration(420)} style={StyleSheet.absoluteFill}>
              <RNView style={styles.ringCenter}>
                <RNView style={styles.tierRow}>
                  <Text style={[styles.tierLetter, { color: tierColor, fontFamily: fonts.bold }]}>{baseLetter}</Text>
                  {!!subTier && (
                    <Text style={[styles.tierSub, { color: tierColor, fontFamily: fonts.bold }]}>{subTier}</Text>
                  )}
                </RNView>
                <Text style={[styles.tierPct, { color: colors.text + '99', fontFamily: fonts.medium }]}>{pctVal}th %ile</Text>
              </RNView>
            </Animated.View>
          </RNView>

          <Animated.View entering={FadeInDown.delay(360).duration(420)} style={styles.info}>
            <Text style={[styles.tierName, { color: colors.text, fontFamily: fonts.bold }]}>{tierName}</Text>
            <Text style={[styles.tierGrade, { color: tierColor, fontFamily: fonts.semiBold }]}>
              {tier} tier
            </Text>
            <RNView style={[styles.toNext, { borderTopColor: colors.border }]}>
              {next.next ? (
                <Text style={[styles.toNextText, { color: colors.text + 'B0', fontFamily: fonts.medium }]}>
                  <Text style={{ color: tierColor, fontFamily: fonts.bold }}>+{Math.max(1, next.needed)}%</Text>
                  {` to ${next.next} tier`}
                </Text>
              ) : (
                <Text style={[styles.toNextText, { color: tierColor, fontFamily: fonts.semiBold }]}>Top tier reached</Text>
              )}
            </RNView>
          </Animated.View>
        </RNView>
      ) : (
        <RNView style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.text + '80', fontFamily: fonts.medium }]}>
            {hasLifts
              ? 'Add your bodyweight in your profile to rank your lifts.'
              : 'Log your main lifts to unlock your strength rank.'}
          </Text>
        </RNView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  placeholder: { height: 168, opacity: 0.5 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  kicker: { fontSize: 13, letterSpacing: 0.2 },
  kickerSub: { fontSize: 11, letterSpacing: 0.3 },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  ringWrap: {
    width: RING,
    height: RING,
    // soft tier-colored glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
  },
  ringCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tierRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tierLetter: { fontSize: 44, letterSpacing: -1, lineHeight: 48 },
  tierSub: { fontSize: 18, letterSpacing: -0.5, marginTop: 4, marginLeft: 1 },
  tierPct: { fontSize: 11, letterSpacing: 0.2, marginTop: 1 },
  info: { flex: 1 },
  tierName: { fontSize: 22, letterSpacing: -0.3 },
  tierGrade: { fontSize: 13, letterSpacing: 0.3, marginTop: 1 },
  toNext: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toNextText: { fontSize: 13, letterSpacing: 0.1 },
  empty: { paddingVertical: 22, alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
