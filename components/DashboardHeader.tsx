import TierRing from "@/components/gamification/TierRing";
import { Text, useInk } from "@/components/Themed";
import { useTheme } from "@/contexts/ThemeContext";
import { StrengthTier } from "@/lib/data/strengthStandards";
import { radius, space, tint, track } from "@/lib/ui/tokens";
import { WeightUnit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

type ViewMode = "home" | "feed";

export interface HeaderStats {
  totalVolume: number;
  totalWorkouts: number;
  unit: WeightUnit;
  tier?: StrengthTier; // strength tier (gamification)
  tierProgress?: number; // 0..1 toward the next tier
}

interface DashboardHeaderProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  stats?: HeaderStats;
  onTierPress?: () => void;
  /** Overrides the default "Morf" wordmark when there's no view selector. */
  title?: string;
}

export default function DashboardHeader({
  viewMode,
  onViewModeChange,
  stats,
  onTierPress,
  title,
}: DashboardHeaderProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleViewSelect = (mode: ViewMode) => {
    setShowDropdown(false);
    onViewModeChange?.(mode);
  };

  // If no view mode props, show original Morf text
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
                style={[
                  styles.viewSelector,
                  { backgroundColor: currentTheme.colors.surface },
                ]}
                onPress={() => setShowDropdown(!showDropdown)}
                activeOpacity={0.7}
              >
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
                  size={24}
                  color={currentTheme.colors.text}
                />
              </TouchableOpacity>
            </View>

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
          </View>

          {showDropdown && (
            <>
              {/* Backdrop to close dropdown */}
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
    // Deliberate optical inset: the round logo needs +4 beyond the screen
    // gutter to read as aligned with the square cards below.
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
  appName: {
    letterSpacing: track.display,
  },
  viewSelector: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.sm,
    paddingVertical: space.md,
    paddingLeft: space.xl,
    paddingRight: space.lg,
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
    top: 64,
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
