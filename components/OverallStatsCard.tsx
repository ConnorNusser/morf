// Overall strength, "full-bleed hero" (canvas O6): a tier-colored wash that fades
// into the screen, a giant faded tier letter behind a big percentile, and the
// E–S ladder as segments (reached = solid, current = glowing partial fill).
// One component for History, Home, Profile and Career.
import { Text, useInk } from "@/components/Themed";
import useCountUp from "@/hooks/useCountUp";
import {
  getStrengthTier,
  RADAR_TIER_THRESHOLDS,
  StrengthTier,
  StrengthTierBase,
} from "@/lib/data/strengthStandards";
import { getTierBandProgress } from "@/lib/gamification/tierTimeline";
import { OverallStats } from "@/lib/storage/userProfile";
import { hexAlpha, tierFoil } from "@/lib/ui/tierFoil";
import { radius, space, STRENGTH_ANIM_MS, track } from "@/lib/ui/tokens";
import { getPercentileSuffix } from "@/lib/utils/utils";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

interface OverallStatsCardProps {
  stats: OverallStats;
  // Post-workout replay: bar/number animate from this pre-workout percentile to current.
  animateFrom?: number;
}

// Display glyphs: beyond the type scale on purpose (the hero numeral + watermark).
const HERO_SIZE = 96;
const GHOST_SIZE = 210;
const SEG_H = 10;

const pretty = (t: string) => t.replace("-", "−");

// Segments sized by each base tier's percentile span (E 0–6, D 6–23, … S 85–100).
const SEGMENTS = RADAR_TIER_THRESHOLDS.map((t, i) => {
  const end = RADAR_TIER_THRESHOLDS[i + 1]?.threshold ?? 100;
  return { base: t.label, start: t.threshold, end, span: end - t.threshold };
});

export default function OverallStatsCard({ stats, animateFrom }: OverallStatsCardProps) {
  const ink = useInk();
  const percentile = Number.isNaN(stats.overallPercentile) ? 0 : stats.overallPercentile;
  const ranked = percentile > 0;
  const tier = (ranked ? stats.strengthLevel : "E-") as StrengthTier;
  const foil = tierFoil(percentile);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Counts up on every arrival (from the pre-workout percentile on replay); the
  // ladder fills along with the number.
  const shown = useCountUp(percentile, { from: animateFrom ?? 0, duration: STRENGTH_ANIM_MS });
  const shownBase = getStrengthTier(shown).charAt(0) as StrengthTierBase;
  const band = getTierBandProgress(percentile);

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setIsModalOpen(true)} accessibilityRole="button">
        <View style={styles.container}>
          <LinearGradient
            colors={[hexAlpha(foil.color, 0.42), hexAlpha(foil.color, 0.14), hexAlpha(foil.color, 0)]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Text
            weight="bold"
            style={[styles.ghost, { color: hexAlpha(foil.light, 0.08) }]}
            numberOfLines={1}
            accessible={false}
          >
            {pretty(tier)}
          </Text>

          <Text variant="meta" weight="bold" tone="secondary" style={styles.caps}>
            Overall strength
          </Text>

          <View style={styles.heroRow}>
            <Text weight="bold" tone="primary" style={styles.hero}>
              {ranked ? shown : "—"}
            </Text>
            <View style={styles.heroSide}>
              <Text variant="title" weight="bold" tone="primary">
                {ranked ? `${getPercentileSuffix(shown)} percentile` : "Unranked"}
              </Text>
              <Text variant="meta" tone="secondary">
                {ranked ? "Tier " : "Log a main lift"}
                {ranked ? (
                  <Text variant="meta" weight="bold" style={{ color: foil.light }}>
                    {pretty(tier)}
                  </Text>
                ) : null}
                {ranked && band.nextTier ? ` · ${band.toNext} to ${pretty(band.nextTier)}` : ""}
                {ranked && !band.nextTier ? " · max tier" : ""}
              </Text>
            </View>
          </View>

          <View style={styles.ladder}>
            {SEGMENTS.map((s) => {
              const segFoil = tierFoil(Math.max(1, s.start));
              const fill = Math.max(0, Math.min(1, (shown - s.start) / s.span));
              const current = ranked && s.base === shownBase;
              const done = ranked && fill >= 1 && !current;
              return (
                <View key={s.base} style={[styles.seg, { flex: s.span }]}>
                  <View
                    style={[
                      styles.segTrack,
                      { backgroundColor: done ? segFoil.color : current ? hexAlpha(segFoil.light, 0.16) : ink.hairline },
                    ]}
                  >
                    {current && fill > 0 ? (
                      <LinearGradient
                        colors={[segFoil.color, segFoil.light]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={[styles.segFill, { width: `${Math.max(8, fill * 100)}%`, shadowColor: segFoil.light }]}
                      />
                    ) : null}
                  </View>
                  <Text
                    variant="meta"
                    weight="bold"
                    style={[styles.segLabel, { color: current ? segFoil.light : ink.faint }]}
                  >
                    {s.base}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
      {isModalOpen &&
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy import for circular dependency avoidance
        React.createElement(require("./OverallStrengthModal").default, {
          visible: isModalOpen,
          onClose: () => setIsModalOpen(false),
        })}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.card,
    overflow: "hidden",
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    gap: space.lg,
  },
  ghost: {
    position: "absolute",
    right: -space.section * 2,
    top: -space.section,
    fontSize: GHOST_SIZE,
    lineHeight: GHOST_SIZE * 1.05,
    letterSpacing: -GHOST_SIZE * 0.08,
    fontWeight: "900",
  },
  caps: { letterSpacing: track.caps, textTransform: "uppercase" },
  heroRow: { flexDirection: "row", alignItems: "flex-end", gap: space.md },
  hero: {
    fontSize: HERO_SIZE,
    lineHeight: HERO_SIZE * 0.95,
    letterSpacing: -HERO_SIZE * 0.05,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  heroSide: { paddingBottom: space.sm, flexShrink: 1 },
  ladder: { flexDirection: "row", gap: 3, marginTop: space.sm },
  seg: { gap: 6 },
  segTrack: { height: SEG_H, borderRadius: SEG_H },
  segFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: SEG_H,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  segLabel: {},
});
