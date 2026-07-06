import { Text } from "@/components/Themed";
import { space } from "@/lib/ui/tokens";
import React from "react";
import { StyleSheet, StyleProp, TextStyle } from "react-native";

interface SectionLabelProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

/**
 * The uppercase micro-label that introduces a section — one grammar for
 * YOUR LIFTS / RECORDS / the Career card, so every tab starts sections
 * the same way.
 */
function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <Text
      variant="meta"
      tone="muted"
      weight="bold"
      style={[styles.label, style]}
    >
      {children}
    </Text>
  );
}

export default React.memo(SectionLabel);

const styles = StyleSheet.create({
  label: {
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: space.sm,
  },
});
