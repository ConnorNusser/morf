import Chip from '@/components/Chip';
import IconButton from '@/components/IconButton';
import SectionLabel from '@/components/ui/SectionLabel';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatFullDate as formatDate } from '@/lib/ui/formatters';
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
import { LiftPR } from '@/lib/gamification/personalRecords';
import { getTierBandProgress, TierMilestone, TierRung } from '@/lib/gamification/tierTimeline';
import { HeatCell, HEAT_OPACITIES, heatLevel, TrainingHeatmap } from '@/lib/gamification/trainingHeatmap';
import { PPL_COLORS, PPL_LABELS, PPLCategory } from '@/lib/data/pplCategories';
import { Rarity, RARITY_META } from '@/lib/gamification/rarity';
import { panelPad, radius, screenGutter, space, tint, track, withAlpha } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { captureAndShare } from '@/lib/ui/shareUtils';
import AchievementBadge from '@/components/gamification/AchievementBadge';
import AchievementModal, { AchievementModalItem } from '@/components/gamification/AchievementModal';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import FlipCard from '@/components/gamification/FlipCard';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function cleanExerciseName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
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
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <Text variant="screenTitle" tone="primary" weight="bold">Career</Text>
          <View style={styles.headerActions}>
            {data && (
              <IconButton
                icon="share-outline"
                onPress={() => captureAndShare(shareRef as React.RefObject<ViewShot>)}
              />
            )}
            <IconButton icon="close" onPress={onClose} />
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
            <View style={styles.bottomSpacer} />
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
      <Text variant="title" tone="primary" weight="semiBold" style={styles.heroPercentile}>
        {overall}
        <Text variant="meta" tone="muted" weight="regular"> percentile</Text>
      </Text>
      {overall > 0 && (
        <Text variant="meta" tone="muted" style={styles.heroRank}>
          Stronger than {overall}% of lifters
        </Text>
      )}
      {band.nextTier ? (
        <View style={styles.heroProgressWrap}>
          <View style={[styles.heroTrack, { backgroundColor: currentTheme.colors.border }]}>
            <View style={[styles.heroFill, { backgroundColor: color, width: `${Math.round(band.progress * 100)}%` }]} />
          </View>
          <Text variant="meta" tone="muted" style={styles.heroNext}>
            {band.toNext} to {band.nextTier}
          </Text>
        </View>
      ) : (
        <Text variant="meta" tone="muted" style={styles.heroNext}>Max tier reached</Text>
      )}
    </View>
  );
}

// ---- Celebration shown at the top when achievements were just earned ----
function UnlockCelebration({ items, onDismiss }: { items: Achievement[]; onDismiss: () => void }) {
  const { currentTheme } = useTheme();
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);
  const accent = currentTheme.colors.primary;
  const title =
    items.length === 1 ? 'Achievement unlocked' : `${items.length} achievements unlocked`;
  // Cap the rows so a first-time user with many unlocked doesn't get a wall.
  const shown = items.slice(0, 4);
  const overflow = items.length - shown.length;
  return (
    <View style={[styles.celebrate, { backgroundColor: tint(accent), borderColor: accent }]}>
      <View style={styles.celebrateHeader}>
        <Text variant="body" weight="bold" style={{ color: accent }}>{title}</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={18} color={accent} />
        </TouchableOpacity>
      </View>
      {shown.map(a => (
        <TouchableOpacity
          key={a.id}
          style={styles.celebrateRow}
          activeOpacity={0.7}
          onPress={() => setSpotlight(toSpotlight(a))}
          accessibilityRole="button"
          accessibilityLabel={a.title}
        >
          <AchievementBadge icon={a.icon} emblem={emblemFor(a.id)} rarity={a.rarity} size={38} />
          <View style={styles.celebrateText}>
            <Text variant="meta" tone="primary" weight="bold">{a.title}</Text>
            <Text variant="meta" tone="muted">{a.description}</Text>
          </View>
        </TouchableOpacity>
      ))}
      {overflow > 0 && (
        <Text variant="meta" tone="muted" style={styles.celebrateOverflow}>
          + {overflow} more
        </Text>
      )}

      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} featurable />
    </View>
  );
}

