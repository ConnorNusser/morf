// Completion-screen row for regions that ranked up this session: a compact body
// graph with those regions lit, plus "Chest B → B+" / "Quads ranked: C" lines.
import BodyGraph from '@/components/gamification/BodyGraph';
import { Text } from '@/components/Themed';
import { getTierColor } from '@/lib/data/strengthStandards';
import { formatTierUp, tierUpGraphStates } from '@/lib/gamification/bodyGraphDisplay';
import { RegionTierUp } from '@/lib/gamification/sessionRewards';
import { space, track } from '@/lib/ui/tokens';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function MuscleTierUpRow({ tierUps }: { tierUps: RegionTierUp[] }) {
  const states = useMemo(() => tierUpGraphStates(tierUps), [tierUps]);
  const highlight = useMemo(() => tierUps.map(t => t.region), [tierUps]);
  if (tierUps.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.delay(320)} style={styles.row}>
      <BodyGraph regions={states} highlight={highlight} compact surface="dark" />
      <View style={styles.text}>
        <Text variant="meta" weight="bold" style={styles.label}>
          {tierUps.length === 1 ? 'MUSCLE TIER-UP' : 'MUSCLE TIER-UPS'}
        </Text>
        {tierUps.map(t => (
          <Text key={t.region} variant="body" weight="semiBold" style={{ color: getTierColor(t.to) }}>
            {formatTierUp(t)}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
}

// White-alpha label matches WorkoutCompleteScreen's always-dark palette (named exception).
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, width: '100%', marginBottom: space.section },
  text: { flex: 1, gap: space.xs },
  label: { color: 'rgba(255,255,255,0.4)', letterSpacing: track.caps },
});
