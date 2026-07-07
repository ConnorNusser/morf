import { useInk } from "@/components/Themed";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

interface DividerProps {
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}

function Divider({ spacing = 0, style }: DividerProps) {
  const ink = useInk();
  return (
    <View
      style={[
        styles.line,
        { backgroundColor: ink.hairline, marginVertical: spacing },
        style,
      ]}
    />
  );
}

export default React.memo(Divider);

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
  },
});
