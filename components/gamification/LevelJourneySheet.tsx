// The level journey: the whole letter-rank ladder (E- → S+) as one Swiss
// timeline. Ranks you've passed are filled, your current rank is the large
// badge with XP to the next rung, future ranks are faint with the level they
// start at. Opened from the level pill in the Home header.
import HexTierBadge from '@/components/gamification/HexTierBadge';
import { Text, useInk } from '@/components/Themed';
import BottomSheet from '@/components/ui/BottomSheet';
import ProgressHairline from '@/components/ui/ProgressHairline';
import SectionLabel from '@/components/ui/SectionLabel';
import { StrengthTier } from '@/lib/data/strengthStandards';
import { LevelProgress, totalXpForLevel } from '@/lib/gamification/levelCurve';
import { formatXp } from '@/lib/gamification/levelDisplay';
import { nextRank, RANKS, rankForLevel, rankGradientForLevel, TIERS } from '@/lib/gamification/ranks';
import { screenGutter, space } from '@/lib/ui/tokens';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  level: LevelProgress | null;
}

export default function LevelJourneySheet({ visible, onClose, level }: Props) {
  const ink = useInk();
  if (!level) return null;
  const current = rankForLevel(level.level);
  const next = nextRank(level.level);
  // Progress through the current rank (by XP), for the hairline.
  const rankStartXp = totalXpForLevel(current.minLevel);
  const rankEndXp = next ? totalXpForLevel(next.minLevel) : rankStartXp + 1;
  const rankProgress = next ? (level.totalXp - rankStartXp) / Math.max(1, rankEndXp - rankStartXp) : 1;
  const xpToNextRank = next ? Math.max(0, rankEndXp - level.totalXp) : 0;
  const [soft] = rankGradientForLevel(level.level, level.progress);

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.85}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionLabel>Level journey</SectionLabel>

        <View style={styles.hero}>
          <HexTierBadge tier={current.name as StrengthTier} size={88} />
          <View style={styles.heroText}>
            <Text variant="heading" weight="bold" tone="primary">Rank {current.name}</Text>
            <Text variant="body" tone="secondary" style={styles.tabular}>Level {level.level}</Text>
            <Text variant="meta" tone="muted" style={styles.tabular}>
              {next ? `${formatXp(xpToNextRank)} XP to ${next.name} (Lv ${next.minLevel})` : 'Top rank'}
            </Text>
          </View>
        </View>
        <ProgressHairline
          progress={rankProgress}
          color={soft}
          startLabel={`${current.name} · Lv ${current.minLevel}`}
          endLabel={next ? `${next.name} · Lv ${next.minLevel}` : ''}
          style={styles.bar}
        />

        {/* One row per letter tier; its three steps are the chips on the right. */}
        <View style={[styles.ladder, { borderTopColor: ink.hairline }]}>
          {[...TIERS].reverse().map(t => {
            const steps = RANKS.filter(r => r.tier === t.id);
            const reachedTier = level.level >= t.minLevel;
            return (
              <View key={t.id} style={[styles.row, { borderBottomColor: ink.hairline }]}>
                <View style={[styles.rowBadge, !reachedTier && styles.dim]}>
                  <HexTierBadge tier={t.id as StrengthTier} size={36} />
                </View>
                <Text variant="meta" tone={reachedTier ? 'secondary' : 'faint'} style={[styles.range, styles.tabular]}>
                  Lv {t.minLevel}{TIERS[t.index + 1] ? `–${TIERS[t.index + 1].minLevel - 1}` : '+'}
                </Text>
                <View style={styles.steps}>
                  {steps.map(r => {
                    const isCurrent = r.index === current.index;
                    const reached = r.index <= current.index;
                    return (
                      <View
                        key={r.id}
                        style={[
                          styles.step,
                          { borderColor: reached ? r.colorSoft : ink.ghost },
                          reached && { backgroundColor: isCurrent ? r.colorSoft : 'transparent' },
                        ]}
                      >
                        <Text
                          variant="meta"
                          weight={isCurrent ? 'bold' : 'semiBold'}
                          tone={isCurrent ? undefined : reached ? 'secondary' : 'faint'}
                          style={isCurrent ? { color: '#0B0F0D' } : undefined}
                        >
                          {r.name}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
        <Text variant="meta" tone="muted" style={styles.note}>
          Level comes from training (XP). Strength tier comes from your lifts. Both use the same E → S grades.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter, paddingBottom: space.section },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  heroText: { flex: 1, gap: 2 },
  bar: { marginTop: space.lg },
  ladder: { marginTop: space.section, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  rowBadge: { width: 36 },
  dim: { opacity: 0.4 },
  range: { width: 64 },
  steps: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs },
  step: { minWidth: 44, paddingVertical: 4, paddingHorizontal: space.sm, borderRadius: 999, borderWidth: 1, alignItems: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  note: { marginTop: space.lg },
});
