import { Text } from "@/components/Themed";
import { useTheme } from "@/contexts/ThemeContext";
import { space } from "@/lib/ui/tokens";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

interface SegmentedTabsProps<K extends string> {
  tabs: { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
}

function SegmentedTabs<K extends string>({
  tabs,
  active,
  onChange,
}: SegmentedTabsProps<K>) {
  const { currentTheme } = useTheme();

  return (
    <View style={styles.row}>
      {tabs.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <TouchableOpacity
            key={key}
            hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
            style={[
              styles.tab,
              isActive && { borderBottomColor: currentTheme.colors.primary },
            ]}
            onPress={() => onChange(key)}
          >
            <Text
              variant="body"
              tone={isActive ? "primary" : "faint"}
              weight={isActive ? "semiBold" : "regular"}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default SegmentedTabs;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.section,
  },
  tab: {
    paddingBottom: space.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
});
