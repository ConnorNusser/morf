import { LevelPill } from "@/components/gamification/LevelRing";
import TierRing from "@/components/gamification/TierRing";
import { Text, useInk } from "@/components/Themed";
import TierGlass from "@/components/ui/TierGlass";
import UserAvatar from "@/components/ui/UserAvatar";
import { useTheme } from "@/contexts/ThemeContext";
import { StrengthTier } from "@/lib/data/strengthStandards";
import { LevelProgress } from "@/lib/gamification/levelCurve";
import { radius, space, tint, track } from "@/lib/ui/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

// Streak flame: warm orange in every theme (semantic, like trend colors).
const STREAK_FLAME = "#FF8A3D";

type ViewMode = "home" | "feed";

export interface HeaderStats {
  tier?: StrengthTier;
  tierProgress?: number; // 0..1 toward the next tier
}

interface DashboardHeaderProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  stats?: HeaderStats;
  onTierPress?: () => void;
  /** Overrides the default "Morf" wordmark when there's no view selector. */
  title?: string;
  /** Shows an avatar button on the right that opens the viewer's own profile (feed mode). */
  onProfilePress?: () => void;
  profileImageUrl?: string;
  profileUsername?: string;
  /** Account level; renders the XP pill between the view selector and the right items. */
  level?: LevelProgress | null;
  onLevelPress?: () => void;
  /** XP accent for the pill (tier-complementary); defaults to the global accent. */
  levelColor?: string;
  /** Week streak; shows a flame chip on the right (Home, where level lives in the hero card). */
  streakWeeks?: number;
  /** Opens the streak / workout-map sheet. */
  onStreakPress?: () => void;
}

export default function DashboardHeader({
  viewMode,
  onViewModeChange,
  stats,
  onTierPress,
  title,
  onProfilePress,
  profileImageUrl,
  profileUsername,
  level,
  onLevelPress,
  levelColor,
  streakWeeks,
  onStreakPress,
}: DashboardHeaderProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleViewSelect = (mode: ViewMode) => {
    setShowDropdown(false);
    onViewModeChange?.(mode);
  };

  const showViewSelector =
    viewMode !== undefined && onViewModeChange !== undefined;

  return (
    <View style={styles.container}>
      {showViewSelector ? (
        <>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Image
                source={require("@/assets/images/icon-original.png")}
                style={styles.logo}
              />
              <TouchableOpacity
                onPress={() => setShowDropdown(!showDropdown)}
                activeOpacity={0.7}
              >
                <TierGlass style={styles.viewSelector}>
                <Text
                  variant="screenTitle"
                  tone="primary"
                  weight="bold"
                  style={styles.appName}
                >
                  {viewMode === "home" ? "Morf" : "Feed"}
                </Text>
                <Ionicons
                  name={showDropdown ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={currentTheme.colors.text}
                />
                </TierGlass>
              </TouchableOpacity>
            </View>

            {level ? (
              <View style={styles.levelSlot}>
                <LevelPill level={level} onPress={onLevelPress} color={levelColor} />
              </View>
            ) : null}

            {!level && streakWeeks != null ? (
              <TouchableOpacity
                style={styles.streakSlot}
                onPress={onStreakPress}
                disabled={!onStreakPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${streakWeeks} week training streak, open workout map`}
              >
                <TierGlass style={styles.streakChip}>
                  <Ionicons name="flame" size={16} color={streakWeeks > 0 ? STREAK_FLAME : currentTheme.colors.text} />
                  <Text variant="meta" tone="primary" weight="bold">
                    {streakWeeks} wk
                  </Text>
                </TierGlass>
              </TouchableOpacity>
            ) : null}

            {stats?.tier != null && (
              <TouchableOpacity
                style={styles.levelButton}
                onPress={onTierPress}
                activeOpacity={0.7}
                disabled={!onTierPress}
                accessibilityLabel={`${stats.tier} tier, view career`}
              >
                <TierRing
                  tier={stats.tier}
                  progress={stats.tierProgress ?? 0}
                />
              </TouchableOpacity>
            )}

            {onProfilePress && (
              <TouchableOpacity
                style={styles.levelButton}
                onPress={onProfilePress}
                activeOpacity={0.7}
                accessibilityLabel="View your profile"
              >
                <UserAvatar uri={profileImageUrl} username={profileUsername} size={34} />
              </TouchableOpacity>
            )}
          </View>

          {showDropdown && (
            <>
              <TouchableOpacity
                style={styles.backdrop}
                onPress={() => setShowDropdown(false)}
                activeOpacity={1}
              />
              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    viewMode === "home" && {
                      backgroundColor: tint(currentTheme.colors.primary),
                    },
                  ]}
                  onPress={() => handleViewSelect("home")}
                >
                  <Ionicons
                    name="home"
                    size={18}
                    color={
                      viewMode === "home"
                        ? currentTheme.colors.primary
                        : ink.secondary
                    }
                  />
                  <View style={styles.dropdownTextContainer}>
                    <Text
                      variant="body"
                      weight="semiBold"
                      tone={viewMode === "home" ? undefined : "primary"}
                    >
                      Morf
                    </Text>
                    <Text
                      variant="meta"
                      tone="faint"
                      style={styles.dropdownSubtext}
                    >
                      Your stats
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    viewMode === "feed" && {
                      backgroundColor: tint(currentTheme.colors.primary),
                    },
                  ]}
                  onPress={() => handleViewSelect("feed")}
                >
                  <Ionicons
                    name="people"
                    size={18}
                    color={
                      viewMode === "feed"
                        ? currentTheme.colors.primary
                        : ink.secondary
                    }
                  />
                  <View style={styles.dropdownTextContainer}>
                    <Text
                      variant="body"
                      weight="semiBold"
                      tone={viewMode === "feed" ? undefined : "primary"}
                    >
                      Feed
                    </Text>
                    <Text
                      variant="meta"
                      tone="faint"
                      style={styles.dropdownSubtext}
                    >
                      Community workouts
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      ) : (
        <Text
          variant="screenTitle"
          tone="primary"
          weight="bold"
          style={styles.appName}
        >
          {title ?? "Morf"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: space.xs,
    paddingBottom: 0,
    // Optical inset: round logo needs +4 beyond the gutter to align with the square cards.
    paddingHorizontal: space.xs,
    zIndex: 1000,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  // Fills the gap between the selector and the right items; shrinks on SE widths.
  streakSlot: {
    marginLeft: "auto",
  },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.control,
  },
  levelSlot: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    marginLeft: space.md,
  },
  levelButton: {
    flexShrink: 0,
    marginLeft: space.md,
    padding: space.xs,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
  },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  appName: {
    letterSpacing: track.display,
  },
  viewSelector: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    paddingVertical: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.md,
    borderRadius: radius.card,
  },
  backdrop: {
    position: "absolute",
    top: -100,
    left: -100,
    right: -100,
    bottom: -1000,
    zIndex: 999,
  },
  dropdown: {
    position: "absolute",
    top: 56,
    left: 56,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 210,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownSubtext: {
    marginTop: space.xs,
  },
});
