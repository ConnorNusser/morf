import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { getWorkoutById } from '@/lib/workout/workouts';
import { storageService } from '@/lib/storage/storage';
import {
  Achievement,
  AchievementCategory,
  achievementDisplay,
  rarityBreakdown,
  summarizeAchievements,
  unlockedIds,
} from '@/lib/gamification/achievements';
import { CareerData, loadCareerData } from '@/lib/gamification/careerData';
import { CareerStats, formatCompact, volumeComparison } from '@/lib/gamification/careerStats';
import { MuscleMastery } from '@/lib/gamification/muscleMastery';
import { getProfileIcons, iconUnlockContext } from '@/lib/gamification/profileIcons';
import { LiftPR } from '@/lib/gamification/personalRecords';
import { getTierBandProgress, TierMilestone, TierRung } from '@/lib/gamification/tierTimeline';
import { HeatCell, HEAT_OPACITIES, heatLevel, TrainingHeatmap } from '@/lib/gamification/trainingHeatmap';
import { RARITY_META } from '@/lib/gamification/rarity';
import { captureAndShare } from '@/lib/ui/shareUtils';
import AchievementBadge from '@/components/gamification/AchievementBadge';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function cleanExerciseName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Stable empty set so a dismissed celebration doesn't allocate on every render.
const EMPTY_NEW_IDS: Set<string> = new Set();

