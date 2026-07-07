import AchievementBadge from "@/components/gamification/AchievementBadge";
import AchievementModal, {
  AchievementModalItem,
} from "@/components/gamification/AchievementModal";
import { Text } from "@/components/Themed";
import SectionLabel from "@/components/ui/SectionLabel";
import { useTheme } from "@/contexts/ThemeContext";
import { TIER_COLORS } from "@/lib/data/strengthStandards";
import { emblemFor } from "@/lib/gamification/achievementEmblems";
import { Rarity, RARITY_META } from "@/lib/gamification/rarity";
import { TOTAL_CLUB_TIERS } from "@/lib/gamification/strengthFeats";
import { radius, space, tint, track, withAlpha } from "@/lib/ui/tokens";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// A club's color is its strength-tier color (600 = E grey ... 2000 = S gold).
const clubColor = (target: number): string =>
  TIER_COLORS[TOTAL_CLUB_TIERS[target] ?? "S"];

export interface ClubAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
}

export interface TotalLift {
  label: string;
  value: number;
  color: string;
}

export interface TotalClub {
  value: number;
  achieved: boolean;
}

export interface PowerliftingTotalData {
  total: number;
  lifts: TotalLift[];
  clubs: TotalClub[];
  nextTarget: number;
  remaining: number;
  achievedCount: number;
  allUnlocked: boolean;
  currentClub?: ClubAchievement | null;
}

const STEP = 100; // lb per ladder cell

// Flat "Big 3 Total" widget: ladder cells fill with the three lift colours stacked by contribution; pound clubs (600/1000/1200) label the scale.
export default function PowerliftingTotal({
  data,
}: {
  data: PowerliftingTotalData;
}) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const n = data.clubs.length;

  const scaleMax = data.clubs[n - 1]?.value || STEP;
  const cellCount = Math.max(1, Math.round(scaleMax / STEP));
  const currentCell = Math.min(cellCount - 1, Math.floor(data.total / STEP));

  let running = 0;
  const liftBands = data.lifts.map((l) => {
    const lo = running;
    running += Math.max(0, l.value);
    return { lo, hi: running, color: l.color };
  });
  const colorForCell = (i: number) => {
    const lo = i * STEP;
    if (lo >= data.total) return null;
    return (
      liftBands.find((b) => lo >= b.lo && lo < b.hi)?.color ??
      liftBands[liftBands.length - 1]?.color
    );
  };

  const bandOf = (cellIdx: number) => {
    const lower = cellIdx * STEP;
    const b = data.clubs.findIndex((c) => lower < c.value);
    return b === -1 ? n - 1 : b;
  };
  const currentBand = bandOf(currentCell);
  const bandCounts = data.clubs.map(
    (_, b) =>
      Array.from({ length: cellCount }, (_, i) => bandOf(i)).filter(
        (x) => x === b,
      ).length,
  );

  const club = data.currentClub;
  const clubAccent = club ? RARITY_META[club.rarity].accent : TIER_COLORS.S;
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <SectionLabel style={styles.microLabel}>MAIN LIFT TOTAL</SectionLabel>
        {club && (
          <TouchableOpacity
            style={[
              styles.clubChip,
              {
                backgroundColor: tint(clubAccent),
                borderColor: withAlpha(clubAccent, "muted"),
              },
            ]}
            activeOpacity={0.7}
            onPress={() => setSpotlight({ ...club })}
            accessibilityRole="button"
            accessibilityLabel={club.title}
          >
            <AchievementBadge
              icon={club.icon}
              emblem={emblemFor(club.id)}
              rarity={club.rarity}
              size={20}
            />
            <Text
              variant="meta"
              weight="bold"
              style={[styles.clubChipText, { color: clubAccent }]}
            >
              {club.title.toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.header}>
        <Text>
          <Text
            variant="hero"
            tone="primary"
            weight="bold"
            style={styles.headerNum}
          >
            {data.total.toLocaleString()}
          </Text>
          <Text variant="meta" tone="muted">
            {" "}
            lb
          </Text>
        </Text>

        <View style={styles.liftStack}>
          {data.lifts.map((l) => (
            <View key={l.label} style={styles.liftRow}>
              <Text
                variant="emphasis"
                tone="muted"
                weight="semiBold"
                style={[styles.liftVal, l.value > 0 && { color: l.color }]}
              >
                {l.value.toLocaleString()}
              </Text>
              <Text variant="meta" tone="secondary" style={styles.liftLabel}>
                {l.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.ladderRow}>
        {Array.from({ length: cellCount }, (_, i) => {
          const fill = colorForCell(i);
          return (
            <View
              key={i}
              style={[
                styles.ladderCell,
                {
                  backgroundColor: fill || colors.border,
                  opacity: fill ? 1 : 0.3,
                  borderWidth: i === currentCell ? 2 : 0,
                  borderColor: colors.text,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.ladderLabels}>
        {data.clubs.map((club, b) => (
          <Text
            key={club.value}
            variant="meta"
            tone={b === currentBand ? "primary" : "faint"}
            weight={b === currentBand ? "semiBold" : "regular"}
            style={[styles.ladderBaseLabel, { flex: bandCounts[b] }]}
          >
            {club.value.toLocaleString()}
          </Text>
        ))}
      </View>

      <Text variant="meta" tone="secondary" style={styles.nextLine}>
        {data.allUnlocked ? (
          <Text weight="semiBold" style={{ color: TIER_COLORS.S }}>
            Every club conquered
          </Text>
        ) : (
          <>
            <Text tone="primary" weight="bold">
              {data.remaining.toLocaleString()} lb
            </Text>
            {" to the "}
            <Text
              weight="semiBold"
              style={{ color: clubColor(data.nextTarget) }}
            >
              {data.nextTarget.toLocaleString()} lb Club
            </Text>
          </>
        )}
      </Text>

      <AchievementModal
        item={spotlight}
        onClose={() => setSpotlight(null)}
        featurable
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: space.xs, gap: space.md },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  microLabel: {
    marginBottom: 0,
  },
  clubChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingLeft: space.xs,
    paddingRight: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  clubChipText: {
    letterSpacing: 0.4,
  },
  nextLine: { marginBottom: space.section },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.lg,
  },
  headerNum: { letterSpacing: track.display },

  liftStack: { alignItems: "flex-end", gap: space.xs },
  liftRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.md,
    padding: space.xs,
  },
  liftVal: {
    letterSpacing: -0.3,
  },
  liftLabel: { width: 58 },

  ladderRow: { flexDirection: "row", gap: 2, marginTop: space.md },
  ladderCell: { flex: 1, height: 14, borderRadius: 2 },
  ladderLabels: { flexDirection: "row", marginTop: space.xs },
  ladderBaseLabel: { textAlign: "right" },
});
