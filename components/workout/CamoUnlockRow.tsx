// Completion-screen row when a session's level-up crossed a camo gate:
// "NEW CAMO UNLOCKED · Gilt Edge" beside a mini card preview of the newest one.
// Self-contained so it can sit under the level-up banner without touching it.
import CardCamo from '@/components/home/CardCamo';
import { Text } from '@/components/Themed';
import { camosUnlockedBetween } from '@/lib/gamification/cardCamos';
import { tierFoil } from '@/lib/ui/tierFoil';
import { radius, space, tint, track } from '@/lib/ui/tokens';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function CamoUnlockRow({
  beforeLevel,
  afterLevel,
  percentile,
}: {
  beforeLevel: number;
  afterLevel: number;
  percentile: number;
}) {
  const unlocked = useMemo(() => camosUnlockedBetween(beforeLevel, afterLevel), [beforeLevel, afterLevel]);
  if (unlocked.length === 0) return null;
  const newest = unlocked[unlocked.length - 1];
  const foil = tierFoil(percentile);

  return (
    <Animated.View entering={FadeIn.delay(280)} style={styles.row}>
      <View style={[styles.mini, { backgroundColor: tint(foil.color) }]}>
        <CardCamo camo={newest} tierColor={foil.color} dark animate={false} />
      </View>
      <View style={styles.text}>
        <Text variant="meta" weight="bold" style={styles.label}>
          {unlocked.length === 1 ? 'NEW CAMO UNLOCKED' : 'NEW CAMOS UNLOCKED'}
        </Text>
        <Text variant="body" weight="semiBold" style={styles.name} numberOfLines={2}>
          {unlocked.map(c => c.name).join(', ')}
        </Text>
        <Text variant="meta" style={styles.hint}>Equip it in Career</Text>
      </View>
    </Animated.View>
  );
}

// White-alpha ink matches WorkoutCompleteScreen's always-dark palette (named exception).
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, width: '100%', marginBottom: space.section },
  mini: {
    width: 72,
    aspectRatio: 1.5,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  text: { flex: 1, gap: 2 },
  label: { color: 'rgba(255,255,255,0.4)', letterSpacing: track.caps },
  name: { color: '#FFFFFF' },
  hint: { color: 'rgba(255,255,255,0.6)' },
});
