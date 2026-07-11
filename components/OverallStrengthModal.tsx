import Badge from "@/components/ui/Badge";
import Card from "@/components/Card";
import IconButton from "@/components/IconButton";
import ProgressBar from "@/components/ProgressBar";
import RadarChart from "@/components/RadarChart";
import StrengthHistoryModal from "@/components/StrengthHistoryModal";
import { Text, useInk, View } from "@/components/Themed";
import TierBadge from "@/components/TierBadge";
import { useTheme } from "@/contexts/ThemeContext";
import {
  AGE_ADJUSTMENT_FACTORS,
  FEMALE_STANDARDS,
  getAgeCategory,
  getNextTierInfo,
  getPercentileColor,
  MALE_STANDARDS,
  RADAR_TIER_THRESHOLDS,
} from "@/lib/data/strengthStandards";
import { userService } from "@/lib/services/userService";
import { userSyncService } from "@/lib/services/userSyncService";
import { radius, screenGutter, space, track } from "@/lib/ui/tokens";
import {
  calculateOverallPercentile,
  roundedAverage as toAvg,
} from "@/lib/utils/utils";
import { UserProfile, UserProgress } from "@/types";
import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

interface OverallStrengthModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function OverallStrengthModal({
  visible,
  onClose,
}: OverallStrengthModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [lifts, setLifts] = useState<UserProgress[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [cardAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    const load = async () => {
      const [data, p] = await Promise.all([
        userService.getAllFeaturedLifts(),
        userService.getUserProfileOrDefault(),
      ]);
      setLifts(data);
      setProfile(p);
    };
    load();
  }, [visible]);

  // Build category averages across ALL lifts using ONLY primary muscles
  const chartData = useMemo(() => {
    const muscleGroups = [
      "chest",
      "back",
      "shoulders",
      "arms",
      "legs",
      "glutes",
    ] as const;
    const liftToMuscles: Record<string, string[]> = {};
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy import for circular dependency avoidance
    const { EXERCISE_CATALOG } = require("@/lib/workout/exerciseCatalog");
    EXERCISE_CATALOG.forEach((w: { id: string; primaryMuscles?: string[] }) => {
      liftToMuscles[w.id] = [...(w.primaryMuscles || [])];
    });

    const groupToValues: Record<string, number[]> = {};
    muscleGroups.forEach((g) => (groupToValues[g] = []));

    lifts.forEach((l) => {
      const groups = liftToMuscles[l.workoutId] || [];
      groups.forEach((g) => {
        if (g in groupToValues && l.percentileRanking > 0)
          groupToValues[g].push(l.percentileRanking);
      });
    });

    return muscleGroups.map((g) => ({
      label: g.charAt(0).toUpperCase() + g.slice(1),
      value: toAvg(groupToValues[g]),
    }));
  }, [lifts]);

  const tooltipDetails = useMemo(() => {
    const byGroup: Record<string, { name: string; pct: number }[]> = {};
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy import for circular dependency avoidance
    const { getCatalogExercise } = require("@/lib/workout/exerciseCatalog");
    lifts.forEach((l) => {
      const w = getCatalogExercise(l.workoutId);
      if (!w) return;
      const primaryGroups = [...(w.primaryMuscles || [])];
      primaryGroups.forEach((g) => {
        if (!byGroup[g]) byGroup[g] = [];
        if (l.percentileRanking > 0)
          byGroup[g].push({ name: w.name, pct: l.percentileRanking });
      });
    });
    const toLines = (g: string) => {
      const key = g.toLowerCase();
      const list = (byGroup[key] || [])
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5);
      if (list.length === 0)
        return ["No recorded lifts", "Tip: Record a lift to unlock insights"];
      return list.map((i) => `${i.name}: ${i.pct}%`);
    };
    return (chartData || []).map((d) => ({ lines: toLines(d.label) }));
  }, [lifts, chartData]);

  const groupInfos = useMemo(() => {
    const map: Record<
      string,
      { id: string; name: string; pct: number; oneRM: number }[]
    > = {};
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lazy import for circular dependency avoidance
    const { getCatalogExercise } = require("@/lib/workout/exerciseCatalog");
    lifts.forEach((l) => {
      const w = getCatalogExercise(l.workoutId);
      if (!w) return;
      const groups = w.primaryMuscles || [];
      groups.forEach((g: string) => {
        const key = g.toLowerCase();
        if (!map[key]) map[key] = [];
        map[key].push({
          id: l.workoutId,
          name: w.name,
          pct: l.percentileRanking,
          oneRM: l.personalRecord,
        });
      });
    });
    Object.keys(map).forEach((k) => map[k].sort((a, b) => b.pct - a.pct));
    return map;
  }, [lifts]);

  useEffect(() => {
    if (selectedIdx >= 0) {
      cardAnim.setValue(0);
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [selectedIdx, cardAnim]);

  // Match overall calculation with the home screen: average of all non-zero lift percentiles
  const overallPercentile = useMemo(() => {
    const nonZero = lifts.map((l) => l.percentileRanking).filter((p) => p > 0);
    return calculateOverallPercentile(nonZero);
  }, [lifts]);

  const sortedLifts = useMemo(() => {
    return lifts.sort((a, b) => b.percentileRanking - a.percentileRanking);
  }, [lifts]);

  useEffect(() => {
    if (!visible || lifts.length === 0) return;

    userSyncService.calculateAndSyncPercentiles().catch((err) => {
      console.error("Error syncing percentile data:", err);
    });
  }, [visible, lifts.length]);

  const bestGroup = useMemo(
    () =>
      chartData.reduce(
        (best, cur) => (cur.value > best.value ? cur : best),
        chartData[0] || { label: "", value: 0 },
      ),
    [chartData],
  );
  const weakGroup = useMemo(
    () =>
      chartData.reduce(
        (weak, cur) => (cur.value < weak.value ? cur : weak),
        chartData[0] || { label: "", value: 0 },
      ),
    [chartData],
  );

  const nextTargets = useMemo(() => {
    if (!profile)
      return [] as {
        id: string;
        name: string;
        current: number;
        target: number;
        delta: number;
      }[];
    const gender = profile.gender;
    const bodyWeight =
      profile.weight.unit === "kg"
        ? Math.round(profile.weight.value * 2.20462)
        : profile.weight.value;
    const ageFactor = profile.age
      ? AGE_ADJUSTMENT_FACTORS[getAgeCategory(profile.age)]
      : 1.0;
    const byId: Record<string, UserProgress> = {};
    lifts.forEach((l) => (byId[l.workoutId] = l));
    const allIds = Object.keys(byId);
    return allIds
      .map((id) => {
        const current = byId[id].personalRecord;
        const standards = (
          gender === "male" ? MALE_STANDARDS : FEMALE_STANDARDS
        )[id];
        if (!standards) return null;
        const pct = byId[id].percentileRanking;
        const next =
          pct >= 90
            ? null
            : pct >= 75
              ? standards.god
              : pct >= 50
                ? standards.elite
                : pct >= 25
                  ? standards.advanced
                  : pct >= 10
                    ? standards.intermediate
                    : standards.beginner;
        if (!next) return null;
        const target = Math.round(next * bodyWeight * ageFactor);
        return {
          id,
          name: id.replace("-", " "),
          current,
          target,
          delta: Math.max(0, target - current),
        };
      })
      .filter(Boolean) as {
      id: string;
      name: string;
      current: number;
      target: number;
      delta: number;
    }[];
  }, [lifts, profile]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View
          style={[
            styles.modalHeader,
            { borderBottomColor: currentTheme.colors.border },
          ]}
        >
          <View style={styles.headerSpacer} />
          <Text variant="title" tone="primary" weight="semiBold">
            Overall Strength
          </Text>
          <IconButton icon="close" onPress={onClose} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text variant="meta" tone="secondary">
              Radar shows your percentile per main lift
            </Text>
          </View>

          <Card style={styles.chartCard}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowHistoryModal(true)}
              style={styles.chartHeader}
            >
              <View style={styles.tierHeaderRow}>
                <TierBadge percentile={overallPercentile} size="large" />
                <View style={styles.heroNumberBlock}>
                  <Text
                    variant="hero"
                    tone="primary"
                    weight="bold"
                    style={styles.heroNumber}
                  >
                    {overallPercentile}
                  </Text>
                  <Text variant="meta" tone="secondary" style={styles.heroSub}>
                    percentile
                  </Text>
                </View>
              </View>
              <ProgressBar
                progress={overallPercentile}
                height={10}
                style={{ marginVertical: space.md, width: "100%" }}
              />
              <View style={styles.heroHintRow}>
                <Text variant="meta" tone="secondary">
                  {!getNextTierInfo(overallPercentile).next
                    ? `Maximum Tier Reached!`
                    : `+${getNextTierInfo(overallPercentile).needed}% to ${getNextTierInfo(overallPercentile).next} Tier`}
                </Text>
                <Text variant="meta" tone="faint">
                  Tap for history
                </Text>
              </View>
            </TouchableOpacity>
            <RadarChart
              data={chartData}
              tiers={RADAR_TIER_THRESHOLDS}
              selectedIndex={selectedIdx}
              onPointPress={(i) => setSelectedIdx(i)}
              details={tooltipDetails}
              inlineTooltip={false}
            />
          </Card>

          {selectedIdx >= 0 && chartData[selectedIdx] && (
            <Animated.View
              style={{
                opacity: cardAnim,
                transform: [
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <Card style={styles.standardCard}>
                <View style={styles.sheetHeaderRow}>
                  <Text variant="body" tone="primary" weight="bold">
                    {chartData[selectedIdx].label}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedIdx(-1)}
                    hitSlop={8}
                  >
                    <Text variant="meta" tone="secondary">
                      Clear
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text variant="statHero" weight="bold" style={styles.sheetPercent}>
                  {chartData[selectedIdx].value}%
                </Text>
                <Text
                  variant="meta"
                  tone="secondary"
                  style={styles.sheetSubtitle}
                >
                  Top contributors
                </Text>
                {(groupInfos[chartData[selectedIdx].label.toLowerCase()] || [])
                  .slice(0, 6)
                  .map((item) => (
                    <View key={item.id} style={styles.sheetRow}>
                      <Text variant="meta" tone="primary">
                        {item.name}
                      </Text>
                      <Text variant="meta" tone="primary" weight="bold">
                        {item.pct}%
                      </Text>
                    </View>
                  ))}
              </Card>
            </Animated.View>
          )}

          <Card style={styles.standardCard}>
            <View style={styles.questHeaderRow}>
              <Text variant="body" tone="primary" weight="bold">
                Next Tier Targets
              </Text>
              <Text variant="meta" tone="secondary">
                {getNextTierInfo(overallPercentile).current} →{" "}
                {getNextTierInfo(overallPercentile).next || "MAX"}
              </Text>
            </View>
            {nextTargets.map((t) => (
              <View key={t.id} style={styles.targetBlock}>
                <View style={styles.targetHeaderRow}>
                  <Text
                    variant="meta"
                    tone="primary"
                    weight="bold"
                    style={styles.targetName}
                  >
                    {t.name}
                  </Text>
                  <View
                    style={[
                      styles.deltaBadge,
                      { backgroundColor: currentTheme.colors.primary },
                    ]}
                  >
                    <Text
                      variant="meta"
                      weight="bold"
                      style={{ color: currentTheme.colors.background }}
                    >
                      +{t.delta}
                    </Text>
                  </View>
                </View>
                <ProgressBar
                  progress={Math.min(
                    100,
                    Math.round((t.current / t.target) * 100),
                  )}
                  height={6}
                  style={styles.targetProgress}
                />
                <View style={styles.targetValuesRow}>
                  <Text variant="meta" tone="secondary">
                    {t.current} now
                  </Text>
                  <Text variant="meta" tone="secondary">
                    {t.target} goal
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          <Card style={styles.liftsCard}>
            <View style={styles.insightRow}>
              <Text variant="meta" tone="secondary">
                {`Strongest: ${bestGroup.label} • Weakest: ${weakGroup.label}`}
              </Text>
            </View>
            {sortedLifts.map((l, _i) => (
              <View
                key={l.workoutId}
                style={[styles.liftRow, { borderBottomColor: ink.hairline }]}
              >
                <Text variant="meta" tone="primary" style={styles.liftName}>
                  {l.workoutId.replace("-", " ")}
                </Text>
                <View style={styles.rowRight}>
                  <Text
                    variant="meta"
                    style={[
                      styles.liftValue,
                      { color: getPercentileColor(l.percentileRanking) },
                    ]}
                  >
                    {l.percentileRanking}
                  </Text>
                  <Badge
                    variant="solid"
                    color={getPercentileColor(l.percentileRanking)}
                    label={l.strengthLevel}
                  />
                </View>
              </View>
            ))}
          </Card>
        </ScrollView>

        <StrengthHistoryModal
          visible={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: {
    width: 40,
  },
  content: { padding: screenGutter, paddingTop: space.lg },
  header: {
    alignItems: "center",
    marginBottom: space.sm,
  },
  chartCard: { marginTop: space.sm },
  chartHeader: {
    alignItems: "center",
    marginBottom: space.sm,
  },
  tierHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  heroNumberBlock: { alignItems: "flex-end" },
  heroNumber: { letterSpacing: track.display },
  heroSub: {
    textTransform: "uppercase",
    letterSpacing: track.caps,
  },
  heroHintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: space.sm,
    width: "100%",
  },
  liftsCard: {
    marginTop: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  standardCard: {
    marginTop: space.sm,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  liftRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  liftName: { textTransform: "capitalize" },
  liftValue: { width: 42, textAlign: "right", fontVariant: ["tabular-nums"] },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.sm,
  },
  questHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.sm,
  },
  targetBlock: { marginBottom: space.md },
  targetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.sm,
  },
  targetName: { textTransform: "capitalize" },
  deltaBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
  },
  targetProgress: { marginBottom: space.sm },
  targetValuesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sheetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.sm,
  },
  sheetPercent: { letterSpacing: track.display, marginBottom: space.sm },
  sheetSubtitle: { marginBottom: space.sm },
  sheetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: space.sm,
  },
});