// ---- Compact stat strip shown inside the shareable card ----
function ShareStatStrip({ stats }: { stats: CareerStats }) {
  const items = [
    { v: `${formatCompact(stats.totalVolume)} ${stats.unit}`, l: 'lifted' },
    { v: formatCompact(stats.totalWorkouts), l: 'workouts' },
    { v: `${stats.longestStreak}w`, l: 'best streak' },
  ];
  return (
    <View style={styles.shareStrip}>
      {items.map((it, i) => (
        <View key={i} style={styles.shareStat}>
          <Text variant="body" tone="primary" weight="bold">{it.v}</Text>
          <Text variant="meta" tone="muted" style={styles.shareStatLabel}>{it.l}</Text>
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
  const frame = { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border };
  const nextEmblem = emblemFor(nextUp.id);
  return (
    <FlipCard
      height={84}
      style={styles.nextWrap}
      front={
        <View style={[styles.nextFaceFrame, frame]}>
          <View style={[styles.nextIcon, { backgroundColor: tint(accent) }]}>
            {nextEmblem ? (
              <Image source={nextEmblem} style={styles.nextEmblem} resizeMode="contain" />
            ) : (
              <Ionicons name={nextUp.icon as keyof typeof Ionicons.glyphMap} size={20} color={accent} />
            )}
          </View>
          <View style={styles.nextBody}>
            <Text variant="meta" tone="faint" weight="bold" style={styles.nextLabel}>NEXT GOAL</Text>
            <Text variant="body" tone="primary" weight="semiBold" style={styles.nextTitle} numberOfLines={1}>
              {nextUp.title}
            </Text>
            <View style={[styles.nextTrack, { backgroundColor: currentTheme.colors.border }]}>
              <View style={[styles.nextFill, { backgroundColor: accent, width: `${Math.round(nextUp.progress * 100)}%` }]} />
            </View>
          </View>
          <Text variant="meta" tone="muted" weight="bold">
            {formatCompact(nextUp.current)}/{formatCompact(nextUp.target)}
          </Text>
        </View>
      }
      back={
        <View style={[styles.nextFaceFrame, frame]}>
          <View style={[styles.nextIcon, { backgroundColor: tint(accent) }]}>
            <Ionicons name="information-circle-outline" size={20} color={accent} />
          </View>
          <View style={styles.nextBody}>
            <Text variant="meta" tone="faint" weight="bold" style={styles.nextLabel}>WHAT IT TAKES</Text>
            <Text variant="meta" tone="muted" style={styles.nextBackDesc} numberOfLines={2}>
              {nextUp.description}
            </Text>
          </View>
          <Text variant="meta" weight="bold" style={{ color: withAlpha(accent, 'secondary') }}>
            {Math.round(nextUp.progress * 100)}%
          </Text>
        </View>
      }
    />
  );
}

// ---- Lifetime stat grid ----
function StatGrid({ stats }: { stats: CareerStats }) {
  const comparison = volumeComparison(stats.totalVolume, stats.unit);
  const tiles: { label: string; value: string }[] = [
    { label: 'Total lifted', value: `${formatCompact(stats.totalVolume)} ${stats.unit}` },
    { label: 'Workouts', value: formatCompact(stats.totalWorkouts) },
    { label: 'Days active', value: formatCompact(stats.daysActive) },
    { label: 'Longest streak', value: `${stats.longestStreak}w` },
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
      {comparison && (
        <Text variant="meta" tone="faint" style={styles.comparison}>{comparison}</Text>
      )}
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { currentTheme } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
      <Text variant="emphasis" tone="primary" weight="bold" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="meta" tone="muted" style={styles.tileLabel}>{label}</Text>
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
            <Text variant="emphasis" tone="primary" weight="bold">
              {hs.weight} {stats.unit} × {hs.reps}
            </Text>
            <Text variant="meta" tone="muted" style={styles.bestLabel} numberOfLines={1}>
              Heaviest set · {heaviestName}
            </Text>
          </View>
        )}
        {stats.biggestSessionVolume > 0 && (
          <View style={[styles.bestTile, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
            <Text variant="emphasis" tone="primary" weight="bold">
              {formatCompact(stats.biggestSessionVolume)} {stats.unit}
            </Text>
            <Text variant="meta" tone="muted" style={styles.bestLabel}>Biggest session</Text>
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
              <Text variant="body" tone="primary" weight="semiBold" numberOfLines={1}>
                {pr.name}
              </Text>
              <Text variant="meta" tone="muted" style={styles.prSub}>
                {pr.topWeight} {pr.unit} × {pr.topReps} · {formatDate(pr.date)}
              </Text>
            </View>
            <View style={styles.prRight}>
              <Text variant="emphasis" tone="primary" weight="bold">
                {pr.estimatedOneRM} {pr.unit}
              </Text>
              <Text variant="meta" tone="faint" style={styles.prValueLabel}>est. 1RM</Text>
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
        <Text variant="meta" tone="muted" weight="semiBold">{range}</Text>
      </View>
      {selected ? (
        <Text
          variant="meta"
          style={[styles.heatCaption, { color: selected.split ? PPL_COLORS[selected.split] : currentTheme.colors.primary }]}
        >
          {selected.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
          {selected.split ? PPL_LABELS[selected.split] : 'Mixed'} · {formatCompact(selected.volume)} {unit} lifted
        </Text>
      ) : (
        <Text variant="meta" tone="muted" style={styles.heatCaption}>
          {heatmap.totalDays} active days in the last 12 weeks — tap a day for its volume.
        </Text>
      )}
      <View style={styles.heatGrid}>
        {heatmap.weeks.map((week, w) => (
          <View key={w} style={styles.heatCol}>
            {monthLabels[w] ? (
              <Text variant="meta" tone="muted" style={styles.monthLabel}>{monthLabels[w]}</Text>
            ) : null}
            {week.map((cell, d) => {
              const isSel = selected?.date.getTime() === cell.date.getTime();
              const cellStyle = [
                styles.heatCell,
                cell.future
                  ? { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: currentTheme.colors.border }
                  : cell.trained
                    ? { backgroundColor: cell.split ? PPL_COLORS[cell.split] : currentTheme.colors.primary, opacity: HEAT_OPACITIES[heatLevel(cell.intensity)] }
                    : { backgroundColor: currentTheme.colors.surface },
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
        {(['push', 'pull', 'legs'] as PPLCategory[]).map(s => (
          <View key={s} style={styles.heatLegendKey}>
            <View style={[styles.heatLegendCell, { backgroundColor: PPL_COLORS[s] }]} />
            <Text variant="meta" tone="faint">{PPL_LABELS[s]}</Text>
          </View>
        ))}
        <View style={styles.heatLegendSpacer} />
        <Text variant="meta" tone="faint">Less</Text>
        {HEAT_OPACITIES.map(o => (
          <View key={o} style={[styles.heatLegendCell, { backgroundColor: currentTheme.colors.text, opacity: o }]} />
        ))}
        <Text variant="meta" tone="faint">More</Text>
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
              <Text variant="meta" tone="primary" weight="semiBold" style={styles.muscleName}>
                {m.group.charAt(0).toUpperCase() + m.group.slice(1)}
              </Text>
              <View style={[styles.muscleTrack, { backgroundColor: currentTheme.colors.border }]}>
                <View style={[styles.muscleFill, { backgroundColor: color, width: `${Math.max(3, m.percentile)}%` }]} />
              </View>
              <View style={[styles.muscleTier, { borderColor: color }]}>
                <Text variant="meta" weight="bold" style={{ color }}>{m.tier}</Text>
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
            variant="meta"
            tone={base === currentBase ? 'primary' : 'faint'}
            weight={base === currentBase ? 'bold' : 'medium'}
            style={[styles.ladderBaseLabel, { flex: count }]}
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

// ---- Achievement grid ----
const ACH_FILTERS: { key: 'all' | AchievementCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'special', label: 'Special' },
  { key: 'strength', label: 'Strength' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'volume', label: 'Volume' },
  { key: 'milestone', label: 'Milestones' },
];

// A locked achievement counts as "in progress" once it's at least started, and
// "almost there" once it crosses this bar — which gets a visible highlight.
const ALMOST_THRESHOLD = 0.6;

// One achievement mapped to the full-screen spotlight — the same modal the
// History sessions feed opens, so badges behave identically everywhere.
function toSpotlight(a: Achievement): AchievementModalItem {
  const display = achievementDisplay(a);
  const pct = Math.round(a.progress * 100);
  return {
    id: a.id,
    title: display.title,
    description: display.description,
    icon: display.icon,
    rarity: a.rarity,
    unlocked: a.unlocked,
    masked: display.masked,
    progressLabel:
      a.unlocked || display.masked
        ? undefined
        : `${formatCompact(a.current)} / ${formatCompact(a.target)} · ${pct}%`,
  };
}

function AchievementGridView({ achievements, newIds }: { achievements: Achievement[]; newIds: Set<string> }) {
  const [filter, setFilter] = useState<'all' | AchievementCategory>('all');
  const [rarityFilter, setRarityFilter] = useState<Rarity | null>(null);
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);
  // Category narrows first; the rarity (tier) chips narrow within it.
  const byCategory = achievements.filter(a => filter === 'all' || a.category === filter);
  const breakdown = rarityBreakdown(byCategory);
  const filtered = byCategory.filter(a => rarityFilter === null || a.rarity === rarityFilter);
  const unlocked = filtered.filter(a => a.unlocked).length;

  // Group by status so "done", "close", and "not started" read at a glance,
  // instead of one flat grid where completion is hard to spot.
  const completed = filtered
    .filter(a => a.unlocked)
    .sort((a, b) => {
      const an = newIds.has(a.id) ? 1 : 0;
      const bn = newIds.has(b.id) ? 1 : 0;
      return bn - an; // newly unlocked first
    });
  const inProgress = filtered
    .filter(a => !a.unlocked && !a.hidden && a.progress > 0)
    .sort((a, b) => b.progress - a.progress); // closest first
  const locked = filtered.filter(a => !a.unlocked && (a.hidden || a.progress <= 0));

  const groups: { key: string; label: string; items: Achievement[] }[] = [
    { key: 'progress', label: 'In progress', items: inProgress },
    { key: 'done', label: 'Completed', items: completed },
    { key: 'locked', label: 'Locked', items: locked },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <SectionLabel>Achievements</SectionLabel>
        <Text variant="meta" tone="muted" weight="semiBold">
          {unlocked}/{filtered.length}
        </Text>
      </View>
      <View style={styles.rarityRow}>
        {breakdown.map(b => {
          const rc = RARITY_META[b.rarity].accent;
          const complete = b.total > 0 && b.unlocked === b.total;
          const active = rarityFilter === b.rarity;
          return (
            <TouchableOpacity
              key={b.rarity}
              activeOpacity={0.7}
              onPress={() => setRarityFilter(prev => (prev === b.rarity ? null : b.rarity))}
              style={[
                styles.rarityChip,
                {
                  backgroundColor: tint(rc),
                  borderColor: active || complete ? rc : withAlpha(rc, 'ghost'),
                  borderWidth: active ? 1.5 : 1,
                },
              ]}
            >
              <Text variant="meta" weight="semiBold" style={{ color: rc }}>
                {RARITY_META[b.rarity].label}
              </Text>
              <Text variant="meta" tone="primary" weight="bold">
                {b.unlocked}/{b.total}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text variant="meta" tone="faint" style={styles.achHint}>
        Tap a tier to filter · tap a badge for details
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achTabs}>
        {ACH_FILTERS.map(f => (
          <Chip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ScrollView>
      {groups.map(g =>
        g.items.length === 0 ? null : (
          <View key={g.key} style={styles.achGroup}>
            <View style={styles.achGroupHead}>
              <SectionLabel>{g.label}</SectionLabel>
              <Text variant="meta" tone="faint" weight="bold">{g.items.length}</Text>
            </View>
            <View style={styles.grid}>
              {g.items.map(a => (
                <AchievementTile
                  key={a.id}
                  achievement={a}
                  isNew={newIds.has(a.id)}
                  onPress={() => setSpotlight(toSpotlight(a))}
                />
              ))}
            </View>
          </View>
        ),
      )}

      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} featurable />
    </View>
  );
}

const ACH_TILE_HEIGHT = 150;

function AchievementTile({ achievement, isNew, onPress }: { achievement: Achievement; isNew: boolean; onPress: () => void }) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  // Rarity is the one organizing color — the tile frame, wash and progress all
  // match the badge so the grid reads as a coherent rarity-coded collection.
  const r = RARITY_META[achievement.rarity].accent;
  const display = achievementDisplay(achievement);
  const pct = Math.round(achievement.progress * 100);
  const almost = !achievement.unlocked && !display.masked && achievement.progress >= ALMOST_THRESHOLD;

  const frameStyle = achievement.unlocked
    ? { backgroundColor: withAlpha(r, 'hairline'), borderColor: isNew ? r : withAlpha(r, 'faint'), borderWidth: isNew ? 2 : 1 }
    : almost
      ? { backgroundColor: withAlpha(r, 'hairline'), borderColor: withAlpha(r, 'muted'), borderWidth: 1 }
      : { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border, borderWidth: 1 };

  // The tile face: badge, title, and an unmistakable status (check / % / lock).
  const front = (
    <View style={[styles.achFace, styles.achTile, frameStyle]}>
      <View style={styles.achTileTop}>
        <AchievementBadge
          icon={display.icon}
          emblem={emblemFor(achievement.id)}
          rarity={achievement.rarity}
          unlocked={achievement.unlocked}
          isNew={isNew}
          size={40}
        />
        {achievement.unlocked ? (
          <View style={[styles.achCheck, { backgroundColor: r }]}>
            <Ionicons name="checkmark" size={13} color="#fff" />
          </View>
        ) : almost ? (
          <View style={[styles.achAlmostPill, { backgroundColor: tint(r), borderColor: r }]}>
            <Text variant="meta" weight="bold" style={{ color: r }}>{pct}%</Text>
          </View>
        ) : (
          <Ionicons
            name={display.masked ? 'help' : 'lock-closed'}
            size={14}
            color={ink.faint}
          />
        )}
      </View>
      <Text
        variant="meta"
        tone={achievement.unlocked ? 'primary' : 'muted'}
        weight="semiBold"
        style={styles.achTitle}
        numberOfLines={1}
      >
        {display.title}
      </Text>
      {achievement.unlocked ? (
        <Text variant="meta" weight="bold" style={{ color: r }} numberOfLines={1}>
          {isNew ? 'Just unlocked' : 'Unlocked'}
        </Text>
      ) : display.masked ? (
        <Text variant="meta" tone="muted" numberOfLines={1}>
          Secret achievement
        </Text>
      ) : (
        <Text variant="meta" tone="muted" numberOfLines={1}>
          {formatCompact(achievement.current)} / {formatCompact(achievement.target)}
        </Text>
      )}
      {!achievement.unlocked && !display.masked && (
        <View style={[styles.achTrack, { backgroundColor: currentTheme.colors.border }]}>
          <View style={[styles.achFill, { backgroundColor: r, width: `${pct}%` }]} />
        </View>
      )}
    </View>
  );

  // Tap opens the full-screen spotlight — the same modal History's feed uses.
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={display.title}
      style={[styles.achTileWrap, { height: ACH_TILE_HEIGHT }]}
    >
      {front}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenGutter,
    paddingBottom: space.sm,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: screenGutter, paddingTop: space.sm },
  bottomSpacer: { height: space.section },

  celebrate: {
    borderRadius: radius.card,
    borderWidth: 1.5,
    padding: space.lg,
    marginTop: space.xs,
    marginBottom: space.xs,
    gap: space.md,
  },
  celebrateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  celebrateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  celebrateText: { flex: 1 },
  // Aligns the overflow line with the badge-row text column.
  celebrateOverflow: { marginLeft: 42 },

  shareCard: { borderRadius: radius.card, paddingBottom: panelPad },
  shareStrip: { flexDirection: 'row', justifyContent: 'space-around', marginTop: space.xs },
  shareStat: { alignItems: 'center' },
  shareStatLabel: { marginTop: space.xs },

  hero: { alignItems: 'center', paddingVertical: space.section },
  // The tier letter is THE display glyph of the Career screen — a named
  // exception to the type scale, kept at 72.
  heroTier: { fontSize: 72, fontWeight: '800', lineHeight: 78 },
  heroPercentile: { marginTop: space.xs },
  heroRank: { marginTop: space.xs },
  heroProgressWrap: { width: '70%', marginTop: space.lg, alignItems: 'center' },
  heroTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: 3 },
  heroNext: { marginTop: space.sm },

  nextWrap: { marginTop: space.md },
  nextFaceFrame: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.md,
  },
  nextIcon: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  nextEmblem: { width: 30, height: 30 },
  nextBody: { flex: 1 },
  nextLabel: { letterSpacing: track.caps },
  nextTitle: { marginTop: space.xs, marginBottom: space.sm },
  nextBackDesc: { marginTop: space.xs, lineHeight: lineHeightFor(type.meta) },
  nextTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  nextFill: { height: 5, borderRadius: 3 },

  section: { marginTop: space.section },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  tile: {
    width: '31.5%',
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    alignItems: 'center',
  },
  tileLabel: { marginTop: space.xs, textAlign: 'center' },
  comparison: { textAlign: 'center', marginTop: space.md, fontStyle: 'italic' },

  bestsRow: { flexDirection: 'row', gap: space.md },
  bestTile: { flex: 1, borderRadius: radius.card, borderWidth: 1, padding: space.lg },
  bestLabel: { marginTop: space.xs },

  prCard: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg },
  prRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
  prLeft: { flex: 1, marginRight: space.md },
  prSub: { marginTop: space.xs },
  prRight: { alignItems: 'flex-end' },
  prValueLabel: { marginTop: space.xs },

  heatCaption: { lineHeight: lineHeightFor(type.meta), marginTop: -4, marginBottom: space.md },
  heatGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: space.xl },
  heatCol: { gap: space.xs, position: 'relative' },
  // Floats the month abbreviation above its column; offset clears the meta
  // line height so it doesn't overlap the first cell row.
  monthLabel: { position: 'absolute', top: -18, left: 0, width: 40 },
  heatCell: { width: 15, height: 15, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: space.xs, marginTop: space.md, flexWrap: 'wrap' },
  heatLegendKey: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginRight: space.xs },
  heatLegendCell: { width: 11, height: 11, borderRadius: 2 },
  heatLegendSpacer: { flex: 1 },

  muscleCard: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg, paddingVertical: space.sm },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  muscleName: { width: 78 },
  muscleTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  muscleFill: { height: 7, borderRadius: 4 },
  muscleTier: { minWidth: 34, alignItems: 'center', borderWidth: 1.5, borderRadius: radius.badge, paddingHorizontal: space.xs, paddingVertical: 1 },

  ladderRow: { flexDirection: 'row', gap: 2 },
  ladderCell: { flex: 1, height: 26, borderRadius: 3 },
  ladderLabels: { flexDirection: 'row', marginTop: space.sm },
  ladderBaseLabel: { textAlign: 'center' },

  timelineRow: { flexDirection: 'row' },
  timelineMarker: { alignItems: 'center', width: 24 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  timelineContent: { flex: 1, paddingBottom: space.xl, marginLeft: space.sm },
  timelineDate: { marginTop: space.xs },

  rarityRow: { flexDirection: 'row', gap: space.sm, marginTop: space.xs, marginBottom: space.lg },
  rarityChip: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.control, borderWidth: 1, gap: space.xs },
  achTabs: { gap: space.sm, paddingBottom: space.md },
  achTileWrap: { width: '48%' },
  achFace: { width: '100%', height: '100%' },
  achTile: { borderRadius: radius.card, padding: space.md, gap: space.xs },
  achTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achCheck: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  achAlmostPill: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.badge, borderWidth: 1 },
  achHint: { marginTop: space.xs },
  achGroup: { marginTop: space.sm, gap: space.sm },
  achGroupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achTitle: { marginTop: space.xs },
  achTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: space.sm },
  achFill: { height: 4, borderRadius: 2 },

  empty: { lineHeight: lineHeightFor(type.meta) },
});
