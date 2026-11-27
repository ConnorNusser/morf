// Overall strength, shown the same way everywhere (Home, Profile, Career): the
// History tab's OverallStatsCard — one component, one look.
import OverallStatsCard from '@/components/OverallStatsCard';
import { getStrengthTier } from '@/lib/data/strengthStandards';
import React from 'react';

interface Props {
  percentile: number; // 0 = unranked
  /** Kept for API compatibility with earlier headline designs; ignored. */
  letterSize?: number;
}

export default function StrengthHeadline({ percentile }: Props) {
  return (
    <OverallStatsCard
      stats={{
        overallPercentile: percentile,
        strengthLevel: percentile > 0 ? getStrengthTier(percentile) : 'E-',
        improvementTrend: 'improving',
      }}
    />
  );
}
