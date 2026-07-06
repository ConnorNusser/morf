import { Text } from "@/components/Themed";
import { useTheme } from "@/contexts/ThemeContext";
import { radius, space } from "@/lib/ui/tokens";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

export interface StatStripItem {
  value: string | number;
  label: string;
  /** Draw the value in the theme primary instead of text ink. */
  accent?: boolean;
}

interface StatStripProps {
  items: StatStripItem[];
  style?: StyleProp<ViewStyle>;
}

/**
 * A horizontal strip of headline stats on a surface — value over label,
 * separated by hairlines. The shared shape for summary rows like the
 * Exercises overview.
 */
function StatStrip({ items, style }: StatStripProps) {
  const { currentTheme } = useTheme();

  return (
    <View
      style={[
        styles.strip,
        { backgroundColor: currentTheme.colors.surface },
        style,
      ]}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && (
            <View
              style={[
                styles.divider,
                { backgroundColor: currentTheme.colors.border },
              ]}
            />
          )}
          <View style={styles.item}>
            <Text
              variant="emphasis"
              tone={item.accent ? undefined : "primary"}
              weight="bold"
              numberOfLines={1}
            >
              {item.value}
            </Text>
            <Text
              variant="meta"
              tone="faint"
              style={styles.label}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

export default React.memo(StatStrip);

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.card,
    paddingVertical: space.lg,
  },
  item: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: space.xs,
  },
  label: {
    marginTop: space.xs,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: space.xs,
  },
});
