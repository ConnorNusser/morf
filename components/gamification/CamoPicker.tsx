// Career → "Card camo": the on/off switch, then a grid of mini rank-card previews.
// Locked camos still show their finish (something to grind for) under a lock +
// "Lv N"; tapping an unlocked one equips it. When camos are off the grid dims
// but stays browsable, and equipping still works (it applies once switched on).
import CardCamo from '@/components/home/CardCamo';
import SectionLabel from '@/components/ui/SectionLabel';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import useEquippedCamo from '@/hooks/useEquippedCamo';
import { CARD_CAMOS, CardCamo as CardCamoSpec, nextCamoUnlock, resolveEquippedCamo } from '@/lib/gamification/cardCamos';
import { hexAlpha, tierFoil } from '@/lib/ui/tierFoil';
import { radius, space, tint } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Switch, TouchableOpacity, View } from 'react-native';

export default function CamoPicker({ level, percentile }: { level: number; percentile: number }) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { equippedId, enabled, equip, setEnabled } = useEquippedCamo(level);
  // The pick as it would render with camos on (locked/unknown → standard).
  const selected = resolveEquippedCamo(equippedId, level).id;
  const foil = tierFoil(percentile);
  const next = nextCamoUnlock(level);

  return (
    <View style={styles.section}>
      <SectionLabel>Card camo</SectionLabel>
      <View style={styles.toggleRow}>
        <View style={styles.flex}>
          <Text variant="body" weight="semiBold" tone="primary">Show camo on rank card</Text>
          <Text variant="meta" tone="muted">
            {next ? `Next: ${next.name} at Lv ${next.requiredLevel}` : 'Every camo unlocked'}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={v => {
            playHapticFeedback('selection', false);
            setEnabled(v);
          }}
          trackColor={{ true: currentTheme.colors.primary, false: ink.ghost }}
          accessibilityLabel="Show camo on rank card"
        />
      </View>

      <View style={[styles.grid, !enabled && styles.dimmed]}>
        {CARD_CAMOS.map(c => (
          <Swatch
            key={c.id}
            camo={c}
            level={level}
            tierColor={foil.color}
            selected={c.id === selected}
            onPress={() => {
              if (equip(c.id, level)) playHapticFeedback('selection', false);
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Swatch({
  camo,
  level,
  tierColor,
  selected,
  onPress,
}: {
  camo: CardCamoSpec;
  level: number;
  tierColor: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const locked = level < camo.requiredLevel;
  const accent = currentTheme.colors.primary;

  return (
    <TouchableOpacity
      style={styles.swatch}
      onPress={onPress}
      disabled={locked}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: locked }}
      accessibilityLabel={locked ? `${camo.name}, unlocks at level ${camo.requiredLevel}` : camo.name}
    >
      <View
        style={[
          styles.mini,
          { backgroundColor: tint(tierColor), borderColor: selected ? accent : ink.hairline },
          selected && styles.miniSelected,
        ]}
      >
        <LinearGradient colors={[tint(tierColor), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <CardCamo camo={camo} tierColor={tierColor} animate={false} />
        {locked && (
          <View style={[styles.lockVeil, { backgroundColor: hexAlpha(currentTheme.colors.background, 0.7) }]}>
            <Ionicons name="lock-closed" size={16} color={ink.secondary} />
            <Text variant="meta" weight="semiBold" tone="secondary">Lv {camo.requiredLevel}</Text>
          </View>
        )}
        {selected && (
          <View style={[styles.check, { backgroundColor: accent }]}>
            <Ionicons name="checkmark" size={12} color={currentTheme.colors.background} />
          </View>
        )}
      </View>
      <Text variant="meta" weight={selected ? 'semiBold' : 'regular'} tone={locked ? 'muted' : 'primary'} numberOfLines={1}>
        {camo.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.section },
  flex: { flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  dimmed: { opacity: 0.4 },
  swatch: { width: '31%', gap: space.xs },
  // Rank-card proportions (≈ 3:2).
  mini: { aspectRatio: 1.5, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  miniSelected: { borderWidth: 2 },
  lockVeil: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 2 },
  check: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
