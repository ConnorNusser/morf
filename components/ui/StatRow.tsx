// One row of a Swiss table: optional index ("01"), a label, a muted value, and
// an optional trailing mark (a tier letter, in its color). Hairline below.
// Tappable rows get a faint chevron. Stack rows directly — no card behind.
import { Text, useInk } from "@/components/Themed";
import { space } from "@/lib/ui/tokens";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";

interface Props {
  label: string;
  value?: string;
  /** Trailing mark, e.g. a tier letter. */
  mark?: string;
  markColor?: string;
  index?: number;
  onPress?: () => void;
  /** Rule above too (first row of a table that isn't under a SectionLabel rule). */
  ruleAbove?: boolean;
  style?: StyleProp<ViewStyle>;
}

function StatRow({ label, value, mark, markColor, index, onPress, ruleAbove, style }: Props) {
  const ink = useInk();
  const body = (
    <>
      {index != null ? (
        <Text variant="meta" tone="faint" style={styles.index}>{String(index).padStart(2, "0")}</Text>
      ) : null}
      <Text variant="body" tone="primary" style={styles.label} numberOfLines={1}>{label}</Text>
      {value != null ? <Text variant="meta" tone="muted" style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {mark != null ? (
        <Text variant="emphasis" weight="bold" style={[styles.mark, { color: markColor ?? ink.secondary }]}>{mark}</Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={14} color={ink.faint} /> : null}
    </>
  );
  const rowStyle = [
    styles.row,
    { borderBottomColor: ink.hairline },
    ruleAbove && { borderTopColor: ink.hairline, borderTopWidth: StyleSheet.hairlineWidth },
    style,
  ];
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label} style={rowStyle}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={rowStyle}>{body}</View>;
}

export default React.memo(StatRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  index: { width: 22, fontVariant: ["tabular-nums"] },
  label: { flex: 1 },
  value: { fontVariant: ["tabular-nums"], textAlign: "right" },
  mark: { minWidth: 36, textAlign: "right" },
});
