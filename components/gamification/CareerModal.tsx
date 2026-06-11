import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { getWorkoutById } from '@/lib/workout/workouts';
import { storageService } from '@/lib/storage/storage';
import {
  Achievement,
  AchievementCategory,
  summarizeAchievements,
  unlockedIds,
} from '@/lib/gamification/achievements';
import { CareerData, loadCareerData } from '@/lib/gamification/careerData';
import { CareerStats, formatCompact, volumeComparison } from '@/lib/gamification/careerStats';
import { MuscleMastery } from '@/lib/gamification/muscleMastery';
import { LiftPR } from '@/lib/gamification/personalRecords';
import { getTierBandProgress, TierMilestone, TierRung } from '@/lib/gamification/tierTimeline';
import { TrainingHeatmap } from '@/lib/gamification/trainingHeatmap';
import { WeeklyChallenge } from '@/lib/gamification/weeklyChallenge';
import { captureAndShare } from '@/lib/ui/shareUtils';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

export default function CareerModal({ visible, onClose }: Props) {
  const { currentTheme } = useTheme();
  const [data, setData] = useState<CareerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leveledUpTo, setLeveledUpTo] = useState<number | null>(null);
  const shareRef = useRef<ViewShot>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const career = await loadCareerData();
      const lastLevel = await storageService.getLastCelebratedLevel();
      setData(career);
      setLeveledUpTo(career.level.level > lastLevel ? career.level.level : null);
      // Acknowledge everything now that the user is viewing it, so the
      // "new" highlights and level-up celebration clear next time.
      await storageService.setSeenAchievements(unlockedIds(career.achievements));
      await storageService.setLastCelebratedLevel(career.level.level);
    } catch (err) {
      console.error('CareerModal: failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.header}>
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
            {(data.newIds.size > 0 || leveledUpTo != null) && (
              <UnlockCelebration
                items={data.achievements.filter(a => data.newIds.has(a.id))}
                leveledUpTo={leveledUpTo}
              />
            )}
            <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
              <View style={[styles.shareCard, { backgroundColor: currentTheme.colors.background }]}>
                <View style={styles.shareTopRow}>
                  <Text style={[styles.shareBrand, { color: currentTheme.colors.text }]}>MORF</Text>
                  <View style={[styles.levelPill, { backgroundColor: currentTheme.colors.primary }]}>
                    <Text style={[styles.levelPillText, { color: currentTheme.colors.surface }]}>
                      LVL {data.level.level} · {data.level.title}
                    </Text>
                  </View>
                </View>
                <TierHero overall={data.overall} tier={data.tier} />
                <ShareStatStrip stats={data.stats} />
              </View>
            </ViewShot>
            <WeeklyChallengeView challenge={data.weeklyChallenge} />
            <NextGoal achievements={data.achievements} />
            {/* Lifetime overview */}
            <StatGrid stats={data.stats} />
            <ConsistencyView heatmap={data.heatmap} />
            {/* Strength */}
            <BestsView stats={data.stats} />
            <PersonalRecordsView prs={data.prs} />
            <MuscleMasteryView mastery={data.muscleMastery} />
            {/* Tier progression */}
            <TierLadderView ladder={data.ladder} />
            <TierTimelineView timeline={data.timeline} stats={data.stats} />
            <AchievementGridView achievements={data.achievements} newIds={data.newIds} />
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

// ---- Celebration shown at the top when achievements / a level were just earned ----
function UnlockCelebration({ items, leveledUpTo }: { items: Achievement[]; leveledUpTo: number | null }) {
  const { currentTheme } = useTheme();
  const accent = currentTheme.colors.primary;
  const title =
    leveledUpTo != null && items.length > 0
      ? '🎉 New rewards'
      : leveledUpTo != null
        ? '⚡ Level Up!'
        : items.length === 1
          ? '🎉 Achievement Unlocked'
          : `🎉 ${items.length} Achievements Unlocked`;
  // Cap the rows so a first-time user with many unlocked doesn't get a wall.
  const shown = items.slice(0, 4);
  const overflow = items.length - shown.length;
  return (
    <View style={[styles.celebrate, { backgroundColor: accent + '14', borderColor: accent }]}>
      <Text style={[styles.celebrateTitle, { color: accent }]}>{title}</Text>
      {leveledUpTo != null && (
        <View style={styles.celebrateRow}>
          <View style={[styles.celebrateIcon, { backgroundColor: accent }]}>
            <Ionicons name="flash" size={16} color={currentTheme.colors.surface} />
          </View>
          <View style={styles.celebrateText}>
            <Text style={[styles.celebrateName, { color: currentTheme.colors.text }]}>Reached Level {leveledUpTo}</Text>
            <Text style={[styles.celebrateDesc, { color: currentTheme.colors.text }]}>Keep the momentum going</Text>
          </View>
        </View>
      )}
      {shown.map(a => (
        <View key={a.id} style={styles.celebrateRow}>
          <View style={[styles.celebrateIcon, { backgroundColor: accent }]}>
            <Ionicons name={a.icon as keyof typeof Ionicons.glyphMap} size={16} color={currentTheme.colors.surface} />
          </View>
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

// ---- This week's rotating challenge ----
function WeeklyChallengeView({ challenge }: { challenge: WeeklyChallenge }) {
  const { currentTheme } = useTheme();
  const accent = currentTheme.colors.primary;
  return (
    <View style={[styles.weekly, { backgroundColor: accent + '12', borderColor: accent + '40' }]}>
      <View style={styles.weeklyBody}>
        <Text style={[styles.weeklyLabel, { color: accent }]}>
          THIS WEEK · {challenge.title.toUpperCase()}
          {challenge.completed ? ' · DONE ✓' : ''}
        </Text>
        <Text style={[styles.weeklyTitle, { color: currentTheme.colors.text }]}>{challenge.description}</Text>
        <View style={[styles.weeklyTrack, { backgroundColor: currentTheme.colors.border }]}>
          <View style={[styles.weeklyFill, { backgroundColor: accent, width: `${Math.round(challenge.progress * 100)}%` }]} />
        </View>
      </View>
      <Text style={[styles.weeklyCount, { color: currentTheme.colors.text }]}>
        {challenge.current}/{challenge.target}
      </Text>
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
function ConsistencyView({ heatmap }: { heatmap: TrainingHeatmap }) {
  const { currentTheme } = useTheme();
  const accent = currentTheme.colors.primary;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <SectionLabel>Consistency</SectionLabel>
        <Text style={[styles.achCount, { color: currentTheme.colors.text }]}>
          {heatmap.totalDays} days · 12 wks
        </Text>
      </View>
      <View style={styles.heatGrid}>
        {heatmap.weeks.map((week, w) => (
          <View key={w} style={styles.heatCol}>
            {week.map((cell, d) => (
              <View
                key={d}
                style={[
                  styles.heatCell,
                  cell.future
                    ? { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: currentTheme.colors.border }
                    : cell.trained
                      ? { backgroundColor: accent, opacity: 0.3 + 0.7 * cell.intensity }
                      : { backgroundColor: currentTheme.colors.border, opacity: 0.5 },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.heatLegend}>
        <Text style={[styles.heatLegendText, { color: currentTheme.colors.text }]}>Less</Text>
        {[0.2, 0.45, 0.7, 1].map(i => (
          <View key={i} style={[styles.heatLegendCell, { backgroundColor: accent, opacity: 0.3 + 0.7 * i }]} />
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
      {newIds.size > 0 && (
        <Text style={[styles.achNewBanner, { color: currentTheme.colors.primary }]}>
          🎉 {newIds.size} newly unlocked
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
  const accent = currentTheme.colors.primary;
  // When tapped, swap the (truncated) description for exact progress detail.
  const detail = selected
    ? achievement.unlocked
      ? 'Unlocked ✓'
      : `${formatCompact(achievement.current)} / ${formatCompact(achievement.target)}`
    : achievement.description;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.achTile,
        {
          backgroundColor: currentTheme.colors.surface,
          borderColor: isNew || achievement.unlocked ? accent : currentTheme.colors.border,
          borderWidth: isNew ? 2 : 1,
        },
      ]}
    >
      <View style={styles.achTileTop}>
        <Ionicons
          name={achievement.icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={achievement.unlocked ? accent : currentTheme.colors.text + '40'}
        />
        {isNew && (
          <View style={[styles.achNewPill, { backgroundColor: accent }]}>
            <Text style={[styles.achNewPillText, { color: currentTheme.colors.surface }]}>NEW</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.achTitle, { color: currentTheme.colors.text, opacity: achievement.unlocked ? 1 : 0.55 }]}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>
      <Text
        style={[styles.achDesc, { color: selected ? accent : currentTheme.colors.text, opacity: selected ? 1 : 0.5 }]}
        numberOfLines={1}
      >
        {detail}
      </Text>
      {!achievement.unlocked && (
        <View style={[styles.achTrack, { backgroundColor: currentTheme.colors.border }]}>
          <View style={[styles.achFill, { backgroundColor: accent, width: `${Math.round(achievement.progress * 100)}%` }]} />
        </View>
      )}
    </TouchableOpacity>
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
  celebrateTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  celebrateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  celebrateIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  celebrateText: { flex: 1 },
  celebrateName: { fontSize: 14, fontWeight: '700' },
  celebrateDesc: { fontSize: 12, opacity: 0.55 },

  shareCard: { borderRadius: 16, paddingBottom: 18 },
  shareTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  shareBrand: { fontSize: 13, fontWeight: '800', letterSpacing: 3, opacity: 0.4 },
  levelPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  levelPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
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

  weekly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  weeklyBody: { flex: 1 },
  weeklyLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  weeklyTitle: { fontSize: 14, fontWeight: '600', marginTop: 2, marginBottom: 7 },
  weeklyTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  weeklyFill: { height: 6, borderRadius: 3 },
  weeklyCount: { fontSize: 14, fontWeight: '700', opacity: 0.7 },

  nextGoal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
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

  heatGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  heatCol: { gap: 4 },
  heatCell: { width: 15, height: 15, borderRadius: 3 },
  heatLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 10 },
  heatLegendText: { fontSize: 10, opacity: 0.4 },
  heatLegendCell: { width: 11, height: 11, borderRadius: 2 },

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
  achNewBanner: { fontSize: 14, fontWeight: '700', marginBottom: 12, marginTop: -4 },
  achTabs: { gap: 8, paddingBottom: 12 },
  achTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  achTabText: { fontSize: 12, fontWeight: '600' },
  achTile: { width: '48%', borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  achTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achNewPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  achNewPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  achTitle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  achDesc: { fontSize: 11, opacity: 0.5 },
  achTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  achFill: { height: 4, borderRadius: 2 },

  empty: { fontSize: 14, opacity: 0.5, lineHeight: 20 },
});
