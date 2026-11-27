// The Swiss progress bar: a 2px hairline track with a solid fill, optionally
// labeled at both ends ("C- 23" … "C 31"). Use instead of rounded pill bars.
import { Text, useInk } from "@/components/Themed";
import { space } from "@/lib/ui/tokens";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

interface Props {
  /** 0..1 */
  progress: number;
  color: string;
  startLabel?: string;
  middleLabel?: string;
  endLabel?: string;
  style?: StyleProp<ViewStyle>;
}

function ProgressHairline({ progress, color, startLabel, middleLabel, endLabel, style }: Props) {
  const ink = useInk();
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const labeled = startLabel != null || middleLabel != null || endLabel != null;
  return (
    <View style={style}>
      <View style={[styles.track, { backgroundColor: ink.hairline }]}>
        <View style={[styles.fill, { width: `${Math.max(pct > 0 ? 1 : 0, pct * 100)}%`, backgroundColor: color }]} />
      </View>
      {labeled ? (
        <View style={styles.labels}>
          <Text variant="meta" tone="faint" style={styles.tabular}>{startLabel ?? ""}</Text>
          {middleLabel != null ? <Text variant="meta" tone="muted">{middleLabel}</Text> : null}
          <Text variant="meta" tone="faint" style={styles.tabular}>{endLabel ?? ""}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default React.memo(ProgressHairline);

const styles = StyleSheet.create({
  track: { height: 2, overflow: "hidden" },
  fill: { height: 2 },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: space.sm },
  tabular: { fontVariant: ["tabular-nums"] },
});
