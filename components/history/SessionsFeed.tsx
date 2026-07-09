// The Sessions tab — a scannable feed of compact session rows, newest first.
// One row = title, meta, and a single standout summary line; the full analysis
// (KPIs, muscle focus, per-set detail) lives behind the tap in WorkoutDetailModal,
// which renders SessionAnalysis — so no information is lost, only relocated.
import AchievementBadge from "@/components/gamification/AchievementBadge";
import AchievementModal, {
  AchievementModalItem,
} from "@/components/gamification/AchievementModal";
import { Text, useInk } from "@/components/Themed";
import { PPL_COLORS, PPL_LABELS } from "@/lib/data/pplCategories";
import { emblemFor } from "@/lib/gamification/achievementEmblems";
import { Rarity } from "@/lib/gamification/rarity";
import { SessionRecap } from "@/lib/history/sessionRecap";
import { formatRelativeDate } from "@/lib/ui/formatters";
import { space, trend } from "@/lib/ui/tokens";
import { GeneratedWorkout } from "@/types";
import { Ionicons } from "@expo/vector-icons";
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

// The one-line payload: best set first, then how much else there was.
// "Deadlift 225×5 · e1RM 253 · +3 lifts" / bodyweight: "Pull Ups ×12 · +2 lifts".
function summaryParts(recap: SessionRecap): { set: string; e1rm: number | null; more: number } | null {
  const more = Math.max(0, recap.lineup.length - 1);
  if (recap.standout) {
    const s = recap.standout;
    return { set: `${shortName(s.name)} ${s.weight}×${s.reps}`, e1rm: s.e1rm, more };
  }
  const top = recap.lineup[0];
  if (!top) return null;
  const set = top.weight > 0 ? `${top.name} ${top.weight}×${top.reps}` : `${top.name} ×${top.reps}`;
  return { set, e1rm: null, more };
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
  const splitColor = recap.split ? PPL_COLORS[recap.split] : ink.muted;
  const summary = summaryParts(recap);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
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
        <RNView style={[styles.dot, { backgroundColor: splitColor }]} />
        <Text variant="title" tone="primary" weight="semiBold" numberOfLines={1} style={styles.title}>
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
            <AchievementBadge icon={a.icon} emblem={emblemFor(a.id)} rarity={a.rarity} size={20} />
          </TouchableOpacity>
        ))}
        {recap.pr && (
          <Text variant="meta" weight="bold" style={[styles.prTag, { color: trend.up, borderColor: trend.up }]}>
            PR
          </Text>
        )}
        <Ionicons name="chevron-forward" size={14} color={ink.faint} />
      </RNView>

      <Text variant="meta" tone="secondary" numberOfLines={1} style={styles.meta}>
        {formatRelativeDate(recap.workout.createdAt)}
        {recap.split && (
          <>
            {" · "}
            <Text variant="meta" weight="semiBold" style={{ color: splitColor }}>
              {PPL_LABELS[recap.split]}
            </Text>
          </>
        )}
        {` · ${recap.sets} ${recap.sets === 1 ? "set" : "sets"} · ${recap.durationMin}m`}
      </Text>

      {summary && (
        <Text variant="body" numberOfLines={1} style={styles.summary}>
          <Text variant="body" tone="primary" weight="medium">
            {summary.set}
          </Text>
          {summary.e1rm !== null && (
            <Text variant="body" tone="muted">
              {" · "}e1RM {summary.e1rm}
            </Text>
          )}
          {summary.more > 0 && (
            <Text variant="body" tone="muted">
              {" · "}+{summary.more} {summary.more === 1 ? "lift" : "lifts"}
            </Text>
          )}
        </Text>
      )}
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
  session: { paddingVertical: space.lg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { flex: 1, letterSpacing: -0.3 },
  meta: { marginTop: 2 },
  summary: { marginTop: space.sm },
  prTag: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    letterSpacing: 0.3,
    overflow: "hidden",
  },
  viewAll: { paddingVertical: space.lg, alignItems: "center" },
});
