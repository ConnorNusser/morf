// Detail for one body-graph region: tier, the fastest route to the next tier,
// weekly volume vs. the 10–20 set band, recency, the lifts feeding the tier,
// and a "Train this" hand-off to AI generation.
import Button from '@/components/Button';
import TierBadge from '@/components/TierBadge';
import { Text, useInk } from '@/components/Themed';
import BottomSheet from '@/components/ui/BottomSheet';
import Divider from '@/components/ui/Divider';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { regionMeta } from '@/lib/data/bodyRegions';
import { RegionState } from '@/lib/gamification/bodyGraph';
import {
  formatE1rm,
  formatNextTierLine,
  formatSetsPerWeek,
  ordinal,
  SETS_TARGET,
  setsBar,
} from '@/lib/gamification/bodyGraphDisplay';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { WeightUnit } from '@/types';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

interface Props {
  region: RegionState | null;
  unit: WeightUnit;
  onClose: () => void;
  onTrain: (region: RegionState) => void;
}

function exerciseName(id: string): string {
  return getExercise(id)?.name ?? id;
}

export default function MuscleDetailSheet({ region, unit, onClose, onTrain }: Props) {
  return (
    <BottomSheet visible={!!region} onClose={onClose} maxHeightRatio={0.8}>
      {region && <SheetBody state={region} unit={unit} onTrain={() => onTrain(region)} />}
    </BottomSheet>
  );
}

function SheetBody({ state, unit, onTrain }: { state: RegionState; unit: WeightUnit; onTrain: () => void }) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const label = regionMeta(state.region).label;
  const bar = setsBar(state.setsPerWeek);
  const barColor = bar.status === 'below' ? ink.muted : currentTheme.colors.primary;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text variant="heading" tone="primary" weight="bold" style={styles.flex}>
          {label}
        </Text>
        {state.tier && <TierBadge tier={state.tier} size="small" showTooltip={false} />}
      </View>
      <Text variant="meta" tone="muted">
        {state.percentile !== null ? `${ordinal(state.percentile)} percentile` : 'Unranked · volume only'}
      </Text>

      {state.next && (
        <View style={[styles.nextCard, { backgroundColor: tint(currentTheme.colors.primary) }]}>
          <SectionLabel style={styles.tightLabel}>Next tier</SectionLabel>
          <Text variant="body" tone="primary" weight="semiBold">
            {formatNextTierLine(state.next, exerciseName(state.next.exerciseId), unit)}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <SectionLabel style={styles.tightLabel}>Sets / week</SectionLabel>
          <Text variant="meta" tone="secondary">
            {formatSetsPerWeek(state.setsPerWeek)} · target {SETS_TARGET.min}–{SETS_TARGET.max}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: ink.hairline }]}>
          <View
            style={[
              styles.band,
              {
                left: `${bar.bandStart * 100}%`,
                width: `${(bar.bandEnd - bar.bandStart) * 100}%`,
                backgroundColor: ink.ghost,
              },
            ]}
          />
          <View style={[styles.fill, { width: `${bar.fill * 100}%`, backgroundColor: barColor }]} />
        </View>
      </View>

      <View style={[styles.section, styles.rowBetween]}>
        <Text variant="meta" tone="muted">Last trained</Text>
        <Text variant="meta" tone="secondary" weight="medium">
          {state.lastTrained ? formatRelativeDate(state.lastTrained) : 'Not yet'}
        </Text>
      </View>

      {state.lifts.length > 0 && (
        <View style={styles.section}>
          <SectionLabel>Lifts feeding this tier</SectionLabel>
          {state.lifts.map((lift, i) => (
            <View key={lift.exerciseId}>
              {i > 0 && <Divider />}
              <View style={styles.liftRow}>
                <View style={styles.flex}>
                  <Text variant="body" tone="primary" numberOfLines={1}>
                    {exerciseName(lift.exerciseId)}
                  </Text>
                  <Text variant="meta" tone="muted">
                    {formatE1rm(lift.bestE1rmLbs, unit)} e1RM · {ordinal(lift.percentile)} pct
                  </Text>
                </View>
                <TierBadge tier={lift.tier} size="tiny" variant="outline" showTooltip={false} />
              </View>
            </View>
          ))}
        </View>
      )}

      <Button title="Train this" icon="sparkles" onPress={onTrain} style={styles.cta} />
    </ScrollView>
  );
}

const BAR_HEIGHT = 8;

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter, paddingTop: space.sm, paddingBottom: space.lg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nextCard: { marginTop: space.lg, padding: space.md, borderRadius: radius.card },
  tightLabel: { marginBottom: space.xs },
  section: { marginTop: space.section },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: BAR_HEIGHT, borderRadius: radius.pill, overflow: 'hidden', marginTop: space.sm },
  band: { position: 'absolute', top: 0, bottom: 0 },
  fill: { height: BAR_HEIGHT, borderRadius: radius.pill },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  cta: { marginTop: space.section },
});
