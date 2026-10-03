import HexTierBadge from "@/components/gamification/HexTierBadge";
import { Text, useInk } from "@/components/Themed";
import SectionLabel from "@/components/ui/SectionLabel";
import { getTierColor } from "@/lib/data/strengthStandards";
import { getTierBandProgress } from "@/lib/gamification/tierTimeline";
import { radius, space, track } from "@/lib/ui/tokens";
import { getPercentileSuffix } from "@/lib/utils/utils";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

interface Props {
  /** Overall strength percentile across the visible featured lifts (0 = unranked). */
  percentile: number;
  onPress: () => void;
}

// Home's lead: the lifter's rank as the first thing on screen, with how far
// the next tier is. Opens Career.
export default function RankHero({ percentile, onPress }: Props) {
  const ink = useInk();
  const band = getTierBandProgress(percentile);
  const color = getTierColor(band.tier);
  const ranked = percentile > 0;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${band.tier} tier, view career`}
    >
      <HexTierBadge tier={band.tier} size={104} />

      <View style={styles.body}>
        <SectionLabel style={styles.label}>Overall strength</SectionLabel>

        {ranked ? (
          <View style={styles.valueRow}>
            <Text variant="header" tone="primary" weight="bold" style={styles.value}>
              {percentile}
            </Text>
            <Text variant="body" tone="secondary">
              {getPercentileSuffix(percentile)} percentile
            </Text>
          </View>
        ) : (
          <Text variant="body" tone="secondary" style={styles.unranked}>
            Log a ranked lift to earn your tier
          </Text>
        )}

        <View style={[styles.track, { backgroundColor: ink.ghost }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.max(3, band.progress * 100)}%`, backgroundColor: color },
            ]}
          />
        </View>

        {ranked && (
          <Text variant="meta" tone="muted">
            {band.nextTier ? (
              <>
                <Text variant="meta" tone="primary" weight="semiBold">
                  {band.toNext}
                </Text>
                {" to "}
                <Text variant="meta" weight="semiBold" style={{ color: getTierColor(band.nextTier) }}>
                  {band.nextTier}
                </Text>
              </>
            ) : (
              "Max tier reached"
            )}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginBottom: space.md,
  },
  body: {
    flex: 1,
    gap: space.sm,
  },
  label: {
    marginBottom: 0,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2, // the ordinal suffix reads as part of the number
  },
  value: {
    letterSpacing: track.display,
    fontVariant: ["tabular-nums"],
  },
  unranked: {
    marginVertical: space.xs,
  },
  track: {
    height: space.sm,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
});