export default function CareerModal({ visible, onClose }: Props) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<CareerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedNew, setDismissedNew] = useState(false);
  const shareRef = useRef<ViewShot>(null);

  // The "new" highlights to show this view — cleared instantly when the user
  // dismisses the celebration (already persisted as seen on open).
  const newIds = data && !dismissedNew ? data.newIds : EMPTY_NEW_IDS;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const career = await loadCareerData();
      setData(career);
      // Acknowledge unlocks now that the user is viewing them, so the "new"
      // highlights clear next time.
      await storageService.setSeenAchievements(unlockedIds(career.achievements));
    } catch (err) {
      console.error('CareerModal: failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setDismissedNew(false);
      load();
    }
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>Career</Text>
          <View style={styles.headerActions}>
            {data && (
              <TouchableOpacity onPress={() => captureAndShare(shareRef as React.RefObject<ViewShot>)} hitSlop={12}>
                <Ionicons name="share-outline" size={24} color={currentTheme.colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={26} color={currentTheme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {loading || !data ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={currentTheme.colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {newIds.size > 0 && (
              <UnlockCelebration
                items={data.achievements.filter(a => newIds.has(a.id))}
                onDismiss={() => setDismissedNew(true)}
              />
            )}
            <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
              <View style={[styles.shareCard, { backgroundColor: currentTheme.colors.background }]}>
                <TierHero overall={data.overall} tier={data.tier} />
                <ShareStatStrip stats={data.stats} />
              </View>
            </ViewShot>
            <NextGoal achievements={data.achievements} />
            {/* Lifetime overview */}
            <StatGrid stats={data.stats} />
            <ConsistencyView heatmap={data.heatmap} unit={data.stats.unit} />
            {/* Strength */}
            <BestsView stats={data.stats} />
            <PersonalRecordsView prs={data.prs} />
            <MuscleMasteryView mastery={data.muscleMastery} />
            {/* Tier progression */}
            <TierLadderView ladder={data.ladder} />
            <TierTimelineView timeline={data.timeline} stats={data.stats} />
            <AchievementGridView achievements={data.achievements} newIds={newIds} />
            <EmblemsView
              achievements={data.achievements}
              equippedId={data.profileIconId}
              onEquip={async id => { await storageService.setProfileIconId(id); load(); }}
            />
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ---- Hero: current tier + overall percentile + progress to next ----
function TierHero({ overall, tier }: { overall: number; tier: StrengthTier }) {
  const { currentTheme } = useTheme();
  const color = getTierColor(tier);
  const band = getTierBandProgress(overall);

  return (
    <View style={styles.hero}>
      <Text style={[styles.heroTier, { color }]}>{tier}</Text>
      <Text style={[styles.heroPercentile, { color: currentTheme.colors.text }]}>
        {overall}
        <Text style={[styles.heroPercentileLabel, { color: currentTheme.colors.text }]}> percentile</Text>
      </Text>
      {overall > 0 && (
        <Text style={[styles.heroRank, { color: currentTheme.colors.text }]}>
          Stronger than {overall}% of lifters
        </Text>
      )}
      {band.nextTier ? (
        <View style={styles.heroProgressWrap}>
          <View style={[styles.heroTrack, { backgroundColor: currentTheme.colors.border }]}>
            <View style={[styles.heroFill, { backgroundColor: color, width: `${Math.round(band.progress * 100)}%` }]} />
          </View>
          <Text style={[styles.heroNext, { color: currentTheme.colors.text }]}>
            {band.toNext} to {band.nextTier}
          </Text>
        </View>
      ) : (
        <Text style={[styles.heroNext, { color: currentTheme.colors.text }]}>Max tier reached</Text>
      )}
    </View>
  );
}

// ---- Celebration shown at the top when achievements were just earned ----
function UnlockCelebration({ items, onDismiss }: { items: Achievement[]; onDismiss: () => void }) {
  const { currentTheme } = useTheme();
  const accent = currentTheme.colors.primary;
  const title =
    items.length === 1 ? 'Achievement unlocked' : `${items.length} achievements unlocked`;
  // Cap the rows so a first-time user with many unlocked doesn't get a wall.
  const shown = items.slice(0, 4);
  const overflow = items.length - shown.length;
  return (
    <View style={[styles.celebrate, { backgroundColor: accent + '14', borderColor: accent }]}>
      <View style={styles.celebrateHeader}>
        <Text style={[styles.celebrateTitle, { color: accent }]}>{title}</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={18} color={accent} />
        </TouchableOpacity>
      </View>
      {shown.map(a => (
        <View key={a.id} style={styles.celebrateRow}>
          <AchievementBadge icon={a.icon} rarity={a.rarity} size={38} />
          <View style={styles.celebrateText}>
            <Text style={[styles.celebrateName, { color: currentTheme.colors.text }]}>{a.title}</Text>
            <Text style={[styles.celebrateDesc, { color: currentTheme.colors.text }]}>{a.description}</Text>
          </View>
        </View>
      ))}
      {overflow > 0 && (
        <Text style={[styles.celebrateDesc, { color: currentTheme.colors.text, marginLeft: 42 }]}>
          + {overflow} more
        </Text>
      )}
    </View>
  );
}

// ---- Compact stat strip shown inside the shareable card ----
function ShareStatStrip({ stats }: { stats: CareerStats }) {
  const { currentTheme } = useTheme();
  const items = [
    { v: `${formatCompact(stats.totalVolume)} ${stats.unit}`, l: 'lifted' },
    { v: formatCompact(stats.totalWorkouts), l: 'workouts' },
    { v: `${stats.longestStreak}d`, l: 'best streak' },
  ];
  return (
    <View style={styles.shareStrip}>
      {items.map((it, i) => (
        <View key={i} style={styles.shareStat}>
          <Text style={[styles.shareStatValue, { color: currentTheme.colors.text }]}>{it.v}</Text>
          <Text style={[styles.shareStatLabel, { color: currentTheme.colors.text }]}>{it.l}</Text>
        </View>
      ))}
    </View>
  );
}

// ---- Next goal: the closest locked achievement, to chase ----
function NextGoal({ achievements }: { achievements: Achievement[] }) {
  const { currentTheme } = useTheme();
  const { nextUp } = summarizeAchievements(achievements);
  if (!nextUp) return null;
  const accent = currentTheme.colors.primary;
  return (
    <View style={[styles.nextGoal, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
      <View style={[styles.nextIcon, { backgroundColor: accent + '1A' }]}>
        <Ionicons name={nextUp.icon as keyof typeof Ionicons.glyphMap} size={20} color={accent} />
      </View>
      <View style={styles.nextBody}>
        <Text style={[styles.nextLabel, { color: currentTheme.colors.text }]}>NEXT GOAL</Text>
        <Text style={[styles.nextTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
          {nextUp.title}
        </Text>
        <View style={[styles.nextTrack, { backgroundColor: currentTheme.colors.border }]}>
          <View style={[styles.nextFill, { backgroundColor: accent, width: `${Math.round(nextUp.progress * 100)}%` }]} />
        </View>
      </View>
      <Text style={[styles.nextCount, { color: currentTheme.colors.text }]}>
        {formatCompact(nextUp.current)}/{formatCompact(nextUp.target)}
      </Text>
    </View>
  );
}

// ---- Lifetime stat grid ----
function StatGrid({ stats }: { stats: CareerStats }) {
  const { currentTheme } = useTheme();
  const comparison = volumeComparison(stats.totalVolume, stats.unit);
  const tiles: { label: string; value: string }[] = [
    { label: 'Total lifted', value: `${formatCompact(stats.totalVolume)} ${stats.unit}` },
    { label: 'Workouts', value: formatCompact(stats.totalWorkouts) },
    { label: 'Days active', value: formatCompact(stats.daysActive) },
    { label: 'Longest streak', value: `${stats.longestStreak}d` },
    { label: 'Total sets', value: formatCompact(stats.totalSets) },
    { label: 'Total reps', value: formatCompact(stats.totalReps) },
  ];
  return (
    <View style={styles.section}>
      <SectionLabel>Lifetime</SectionLabel>
      <View style={styles.grid}>
        {tiles.map(t => (
          <StatTile key={t.label} label={t.label} value={t.value} />
        ))}
      </View>
      {comparison && <Text style={[styles.comparison, { color: currentTheme.colors.text }]}>{comparison}</Text>}
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { currentTheme } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
      <Text style={[styles.tileValue, { color: currentTheme.colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.tileLabel, { color: currentTheme.colors.text }]}>{label}</Text>
    </View>
  );
}

// ---- Fun all-time bests ----
function BestsView({ stats }: { stats: CareerStats }) {
  const { currentTheme } = useTheme();
  if (!stats.heaviestSet && stats.biggestSessionVolume === 0) return null;
  const hs = stats.heaviestSet;
  const heaviestName = hs ? cleanExerciseName(getWorkoutById(hs.exerciseId)?.name ?? 'Lift') : '';
  return (
    <View style={styles.section}>
      <SectionLabel>All-time bests</SectionLabel>
      <View style={styles.bestsRow}>
        {hs && (
          <View style={[styles.bestTile, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
            <Text style={[styles.bestValue, { color: currentTheme.colors.text }]}>
              {hs.weight} {stats.unit} × {hs.reps}
            </Text>
            <Text style={[styles.bestLabel, { color: currentTheme.colors.text }]} numberOfLines={1}>
              Heaviest set · {heaviestName}
            </Text>
          </View>
        )}
        {stats.biggestSessionVolume > 0 && (
          <View style={[styles.bestTile, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
            <Text style={[styles.bestValue, { color: currentTheme.colors.text }]}>
              {formatCompact(stats.biggestSessionVolume)} {stats.unit}
            </Text>
            <Text style={[styles.bestLabel, { color: currentTheme.colors.text }]}>Biggest session</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ---- Personal records: best estimated 1RM per main lift ----
function PersonalRecordsView({ prs }: { prs: LiftPR[] }) {
  const { currentTheme } = useTheme();
  if (prs.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionLabel>Personal records</SectionLabel>
      <View style={[styles.prCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
        {prs.map((pr, i) => (
          <View
            key={pr.exerciseId}
            style={[
              styles.prRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: currentTheme.colors.border },
            ]}
          >
            <View style={styles.prLeft}>
              <Text style={[styles.prName, { color: currentTheme.colors.text }]} numberOfLines={1}>
                {pr.name}
              </Text>
              <Text style={[styles.prSub, { color: currentTheme.colors.text }]}>
                {pr.topWeight} {pr.unit} × {pr.topReps} · {formatDate(pr.date)}
              </Text>
            </View>
            <View style={styles.prRight}>
              <Text style={[styles.prValue, { color: currentTheme.colors.text }]}>
                {pr.estimatedOneRM} {pr.unit}
              </Text>
              <Text style={[styles.prValueLabel, { color: currentTheme.colors.text }]}>est. 1RM</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---- Consistency heatmap: last 12 weeks of training days ----
function ConsistencyView({ heatmap, unit }: { heatmap: TrainingHeatmap; unit: string }) {
  const { currentTheme } = useTheme();
  const accent = currentTheme.colors.primary;
  // Tap a day to reveal its date + volume (the "hover" readout).
  const [selected, setSelected] = useState<HeatCell | null>(null);

  // The actual span shown, so the timeframe is explicit (not just "12 wks").
  const cells = heatmap.weeks.flat();
  const first = cells[0]?.date;
  const lastReal = [...cells].reverse().find(c => !c.future)?.date ?? first;
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const range = first && lastReal ? `${fmt(first)} – ${fmt(lastReal)}` : '';

  // A month abbreviation above the first week that lands in a new month.
  const monthLabels = heatmap.weeks.map((week, w) => {
    const m = week[0].date.getMonth();
    const prev = w > 0 ? heatmap.weeks[w - 1][0].date.getMonth() : -1;
    return m !== prev ? week[0].date.toLocaleDateString('en-US', { month: 'short' }) : '';
  });

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <SectionLabel>Activity</SectionLabel>
        <Text style={[styles.achCount, { color: currentTheme.colors.text }]}>{range}</Text>
      </View>
      {selected ? (
        <Text style={[styles.heatCaption, { color: accent }]}>
          {selected.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
          {formatCompact(selected.volume)} {unit} lifted
        </Text>
      ) : (
        <Text style={[styles.heatCaption, { color: currentTheme.colors.text }]}>
          {heatmap.totalDays} active days in the last 12 weeks — tap a day for its volume.
        </Text>
      )}
      <View style={styles.heatGrid}>
        {heatmap.weeks.map((week, w) => (
          <View key={w} style={styles.heatCol}>
            {monthLabels[w] ? (
              <Text style={[styles.monthLabel, { color: currentTheme.colors.text }]}>{monthLabels[w]}</Text>
            ) : null}
            {week.map((cell, d) => {
              const isSel = selected?.date.getTime() === cell.date.getTime();
              const cellStyle = [
                styles.heatCell,
                cell.future
                  ? { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: currentTheme.colors.border }
                  : cell.trained
                    ? { backgroundColor: accent, opacity: HEAT_OPACITIES[heatLevel(cell.intensity)] }
                    : { backgroundColor: currentTheme.colors.border, opacity: 0.5 },
                isSel ? { opacity: 1, borderWidth: 1.5, borderColor: currentTheme.colors.text } : null,
              ];
              return cell.trained && !cell.future ? (
                <TouchableOpacity key={d} activeOpacity={0.7} style={cellStyle} onPress={() => setSelected(isSel ? null : cell)} />
              ) : (
                <View key={d} style={cellStyle} />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.heatLegend}>
        <View style={[styles.heatLegendCell, { backgroundColor: currentTheme.colors.border, opacity: 0.5 }]} />
        <Text style={[styles.heatLegendText, { color: currentTheme.colors.text }]}>Rest</Text>
        <View style={styles.heatLegendSpacer} />
        <Text style={[styles.heatLegendText, { color: currentTheme.colors.text }]}>Less</Text>
        {HEAT_OPACITIES.map(o => (
          <View key={o} style={[styles.heatLegendCell, { backgroundColor: accent, opacity: o }]} />
        ))}
        <Text style={[styles.heatLegendText, { color: currentTheme.colors.text }]}>More</Text>
      </View>
    </View>
  );
}

// ---- Muscle-group mastery: per-group tier with a percentile bar ----
function MuscleMasteryView({ mastery }: { mastery: MuscleMastery[] }) {
  const { currentTheme } = useTheme();
  if (mastery.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionLabel>Muscle mastery</SectionLabel>
      <View style={[styles.muscleCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
        {mastery.map(m => {
          const color = getTierColor(m.tier);
          return (
            <View key={m.group} style={styles.muscleRow}>
              <Text style={[styles.muscleName, { color: currentTheme.colors.text }]}>
                {m.group.charAt(0).toUpperCase() + m.group.slice(1)}
              </Text>
              <View style={[styles.muscleTrack, { backgroundColor: currentTheme.colors.border }]}>
                <View style={[styles.muscleFill, { backgroundColor: color, width: `${Math.max(3, m.percentile)}%` }]} />
              </View>
              <View style={[styles.muscleTier, { borderColor: color }]}>
                <Text style={[styles.muscleTierText, { color }]}>{m.tier}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---- Tier ladder: every tier, reached ones filled, current marked ----
const TIER_BASES: { base: string; count: number }[] = [
  { base: 'E', count: 3 },
  { base: 'D', count: 3 },
  { base: 'C', count: 3 },
  { base: 'B', count: 3 },
  { base: 'A', count: 3 },
  { base: 'S', count: 4 },
];

function TierLadderView({ ladder }: { ladder: TierRung[] }) {
  const { currentTheme } = useTheme();
  const currentBase = ladder.find(r => r.current)?.tier[0] ?? '';
  return (
    <View style={styles.section}>
      <SectionLabel>Tier ladder</SectionLabel>
      <View style={styles.ladderRow}>
        {ladder.map(rung => (
          <View
            key={rung.tier}
            style={[
              styles.ladderCell,
              {
                backgroundColor: rung.reached ? getTierColor(rung.tier) : currentTheme.colors.border,
                opacity: rung.reached ? 1 : 0.3,
                borderWidth: rung.current ? 2 : 0,
                borderColor: currentTheme.colors.text,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.ladderLabels}>
        {TIER_BASES.map(({ base, count }) => (
          <Text
            key={base}
            style={[
              styles.ladderBaseLabel,
              { flex: count, color: currentTheme.colors.text, opacity: base === currentBase ? 1 : 0.35, fontWeight: base === currentBase ? '800' : '500' },
            ]}
          >
            {base}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ---- Tier-progression timeline ----
function TierTimelineView({ timeline, stats }: { timeline: TierMilestone[]; stats: CareerStats }) {
  const { currentTheme } = useTheme();
  if (timeline.length === 0) {
    return (
      <View style={styles.section}>
        <SectionLabel>Progression</SectionLabel>
        <Text style={[styles.empty, { color: currentTheme.colors.text }]}>
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
        <Text style={[styles.timelineTitle, { color: currentTheme.colors.text, opacity: faded ? 0.6 : 1 }]}>
          {title}
        </Text>
        <Text style={[styles.timelineDate, { color: currentTheme.colors.text }]}>{date}</Text>
      </View>
    </View>
  );
}

// ---- Achievement grid ----
const ACH_FILTERS: { key: 'all' | AchievementCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'special', label: 'Special' },
  { key: 'strength', label: 'Strength' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'volume', label: 'Volume' },
  { key: 'milestone', label: 'Milestones' },
];

function AchievementGridView({ achievements, newIds }: { achievements: Achievement[]; newIds: Set<string> }) {
  const { currentTheme } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AchievementCategory>('all');
  const filtered = achievements.filter(a => filter === 'all' || a.category === filter);
  const unlocked = filtered.filter(a => a.unlocked).length;
  const breakdown = rarityBreakdown(achievements);
  // New first, then unlocked, then locked sorted by closest progress.
  const ordered = [...filtered].sort((a, b) => {
    const an = newIds.has(a.id) ? 1 : 0;
    const bn = newIds.has(b.id) ? 1 : 0;
    if (an !== bn) return bn - an;
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return b.progress - a.progress;
  });
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <SectionLabel>Achievements</SectionLabel>
        <Text style={[styles.achCount, { color: currentTheme.colors.text }]}>
          {unlocked}/{filtered.length}
        </Text>
      </View>
      <View style={styles.rarityRow}>
        {breakdown.map(b => {
          const rc = RARITY_META[b.rarity].accent;
          const complete = b.total > 0 && b.unlocked === b.total;
          return (
            <View key={b.rarity} style={[styles.rarityChip, { backgroundColor: rc + '14', borderColor: complete ? rc : rc + '33' }]}>
              <Text style={[styles.rarityCellLabel, { color: rc }]}>{RARITY_META[b.rarity].label}</Text>
              <Text style={[styles.rarityCellCount, { color: currentTheme.colors.text }]}>
                {b.unlocked}/{b.total}
              </Text>
            </View>
          );
        })}
      </View>
      {newIds.size > 0 && (
        <Text style={[styles.achNewBanner, { color: currentTheme.colors.primary }]}>
          {newIds.size} newly unlocked
        </Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achTabs}>
        {ACH_FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.achTab,
                active
                  ? { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.primary }
                  : { backgroundColor: 'transparent', borderColor: currentTheme.colors.border },
              ]}
            >
              <Text
                style={[styles.achTabText, { color: active ? currentTheme.colors.surface : currentTheme.colors.text }]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.grid}>
        {ordered.map(a => (
          <AchievementTile
            key={a.id}
            achievement={a}
            isNew={newIds.has(a.id)}
            selected={selectedId === a.id}
            onPress={() => setSelectedId(id => (id === a.id ? null : a.id))}
          />
        ))}
      </View>
    </View>
  );
}

function AchievementTile({
  achievement,
  isNew,
  selected,
  onPress,
}: {
  achievement: Achievement;
  isNew: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { currentTheme } = useTheme();
  // Rarity is the one organizing color — the tile frame, wash and progress all
  // match the badge so the grid reads as a coherent rarity-coded collection
  // instead of a clash of primary borders over differently-coloured badges.
  const r = RARITY_META[achievement.rarity].accent;
  const display = achievementDisplay(achievement);
  // Secret badges never reveal title/progress until earned. Otherwise, tapping
  // swaps the (truncated) description for exact progress detail.
  const detail = display.masked
    ? display.description
    : selected
      ? achievement.unlocked
        ? 'Unlocked'
        : `${formatCompact(achievement.current)} / ${formatCompact(achievement.target)}`
      : achievement.description;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.achTile,
        achievement.unlocked
          ? { backgroundColor: r + '0D', borderColor: isNew ? r : r + '40', borderWidth: isNew ? 2 : 1 }
          : { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border, borderWidth: 1 },
      ]}
    >
      <View style={styles.achTileTop}>
        <AchievementBadge
          icon={display.icon}
          rarity={achievement.rarity}
          unlocked={achievement.unlocked}
          isNew={isNew}
          size={40}
        />
        {isNew ? (
          <View style={[styles.achNewPill, { backgroundColor: r }]}>
            <Text style={[styles.achNewPillText, { color: currentTheme.colors.surface }]}>NEW</Text>
          </View>
        ) : (
          <Text
            style={[
              styles.achRarity,
              { color: display.masked ? currentTheme.colors.text + '55' : RARITY_META[achievement.rarity].accent },
            ]}
          >
            {display.masked ? 'Secret' : RARITY_META[achievement.rarity].label}
          </Text>
        )}
      </View>
      <Text
        style={[styles.achTitle, { color: currentTheme.colors.text, opacity: achievement.unlocked ? 1 : 0.55 }]}
        numberOfLines={1}
      >
        {display.title}
      </Text>
      <Text
        style={[styles.achDesc, { color: selected ? r : currentTheme.colors.text, opacity: selected ? 1 : 0.5 }]}
        numberOfLines={1}
      >
        {detail}
      </Text>
      {!achievement.unlocked && !display.masked && (
        <View style={[styles.achTrack, { backgroundColor: currentTheme.colors.border }]}>
          <View style={[styles.achFill, { backgroundColor: r, width: `${Math.round(achievement.progress * 100)}%` }]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---- Emblems: the custom-icon collectible gallery; tap an unlocked one to equip ----
function EmblemsView({
  achievements,
  equippedId,
  onEquip,
}: {
  achievements: Achievement[];
  equippedId: string;
  onEquip: (id: string) => void;
}) {
  const { currentTheme } = useTheme();
  const accent = currentTheme.colors.primary;
  const icons = getProfileIcons(iconUnlockContext(achievements));
  const unlocked = icons.filter(i => i.unlocked).length;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <SectionLabel>Emblems</SectionLabel>
        <Text style={[styles.achCount, { color: currentTheme.colors.text }]}>{unlocked}/{icons.length}</Text>
      </View>
      <View style={styles.emblemGrid}>
        {icons.map(ic => {
          const equipped = ic.id === equippedId;
          return (
            <TouchableOpacity
              key={ic.id}
              style={styles.emblemCell}
              activeOpacity={0.7}
              disabled={!ic.unlocked || equipped}
              onPress={() => onEquip(ic.id)}
            >
              <View
                style={[
                  styles.emblemDisc,
                  {
                    backgroundColor: equipped ? accent : ic.unlocked ? accent + '1A' : currentTheme.colors.surface,
                    borderColor: ic.unlocked ? accent : currentTheme.colors.border,
                    borderWidth: equipped ? 2 : 1.5,
                    opacity: ic.unlocked ? 1 : 0.55,
                  },
                ]}
              >
                <Ionicons
                  name={ic.icon as keyof typeof Ionicons.glyphMap}
                  size={24}
                  color={equipped ? currentTheme.colors.surface : ic.unlocked ? accent : currentTheme.colors.text + '55'}
                />
                {!ic.unlocked && (
                  <View style={[styles.emblemLock, { backgroundColor: currentTheme.colors.background }]}>
                    <Ionicons name="lock-closed" size={9} color={currentTheme.colors.text} />
                  </View>
                )}
              </View>
              <Text
                style={[styles.emblemLabel, { color: equipped ? accent : currentTheme.colors.text, opacity: equipped ? 1 : 0.6 }]}
                numberOfLines={2}
              >
                {equipped ? 'Equipped' : ic.unlocked ? ic.label : ic.hint}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { currentTheme } = useTheme();
  return <Text style={[styles.sectionLabel, { color: currentTheme.colors.text }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  celebrate: { borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 4, marginBottom: 4, gap: 10 },
  celebrateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  celebrateTitle: { fontSize: 15, fontWeight: '700' },
  celebrateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  celebrateText: { flex: 1 },
  celebrateName: { fontSize: 14, fontWeight: '700' },
  celebrateDesc: { fontSize: 12, opacity: 0.55 },

  shareCard: { borderRadius: 16, paddingBottom: 18 },
  shareStrip: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  shareStat: { alignItems: 'center' },
  shareStatValue: { fontSize: 16, fontWeight: '700' },
  shareStatLabel: { fontSize: 11, opacity: 0.5, marginTop: 2 },

  hero: { alignItems: 'center', paddingVertical: 24 },
  heroTier: { fontSize: 72, fontWeight: '800', lineHeight: 78 },
  heroPercentile: { fontSize: 20, fontWeight: '600', marginTop: 4 },
  heroPercentileLabel: { fontSize: 14, fontWeight: '400', opacity: 0.5 },
  heroRank: { fontSize: 13, opacity: 0.55, marginTop: 4 },
  heroProgressWrap: { width: '70%', marginTop: 16, alignItems: 'center' },
  heroTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: 3 },
  heroNext: { fontSize: 13, opacity: 0.6, marginTop: 8 },

  nextGoal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  nextIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nextBody: { flex: 1 },
  nextLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },
  nextTitle: { fontSize: 15, fontWeight: '600', marginTop: 1, marginBottom: 6 },
  nextTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  nextFill: { height: 5, borderRadius: 3 },
  nextCount: { fontSize: 13, fontWeight: '700', opacity: 0.6 },

  section: { marginTop: 28 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, opacity: 0.45, textTransform: 'uppercase', marginBottom: 12 },

  emblemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  emblemCell: { width: '21%', alignItems: 'center', gap: 5 },
  emblemDisc: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  emblemLock: { position: 'absolute', bottom: -2, right: -2, width: 17, height: 17, borderRadius: 8.5, alignItems: 'center', justifyContent: 'center' },
  emblemLabel: { fontSize: 10, opacity: 0.6, textAlign: 'center', lineHeight: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: '31.5%', borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' },
  tileValue: { fontSize: 18, fontWeight: '700' },
  tileLabel: { fontSize: 11, opacity: 0.5, marginTop: 4, textAlign: 'center' },
  comparison: { fontSize: 13, opacity: 0.45, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },

  bestsRow: { flexDirection: 'row', gap: 10 },
  bestTile: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14 },
  bestValue: { fontSize: 18, fontWeight: '700' },
  bestLabel: { fontSize: 11, opacity: 0.5, marginTop: 4 },

  prCard: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  prLeft: { flex: 1, marginRight: 12 },
  prName: { fontSize: 15, fontWeight: '600' },
  prSub: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  prRight: { alignItems: 'flex-end' },
  prValue: { fontSize: 17, fontWeight: '700' },
  prValueLabel: { fontSize: 10, opacity: 0.45, marginTop: 1 },

  heatCaption: { fontSize: 11, opacity: 0.5, lineHeight: 16, marginTop: -4, marginBottom: 12 },
  heatGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16 },
  heatCol: { gap: 4, position: 'relative' },
  monthLabel: { position: 'absolute', top: -14, left: 0, fontSize: 9, opacity: 0.5, width: 40 },
  heatCell: { width: 15, height: 15, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 4, marginTop: 12 },
  heatLegendText: { fontSize: 10, opacity: 0.4 },
  heatLegendCell: { width: 11, height: 11, borderRadius: 2 },
  heatLegendSpacer: { flex: 1 },

  muscleCard: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  muscleName: { fontSize: 13, fontWeight: '600', width: 78 },
  muscleTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  muscleFill: { height: 7, borderRadius: 4 },
  muscleTier: { minWidth: 34, alignItems: 'center', borderWidth: 1.5, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1 },
  muscleTierText: { fontSize: 11, fontWeight: '800' },

  ladderRow: { flexDirection: 'row', gap: 2 },
  ladderCell: { flex: 1, height: 26, borderRadius: 3 },
  ladderLabels: { flexDirection: 'row', marginTop: 6 },
  ladderBaseLabel: { fontSize: 11, textAlign: 'center' },

  timelineRow: { flexDirection: 'row' },
  timelineMarker: { alignItems: 'center', width: 24 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  timelineContent: { flex: 1, paddingBottom: 18, marginLeft: 8 },
  timelineTitle: { fontSize: 15, fontWeight: '600' },
  timelineDate: { fontSize: 13, opacity: 0.5, marginTop: 1 },

  achCount: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  rarityRow: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 14 },
  rarityChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 3 },
  rarityCellLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  rarityCellCount: { fontSize: 13, fontWeight: '700' },
  achNewBanner: { fontSize: 14, fontWeight: '700', marginBottom: 12, marginTop: -4 },
  achTabs: { gap: 8, paddingBottom: 12 },
  achTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  achTabText: { fontSize: 12, fontWeight: '600' },
  achTile: { width: '48%', borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  achTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achRarity: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  achNewPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  achNewPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  achTitle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  achDesc: { fontSize: 11, opacity: 0.5 },
  achTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  achFill: { height: 4, borderRadius: 2 },

  empty: { fontSize: 14, opacity: 0.5, lineHeight: 20 },
});
