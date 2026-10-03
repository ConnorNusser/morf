import { Text } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor } from '@/lib/data/strengthStandards';
import { CareerStats } from '@/lib/gamification/careerStats';
import { TierMilestone } from '@/lib/gamification/tierTimeline';
import { formatFullDate as formatDate } from '@/lib/ui/formatters';
import { space } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// ---- Tier-progression timeline ----
export default function TierTimelineView({ timeline, stats }: { timeline: TierMilestone[]; stats: CareerStats }) {
  const { currentTheme } = useTheme();
  if (timeline.length === 0) {
    return (
      <View style={styles.section}>
        <SectionLabel>Progression</SectionLabel>
        <Text variant="meta" tone="muted" style={styles.empty}>
          Log the big lifts (squat, bench, deadlift, press) to chart your tier climb.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <SectionLabel>Progression</SectionLabel>
      <View>
        {stats.firstWorkoutAt && (
          <TimelineRow color={currentTheme.colors.border} title="Started training" date={formatDate(stats.firstWorkoutAt)} faded />
        )}
        {timeline.map(m => (
          <TimelineRow
            key={m.tier}
            color={getTierColor(m.tier)}
            title={`Reached ${m.tier}`}
            date={formatDate(m.date)}
          />
        ))}
      </View>
    </View>
  );
}

function TimelineRow({ color, title, date, faded }: { color: string; title: string; date: string; faded?: boolean }) {
  const { currentTheme } = useTheme();
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineMarker}>
        <View style={[styles.timelineDot, { backgroundColor: color }]} />
        <View style={[styles.timelineLine, { backgroundColor: currentTheme.colors.border }]} />
      </View>
      <View style={styles.timelineContent}>
        <Text variant="body" tone={faded ? 'muted' : 'primary'} weight="semiBold">
          {title}
        </Text>
        <Text variant="meta" tone="muted" style={styles.timelineDate}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.section },
  timelineRow: { flexDirection: 'row' },
  timelineMarker: { alignItems: 'center', width: 24 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  timelineContent: { flex: 1, paddingBottom: space.xl, marginLeft: space.sm },
  timelineDate: { marginTop: space.xs },
  empty: { lineHeight: lineHeightFor(type.meta) },
});
