// Muscle Balance card: all-time working sets per muscle group as a radar.

import { Text, useInk } from '@/components/Themed';
import { MuscleBalance } from '@/lib/history/routineProgress';
import { radius, space, tint, trend } from '@/lib/ui/tokens';
import { MuscleGroup } from '@/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

interface MuscleBalanceCardProps {
  muscleBalance: MuscleBalance;
}

// Muscle-balance radar — drawn with SVG so it matches the app's flat style.
const MuscleRadar = ({ axes, values, max }: { axes: { key: MuscleGroup; label: string }[]; values: number[]; max: number }) => {
  const ink = useInk();
  const size = 230;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34; // leave room for labels
  const n = axes.length;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2; // start at top
  const at = (i: number, frac: number) => ({
    x: cx + Math.cos(angleFor(i)) * r * frac,
    y: cy + Math.sin(angleFor(i)) * r * frac,
  });
  const ringFracs = [0.34, 0.67, 1];
  const ringPoly = (frac: number) =>
    axes.map((_, i) => { const p = at(i, frac); return `${p.x},${p.y}`; }).join(' ');
  const dataPoly = values.map((v, i) => { const p = at(i, max > 0 ? v / max : 0); return `${p.x},${p.y}`; }).join(' ');
  const grid = ink.ghost;
  const green = trend.up;

  return (
    <Svg width={size} height={size}>
      {ringFracs.map((f, idx) => (
        <Polygon key={`ring-${idx}`} points={ringPoly(f)} fill="none" stroke={grid} strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const p = at(i, 1);
        return <Line key={`spoke-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={grid} strokeWidth={1} />;
      })}
      <Polygon points={dataPoly} fill={tint(green)} stroke={green} strokeWidth={2} />
      {values.map((v, i) => { const p = at(i, max > 0 ? v / max : 0); return <Circle key={`v-${i}`} cx={p.x} cy={p.y} r={2.5} fill={green} />; })}
      {/* SVG fontSize is chart geometry (sized to the 230pt radar). */}
      {axes.map((a, i) => {
        const lp = at(i, 1);
        const lx = cx + (lp.x - cx) * 1.18;
        const ly = cy + (lp.y - cy) * 1.18;
        return (
          <SvgText
            key={`label-${i}`}
            x={lx}
            y={ly + 3}
            fill={ink.secondary}
            fontSize={11}
            fontWeight="500"
            textAnchor="middle"
          >
            {a.label}
          </SvgText>
        );
      })}
    </Svg>
  );
};

export default function MuscleBalanceCard({ muscleBalance }: MuscleBalanceCardProps) {
  const ink = useInk();

  return (
    <View style={[styles.radarCard, { borderColor: ink.ghost }]}>
      <Text variant="body" tone="primary" weight="semiBold">
        Muscle Balance
      </Text>
      <Text variant="meta" tone="muted" style={styles.radarCaption}>
        Working sets by muscle group · all time
      </Text>
      <View style={styles.radarWrap}>
        <MuscleRadar axes={muscleBalance.axes} values={muscleBalance.values} max={muscleBalance.max} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  radarCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.lg,
  },
  radarCaption: {
    marginTop: space.xs,
  },
  radarWrap: {
    alignItems: 'center',
    marginTop: space.sm,
  },
});
