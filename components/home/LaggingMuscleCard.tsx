// Home nudge for the weakest ranked region when it trails the overall tier:
// "Hamstrings are lagging · C tier · 4 sets/wk" + Train. Renders nothing otherwise.
import Button from '@/components/Button';
import Card from '@/components/Card';
import { Text, useInk } from '@/components/Themed';
import { useBodyGraph } from '@/hooks/useBodyGraph';
import { useTrainRegion } from '@/hooks/useTrainRegion';
import { getTierColor } from '@/lib/data/strengthStandards';
import { laggingLine } from '@/lib/gamification/bodyGraphDisplay';
import { space } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function LaggingMuscleCard() {
  const data = useBodyGraph();
  const trainRegion = useTrainRegion();
  const ink = useInk();
  const lagging = data?.laggingRegion;
  if (!lagging) return null;

  const accent = lagging.tier ? getTierColor(lagging.tier) : ink.muted;
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="trending-down" size={20} color={accent} />
        <Text variant="body" tone="secondary" weight="medium" style={styles.flex} numberOfLines={2}>
          {laggingLine(lagging)}
        </Text>
        <Button title="Train" size="small" variant="secondary" onPress={() => trainRegion(lagging.region)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
});
