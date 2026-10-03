import { Text } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS, PPL_LABELS, PPLCategory } from '@/lib/data/pplCategories';
import { formatCompact } from '@/lib/gamification/careerStats';
import { heatmapMonthLabels, heatmapRangeLabel } from '@/lib/gamification/careerView';
import { HeatCell, HEAT_OPACITIES, heatLevel, TrainingHeatmap } from '@/lib/gamification/trainingHeatmap';
import { space } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

// ---- Consistency heatmap: last 12 weeks of training days ----
export default function ConsistencyView({ heatmap, unit }: { heatmap: TrainingHeatmap; unit: string }) {
  const { currentTheme } = useTheme();
  // Tap a day to reveal its date + volume (the "hover" readout).
  const [selected, setSelected] = useState<HeatCell | null>(null);

  const range = heatmapRangeLabel(heatmap);
  const monthLabels = heatmapMonthLabels(heatmap);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <SectionLabel>Activity</SectionLabel>
        <Text variant="meta" tone="muted" weight="semiBold">{range}</Text>
      </View>
      {selected ? (
        <Text
          variant="meta"
          style={[styles.heatCaption, { color: selected.split ? PPL_COLORS[selected.split] : currentTheme.colors.primary }]}
        >
          {selected.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
          {selected.split ? PPL_LABELS[selected.split] : 'Mixed'} · {formatCompact(selected.volume)} {unit} lifted
        </Text>
      ) : (
        <Text variant="meta" tone="muted" style={styles.heatCaption}>
          {heatmap.totalDays} active days in the last 12 weeks — tap a day for its volume.
        </Text>
      )}
      <View style={styles.heatGrid}>
        {heatmap.weeks.map((week, w) => (
          <View key={w} style={styles.heatCol}>
            {monthLabels[w] ? (
              <Text variant="meta" tone="muted" style={styles.monthLabel}>{monthLabels[w]}</Text>
            ) : null}
            {week.map((cell, d) => {
              const isSel = selected?.date.getTime() === cell.date.getTime();
              const cellStyle = [
                styles.heatCell,
                cell.future
                  ? { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: currentTheme.colors.border }
                  : cell.trained
                    ? { backgroundColor: cell.split ? PPL_COLORS[cell.split] : currentTheme.colors.primary, opacity: HEAT_OPACITIES[heatLevel(cell.intensity)] }
                    : { backgroundColor: currentTheme.colors.surface },
                isSel ? { opacity: 1, borderWidth: 1.5, borderColor: currentTheme.colors.text } : null,
              ];
              return cell.trained && !cell.future ? (
                <TouchableOpacity key={d} activeOpacity={0.7} style={cellStyle} onPress={() => setSelected(isSel ? null : cell)} />
              ) : (
                <View key={d} style={cellStyle} />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.heatLegend}>
        {(['push', 'pull', 'legs'] as PPLCategory[]).map(s => (
          <View key={s} style={styles.heatLegendKey}>
            <View style={[styles.heatLegendCell, { backgroundColor: PPL_COLORS[s] }]} />
            <Text variant="meta" tone="faint">{PPL_LABELS[s]}</Text>
          </View>
        ))}
        <View style={styles.heatLegendSpacer} />
        <Text variant="meta" tone="faint">Less</Text>
        {HEAT_OPACITIES.map(o => (
          <View key={o} style={[styles.heatLegendCell, { backgroundColor: currentTheme.colors.text, opacity: o }]} />
        ))}
        <Text variant="meta" tone="faint">More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.section },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heatCaption: { lineHeight: lineHeightFor(type.meta), marginTop: -4, marginBottom: space.md },
  heatGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: space.xl },
  heatCol: { gap: space.xs, position: 'relative' },
  // Floats the month abbreviation above its column; offset clears the meta
  // line height so it doesn't overlap the first cell row.
  monthLabel: { position: 'absolute', top: -18, left: 0, width: 40 },
  heatCell: { width: 15, height: 15, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: space.xs, marginTop: space.md, flexWrap: 'wrap' },
  heatLegendKey: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginRight: space.xs },
  heatLegendCell: { width: 11, height: 11, borderRadius: 2 },
  heatLegendSpacer: { flex: 1 },
});
