// The Sessions tab — every session rendered as a FULL analysis inline (header +
// earned achievements + the SessionAnalysis dashboard), newest first, stacked and
// hairline-separated. No compact rows, no tap-to-expand: each session is a full view
// on the page. Tapping a session's header opens the focused view (copy / delete).
import AchievementBadge from "@/components/gamification/AchievementBadge";
import AchievementModal, {
  AchievementModalItem,
} from "@/components/gamification/AchievementModal";
import SessionAnalysis from "@/components/history/SessionAnalysis";
import { Text, useInk } from "@/components/Themed";
import { PPL_COLORS, PPL_LABELS } from "@/lib/data/pplCategories";
import { emblemFor } from "@/lib/gamification/achievementEmblems";
import { Rarity } from "@/lib/gamification/rarity";
import { SessionRecap } from "@/lib/history/sessionRecap";
import { formatRelativeDate } from "@/lib/ui/formatters";
import { space } from "@/lib/ui/tokens";
import { GeneratedWorkout, WeightUnit } from "@/types";
import React, { useState } from "react";
import { View as RNView, StyleSheet, TouchableOpacity } from "react-native";

// An achievement earned by a specific session — its badge art rides the header; tap
// for the full-screen spotlight.
export interface SessionAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
}

const cleanTitle = (t: string): string | null => {
  const s = (t || "").trim();
  return !s || /^workout\b/i.test(s) ? null : s;
};

function SessionView({
  recap,
  weightUnit,
  prDays,
  achievements,
  last,
  onPress,
  onPressAchievement,
}: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  prDays: Map<string, Set<string>>;
  achievements?: SessionAchievement[];
  last: boolean;
  onPress: (w: GeneratedWorkout) => void;
  onPressAchievement: (a: SessionAchievement, recap: SessionRecap) => void;
}) {
  const ink = useInk();
  const title =
    cleanTitle(recap.title) ??
    (recap.split ? `${PPL_LABELS[recap.split]} session` : "Workout");
  const splitColor = recap.split ? PPL_COLORS[recap.split] : ink.muted;

  return (
    <RNView
      style={[
        styles.session,
        !last && {
          borderBottomColor: ink.hairline,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Header — tap for the focused view (copy / delete). */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onPress(recap.workout)}
        style={styles.head}
      >
        <RNView style={styles.titleRow}>
          <RNView style={[styles.dot, { backgroundColor: splitColor }]} />
          <Text variant="heading" tone="primary" weight="bold" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </RNView>
        <Text variant="meta" tone="secondary" numberOfLines={1}>
          {formatRelativeDate(recap.workout.createdAt)}
          {recap.split && (
            <>
              {" · "}
              <Text variant="meta" weight="semiBold" style={{ color: splitColor }}>
                {PPL_LABELS[recap.split]}
              </Text>
            </>
          )}
          {` · ${recap.sets} sets · ${recap.durationMin}m`}
        </Text>
      </TouchableOpacity>

      {/* Earned achievements */}
      {achievements && achievements.length > 0 && (
        <RNView style={styles.achRow}>
          {achievements.slice(0, 5).map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.achItem}
              onPress={() => onPressAchievement(a, recap)}
              activeOpacity={0.7}
              hitSlop={6}
              accessibilityLabel={a.title}
            >
              <AchievementBadge
                icon={a.icon}
                emblem={emblemFor(a.id)}
                rarity={a.rarity}
                size={26}
              />
              <Text variant="meta" tone="secondary" weight="semiBold" numberOfLines={1}>
                {a.title}
              </Text>
            </TouchableOpacity>
          ))}
        </RNView>
      )}

      <SessionAnalysis workout={recap.workout} weightUnit={weightUnit} prDays={prDays} />
    </RNView>
  );
}

interface SessionsFeedProps {
  recaps: SessionRecap[];
  weightUnit: WeightUnit;
  visibleCount: number;
  prDays: Map<string, Set<string>>;
  onPressSession: (w: GeneratedWorkout) => void;
  onToggleShowAll?: () => void;
  totalCount: number;
  achievementsByWorkout?: Record<string, SessionAchievement[]>;
}

export default function SessionsFeed({
  recaps,
  weightUnit,
  visibleCount,
  prDays,
  onPressSession,
  onToggleShowAll,
  totalCount,
  achievementsByWorkout,
}: SessionsFeedProps) {
  const ink = useInk();
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);
  if (recaps.length === 0) return null;

  const openSpotlight = (a: SessionAchievement, recap: SessionRecap) => {
    const where =
      cleanTitle(recap.title) ??
      (recap.split ? `${PPL_LABELS[recap.split]} session` : "Workout");
    setSpotlight({
      ...a,
      earnedLabel: `${where} · ${formatRelativeDate(recap.workout.createdAt)}`,
    });
  };

  const entries = recaps.slice(0, Math.max(1, visibleCount));
  const hasMore = totalCount > visibleCount;
  const showToggle = onToggleShowAll && (hasMore || visibleCount > 3);

  return (
    <RNView>
      {entries.map((r, i) => (
        <SessionView
          key={r.workout.id}
          recap={r}
          weightUnit={weightUnit}
          prDays={prDays}
          achievements={achievementsByWorkout?.[r.workout.id]}
          last={i === entries.length - 1 && !showToggle}
          onPress={onPressSession}
          onPressAchievement={openSpotlight}
        />
      ))}

      {showToggle && (
        <TouchableOpacity style={styles.viewAll} onPress={onToggleShowAll} activeOpacity={0.7}>
          <Text variant="meta" weight="semiBold" style={{ color: ink.secondary }}>
            {hasMore ? `View all ${totalCount} sessions` : "Show less"}
          </Text>
        </TouchableOpacity>
      )}

      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} featurable />
    </RNView>
  );
}

const styles = StyleSheet.create({
  session: { paddingBottom: space.section, marginBottom: space.section },
  head: { paddingBottom: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { flex: 1, letterSpacing: -0.3 },
  achRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    marginBottom: space.lg,
  },
  achItem: { flexDirection: "row", alignItems: "center", gap: space.sm },
  viewAll: { paddingVertical: space.lg, alignItems: "center" },
});
