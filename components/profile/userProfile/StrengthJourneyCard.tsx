import PercentileSparkline from '@/components/profile/PercentileSparkline';
import { cardStyles } from '@/components/profile/userProfile/cardStyles';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { trend } from '@/lib/ui/tokens';
import { PercentileHistoryEntry } from '@/types';
import React from 'react';

interface StrengthJourneyCardProps {
  sparkHistory: PercentileHistoryEntry[];
  sparkDelta: number;
  sparkSince: string;
  tierColor: string;
}

/** Overall-percentile sparkline with the net change since the first plotted month. */
export default function StrengthJourneyCard({ sparkHistory, sparkDelta, sparkSince, tierColor }: StrengthJourneyCardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <View style={[cardStyles.card, { backgroundColor: currentTheme.colors.surface }]}>
      <View style={cardStyles.cardHeader}>
        <Text variant="body" weight="semiBold" tone="primary">
          Strength Journey
        </Text>
        <Text
          variant="meta"
          weight="semiBold"
          style={{ color: sparkDelta > 0 ? trend.up : sparkDelta < 0 ? trend.down : ink.muted }}
        >
          {sparkDelta >= 0 ? '+' : ''}{sparkDelta} since {sparkSince}
        </Text>
      </View>
      <PercentileSparkline history={sparkHistory} color={tierColor} />
    </View>
  );
}
