import { Text, useInk } from "@/components/Themed";
import { useTheme } from "@/contexts/ThemeContext";
import { radius, screenGutter, space } from "@/lib/ui/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { ComponentProps } from "react";
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

interface EmptyStateProps {
  /** Emblem-style illustration (the app's rank-art language) — preferred over `icon`. */
  art?: ImageSourcePropType;
  /** Ionicon fallback for contextual states (e.g. search misses). */
  icon?: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  cta?: {
    label: string;
    onPress: () => void;
    icon?: ComponentProps<typeof Ionicons>["name"];
  };
}

function EmptyState({ art, icon, title, subtitle, cta }: EmptyStateProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <View style={styles.container}>
      {art ? (
        <Image source={art} style={styles.art} resizeMode="contain" />
      ) : (
        icon && <Ionicons name={icon} size={48} color={ink.ghost} />
      )}
      <Text variant="heading" tone="faint" weight="medium" style={styles.title}>
        {title}
      </Text>
      {subtitle && (
        <Text variant="body" tone="ghost" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
      {cta && (
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: currentTheme.colors.primary }]}
          onPress={cta.onPress}
          activeOpacity={0.85}
        >
          {cta.icon && <Ionicons name={cta.icon} size={18} color="#fff" />}
          <Text variant="title" weight="semiBold" style={styles.ctaText}>
            {cta.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default React.memo(EmptyState);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  art: {
    width: 84,
    height: 84,
  },
  title: {
    marginTop: space.lg,
  },
  subtitle: {
    marginTop: space.sm,
    textAlign: "center",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    marginTop: space.section,
  },
  ctaText: {
    color: "#fff",
  },
});
