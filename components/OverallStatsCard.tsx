import { Text } from "@/components/Themed";
import { getTierColor, StrengthTier } from "@/lib/data/strengthStandards";
import { OverallStats } from "@/lib/storage/userProfile";
import { space } from "@/lib/ui/tokens";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Card from "./Card";
import ProgressBar from "./ProgressBar";
import TierBadge from "./TierBadge";

interface OverallStatsCardProps {
  stats: OverallStats;
}

export default function OverallStatsCard({ stats }: OverallStatsCardProps) {
  const percentile = Number.isNaN(stats.overallPercentile)
    ? 0
    : stats.overallPercentile;
  const tierColor = getTierColor(stats.strengthLevel as StrengthTier);

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setIsModalOpen(true)}
      >
        <Card variant="elevated" style={styles.container}>
          <View style={styles.header}>
            {/* A notch above the shared micro-label size — this is the
                home strength block's headline, not a section eyebrow. */}
            <Text
              variant="body"
              tone="muted"
              weight="bold"
              style={styles.title}
            >
              OVERALL STRENGTH
            </Text>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBlock}>
              <Text
                variant="header"
                weight="bold"
                style={{ color: tierColor }}
              >
                {percentile}
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
              height={10}
              style={styles.progressBar}
              showTicks={true}
              exerciseName="Overall Strength"
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
  // The shared uppercase micro-label section grammar (History / Career).
  title: {
    letterSpacing: 1,
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
