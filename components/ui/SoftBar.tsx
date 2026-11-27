// The one "big" progress bar: 6px, fully rounded, soft track, solid or
// gradient fill. Use for goal/rank/band progress in heroes and blocks.
// Inline/secondary progress uses ProgressHairline (2px). Nothing else.
import { useInk } from "@/components/Themed";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

interface Props {
  /** 0..1 */
  progress: number;
  /** Fill color; pass `[deep, light]` for a gradient fill. */
  color: string | [string, string];
  /** Projected extra (e.g. next workout's XP), drawn translucent after the fill. */
  ghost?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

function SoftBar({ progress, color, ghost = 0, height = 6, style }: Props) {
  const ink = useInk();
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const g = Math.max(0, Math.min(1 - p, ghost));
  const fillW = `${p > 0 ? Math.max(3, p * 100) : 0}%` as const;
  const solid = typeof color === "string" ? color : color[1];
  return (
    <View style={[styles.track, { height, borderRadius: height, backgroundColor: ink.ghost }, style]}>
      {typeof color === "string" ? (
        <View style={[styles.fill, { width: fillW, borderRadius: height, backgroundColor: color }]} />
      ) : (
        <LinearGradient
          colors={color}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.fill, { width: fillW, borderRadius: height }]}
        />
      )}
      {g > 0 ? (
        <View style={[styles.ghost, { left: `${p * 100}%`, width: `${g * 100}%`, backgroundColor: solid + "55" }]} />
      ) : null}
    </View>
  );
}

export default React.memo(SoftBar);

const styles = StyleSheet.create({
  track: { overflow: "hidden", position: "relative" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  ghost: { position: "absolute", top: 0, bottom: 0 },
});
