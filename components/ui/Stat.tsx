// The one scalar: a value (aligned digits) with an optional muted unit and a
// muted label under it. Left-aligned. Sizes: "sm" (tables, strips), "md"
// (default), "lg" (block heroes). Use inside rows/strips; never re-style numbers inline.
import { Text, TextVariant } from "@/components/Themed";
import { space } from "@/lib/ui/tokens";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

const VALUE: Record<"sm" | "md" | "lg", TextVariant> = { sm: "emphasis", md: "title", lg: "statHero" };

interface Props {
  value: string | number;
  unit?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  /** Accent color for the value (tier color for strength numbers only). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

function Stat({ value, unit, label, size = "md", color, style }: Props) {
  return (
    <View style={style}>
      <Text
        variant={VALUE[size]}
        weight="bold"
        tone={color ? undefined : "primary"}
        style={[styles.value, color ? { color } : null]}
        numberOfLines={1}
      >
        {value}
        {unit ? <Text variant="meta" weight="medium" tone="muted">{` ${unit}`}</Text> : null}
      </Text>
      {label ? (
        <Text variant="meta" tone="muted" numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export default React.memo(Stat);

const styles = StyleSheet.create({
  value: { fontVariant: ["tabular-nums"] },
  label: { marginTop: space.xs / 2 },
});
