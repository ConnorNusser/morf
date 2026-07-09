// The Sessions tab — a scannable feed of compact session rows, newest first.
// One row = title + right-aligned date, then a single quiet detail line; the
// full analysis (KPIs, muscle focus, per-set detail) lives behind the tap in
// WorkoutDetailModal, which renders SessionAnalysis — so no information is
// lost, only relocated.
import AchievementBadge from "@/components/gamification/AchievementBadge";
import AchievementModal, {
  AchievementModalItem,
} from "@/components/gamification/AchievementModal";
import { Text, useInk } from "@/components/Themed";
import Badge from "@/components/ui/Badge";
import { PPL_COLORS, PPL_LABELS } from "@/lib/data/pplCategories";
import { emblemFor } from "@/lib/gamification/achievementEmblems";
import { Rarity } from "@/lib/gamification/rarity";
import { SessionRecap } from "@/lib/history/sessionRecap";
import { formatRelativeDate } from "@/lib/ui/formatters";
import { space, trend } from "@/lib/ui/tokens";
import { GeneratedWorkout } from "@/types";
import React, { useState } from "react";
import { View as RNView, StyleSheet, TouchableOpacity } from "react-native";

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

// Drop trailing "(Equipment)".
const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();

// The detail line's lead: the session's best set.
// "Deadlift 225×5" / bodyweight: "Pull Ups ×12".
function topSetLabel(recap: SessionRecap): string | null {
  if (recap.standout) {
    const s = recap.standout;
    return `${shortName(s.name)} ${s.weight}×${s.reps}`;
  }
  const top = recap.lineup[0];
  if (!top) return null;
  return top.weight > 0
    ? `${top.name} ${top.weight}×${top.reps}`
    : `${top.name} ×${top.reps}`;
}

function SessionView({
  recap,
  achievements,
  last,
  onPress,
  onPressAchievement,
}: {
  recap: SessionRecap;
  achievements?: SessionAchievement[];
  last: boolean;
  onPress: (w: GeneratedWorkout) => void;
  onPressAchievement: (a: SessionAchievement, recap: SessionRecap) => void;
}) {
  const ink = useInk();
  const title =
    cleanTitle(recap.title) ??
    (recap.split ? `${PPL_LABELS[recap.split]} session` : "Workout");
  const topSet = topSetLabel(recap);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => onPress(recap.workout)}
      style={[
        styles.session,
        !last && {
          borderBottomColor: ink.hairline,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <RNView style={styles.titleRow}>
        <Text variant="body" tone="primary" weight="semiBold" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {/* Icon-only badges — titles live in the spotlight modal a tap away. */}
        {(achievements ?? []).slice(0, 3).map((a) => (
          <TouchableOpacity
            key={a.id}
            onPress={() => onPressAchievement(a, recap)}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityLabel={a.title}
          >
            <AchievementBadge icon={a.icon} emblem={emblemFor(a.id)} rarity={a.rarity} size={18} />
          </TouchableOpacity>
        ))}
        {recap.pr && <Badge label="PR" color={trend.up} />}
        <Text variant="meta" tone="faint" style={styles.date}>
          {formatRelativeDate(recap.workout.createdAt)}
        </Text>
      </RNView>

      <Text variant="meta" numberOfLines={1} style={styles.detail}>
        {recap.split && (
          <Text variant="meta" weight="semiBold" style={{ color: PPL_COLORS[recap.split] }}>
            {PPL_LABELS[recap.split]}
            <Text variant="meta" tone="muted">
              {"  ·  "}
            </Text>
          </Text>
        )}
        {topSet && (
          <Text variant="meta" tone="secondary" weight="medium">
            {topSet}
            <Text variant="meta" tone="muted">
              {"  ·  "}
            </Text>
          </Text>
        )}
        <Text variant="meta" tone="muted">
          {recap.sets} {recap.sets === 1 ? "set" : "sets"}
          {recap.durationMin > 0 ? `  ·  ${recap.durationMin}m` : ""}
        </Text>
      </Text>
    </TouchableOpacity>
  );
}

interface SessionsFeedProps {
  recaps: SessionRecap[];
  visibleCount: number;
  onPressSession: (w: GeneratedWorkout) => void;
  onToggleShowAll?: () => void;
  totalCount: number;
  achievementsByWorkout?: Record<string, SessionAchievement[]>;
}

export default function SessionsFeed({
  recaps,
  visibleCount,
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
  const showToggle = onToggleShowAll && (hasMore || visibleCount > 8);

  return (
    <RNView>
      {entries.map((r, i) => (
        <SessionView
          key={r.workout.id}
          recap={r}
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
  session: { paddingVertical: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { flex: 1, letterSpacing: -0.2 },
  date: { marginLeft: space.xs, fontVariant: ["tabular-nums"] },
  detail: { marginTop: space.xs },
  viewAll: { paddingVertical: space.lg, alignItems: "center" },
});
