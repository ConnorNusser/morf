import { useInk } from "@/components/Themed";
import Stat from "@/components/ui/Stat";
import { space } from "@/lib/ui/tokens";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

export interface StatStripItem {
  value: string | number;
  label: string;
  accent?: boolean;
}

interface StatStripProps {
  items: StatStripItem[];
  style?: StyleProp<ViewStyle>;
}

// Swiss: flat, ruled above and below, values left-aligned in equal columns
// split by hairlines. Numbers are tabular so columns line up across rows.
function StatStrip({ items, style }: StatStripProps) {
  const ink = useInk();

  return (
    <View style={[styles.strip, { borderColor: ink.hairline }, style]}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: ink.hairline }]} />}
          <Stat value={item.value} label={item.label} size="sm" style={styles.item} />
        </React.Fragment>
      ))}
    </View>
  );
}

export default React.memo(StatStrip);

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    paddingHorizontal: space.md,
  },
  value: {
    fontVariant: ["tabular-nums"],
  },
  label: {
    marginTop: 2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
  },
});
