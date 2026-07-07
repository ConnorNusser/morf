import { Text } from "@/components/Themed";
import SectionLabel from "@/components/ui/SectionLabel";
import { getTierColor, StrengthTier } from "@/lib/data/strengthStandards";
import { OverallStats } from "@/lib/storage/userProfile";
import { space } from "@/lib/ui/tokens";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import Card from "./Card";
import ProgressBar from "./ProgressBar";
import TierBadge from "./TierBadge";

interface OverallStatsCardProps {
  stats: OverallStats;
  // When set (post-workout replay), the bar sweeps and the number counts up from
  // this pre-workout percentile to the current one — the earned delta made visible.
  animateFrom?: number;
}

export default function OverallStatsCard({ stats, animateFrom }: OverallStatsCardProps) {
  const percentile = Number.isNaN(stats.overallPercentile)
    ? 0
    : stats.overallPercentile;
  const tierColor = getTierColor(stats.strengthLevel as StrengthTier);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Count the headline number up from animateFrom → percentile on a post-workout
  // replay; otherwise it just shows the current value.
  const [shownPercentile, setShownPercentile] = useState(
    animateFrom != null ? Math.round(animateFrom) : percentile,
  );
  const counter = useRef(new Animated.Value(animateFrom ?? percentile)).current;
  useEffect(() => {
    if (animateFrom == null) {
      setShownPercentile(percentile);
      return;
    }
    counter.setValue(animateFrom);
    const id = counter.addListener(({ value }) => setShownPercentile(Math.round(value)));
    Animated.timing(counter, {
      toValue: percentile,
      duration: 800,
      useNativeDriver: false,
    }).start();
    return () => counter.removeListener(id);
  }, [animateFrom, percentile, counter]);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setIsModalOpen(true)}
      >
        <Card style={styles.container}>
          <View style={styles.header}>
            <SectionLabel style={styles.title}>OVERALL STRENGTH</SectionLabel>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBlock}>
              <Text
                variant="header"
                weight="bold"
                style={{ color: tierColor }}
              >
                {shownPercentile}
              </Text>
              <Text variant="meta" tone="secondary">
                percentile
              </Text>
            </View>

            <View style={styles.statBlock}>
              <TierBadge
                tier={stats.strengthLevel as StrengthTier}
                size="large"
                variant="text"
              />
              <Text variant="meta" tone="secondary">
                tier
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <ProgressBar
              progress={percentile}
              from={animateFrom ?? 0}
              height={10}
              style={styles.progressBar}
              showTicks={true}
              color={tierColor}
            />
            <Text variant="meta" tone="secondary" style={styles.progressLabel}>
              Progress to S Tier
            </Text>
          </View>
        </Card>
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
  container: { gap: space.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.md,
  },
  // The header row already spaces the section; SectionLabel's own margin off.
  title: {
    marginBottom: 0,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.md,
  },
  statBlock: {
    alignItems: "center",
  },
  progressContainer: {
    marginTop: space.md,
  },
  progressBar: {
    marginBottom: space.xs,
  },
  progressLabel: {
    textAlign: "center",
  },
});
