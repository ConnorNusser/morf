import { Text } from "@/components/Themed";
import { space, track } from "@/lib/ui/tokens";
import React from "react";
import { StyleSheet, StyleProp, TextStyle } from "react-native";

interface SectionLabelProps {
  children: React.ReactNode;
  /** Swiss section number ("01"); renders faint before the label. */
  index?: number;
  style?: StyleProp<TextStyle>;
}

function SectionLabel({ children, index, style }: SectionLabelProps) {
  return (
    <Text
      variant="meta"
      tone="muted"
      weight="bold"
      style={[styles.label, style]}
    >
      {index != null ? (
        <Text variant="meta" tone="faint" weight="bold" style={styles.index}>
          {String(index).padStart(2, "0")}{"  "}
        </Text>
      ) : null}
      {children}
    </Text>
  );
}

export default React.memo(SectionLabel);

const styles = StyleSheet.create({
  label: {
    letterSpacing: track.caps,
    textTransform: "uppercase",
    marginBottom: space.sm,
  },
  index: {
    fontVariant: ["tabular-nums"],
  },
});
