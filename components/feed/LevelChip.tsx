import { Text, useInk } from '@/components/Themed';
import { radius, space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Quiet "Lv N" tag for a feed author's synced level. Neutral on purpose: the XP
 * lime (#b6f03c) washes out on the light themes, and the header already carries
 * the tier color on the name and percentile. Renders nothing when unknown.
 */
function LevelChip({ level }: { level?: number }) {
  const ink = useInk();
  if (level == null || level < 1) return null;
  return (
    <View style={[styles.chip, { backgroundColor: ink.hairline }]}>
      <Text variant="meta" tone="secondary" weight="semiBold">
        Lv {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space.xs,
    borderRadius: radius.badge,
  },
});

export default React.memo(LevelChip);
