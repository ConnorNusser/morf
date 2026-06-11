import { useTheme } from '@/contexts/ThemeContext';
import {
  getStrengthTier,
  getTierColor,
  StrengthTier,
  TIER_THRESHOLDS,
} from '@/lib/data/strengthStandards';
import { storageService } from '@/lib/storage/storage';
import { userService } from '@/lib/services/userService';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { Achievement, computeAchievements, newlyUnlocked, unlockedIds } from '@/lib/gamification/achievements';
import { CareerStats, computeCareerStats, formatCompact } from '@/lib/gamification/careerStats';
import { computeTierTimeline, getTierLadder, TierMilestone, TierRung } from '@/lib/gamification/tierTimeline';
import { convertWeight } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface CareerData {
  stats: CareerStats;
  overall: number;
  tier: StrengthTier;
  ladder: TierRung[];
  timeline: TierMilestone[];
  achievements: Achievement[];
  newIds: Set<string>; // achievements newly unlocked since last viewed
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CareerModal({ visible, onClose }: Props) {
  const { currentTheme } = useTheme();
  const [data, setData] = useState<CareerData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [history, profile, lifts, filters, seen] = await Promise.all([
        storageService.getWorkoutHistory(),
        userService.getUserProfileOrDefault(),
        userService.getAllFeaturedLifts(),
        storageService.getLiftDisplayFilters(),
        storageService.getSeenAchievements(),
      ]);
      const unit = profile.weightUnitPreference || 'lbs';
      const stats = computeCareerStats(history, unit);

      const visibleLifts = lifts.filter(l => !filters.hiddenLiftIds.includes(l.workoutId));
      const overall = visibleLifts.length
        ? calculateOverallPercentile(visibleLifts.map(l => l.percentileRanking))
        : 0;

      const bodyWeightLbs = profile.weight
        ? convertWeight(profile.weight.value, profile.weight.unit, 'lbs')
        : 0;
      const timeline = computeTierTimeline(history, {
        bodyWeightLbs,
        gender: profile.gender,
        age: profile.age,
      });

      const achievements = computeAchievements(stats, overall);
      const newIds = new Set(newlyUnlocked(achievements, seen).map(a => a.id));

      setData({
        stats,
        overall,
        tier: getStrengthTier(overall),
        ladder: getTierLadder(overall),
        timeline,
        achievements,
        newIds,
      });

      // Acknowledge everything unlocked now that the user is viewing it, so the
      // "new" highlights clear next time.
      await storageService.setSeenAchievements(unlockedIds(achievements));
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
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={currentTheme.colors.text} />
          </TouchableOpacity>
        </View>

        {loading || !data ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={currentTheme.colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <TierHero overall={data.overall} tier={data.tier} />
            <StatGrid stats={data.stats} />
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

  // Progress through the current tier band: from this tier's floor to the next.
  const idx = TIER_THRESHOLDS.findIndex(t => t.label === tier);
  const floor = idx >= 0 ? TIER_THRESHOLDS[idx].threshold : 0;
  const nextRung = idx >= 0 && idx < TIER_THRESHOLDS.length - 1 ? TIER_THRESHOLDS[idx + 1] : null;
  const bandProgress = nextRung
    ? Math.max(0, Math.min(1, (overall - floor) / Math.max(1, nextRung.threshold - floor)))
    : 1;
  const toNext = nextRung ? nextRung.threshold - overall : 0;

  return (
    <View style={styles.hero}>
      <Text style={[styles.heroTier, { color }]}>{tier}</Text>
      <Text style={[styles.heroPercentile, { color: currentTheme.colors.text }]}>
        {overall}
        <Text style={[styles.heroPercentileLabel, { color: currentTheme.colors.text }]}> percentile</Text>
      </Text>
      {nextRung ? (
        <View style={styles.heroProgressWrap}>
          <View style={[styles.heroTrack, { backgroundColor: currentTheme.colors.border }]}>
            <View style={[styles.heroFill, { backgroundColor: color, width: `${Math.round(bandProgress * 100)}%` }]} />
          </View>
          <Text style={[styles.heroNext, { color: currentTheme.colors.text }]}>
            {toNext} to {nextRung.label}
          </Text>
        </View>
      ) : (
        <Text style={[styles.heroNext, { color: currentTheme.colors.text }]}>Max tier reached</Text>
      )}
    </View>
  );
}

// ---- Lifetime stat grid ----
function StatGrid({ stats }: { stats: CareerStats }) {
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

// ---- Tier ladder: every tier, reached ones filled, current marked ----
function TierLadderView({ ladder }: { ladder: TierRung[] }) {
  const { currentTheme } = useTheme();
  return (
    <View style={styles.section}>
      <SectionLabel>Tier ladder</SectionLabel>
      <View style={styles.ladderRow}>
        {ladder.map(rung => {
          const color = getTierColor(rung.tier);
          return (
            <View key={rung.tier} style={styles.ladderItem}>
              <View
                style={[
                  styles.ladderBar,
                  {
                    backgroundColor: rung.reached ? color : currentTheme.colors.border,
                    opacity: rung.reached ? 1 : 0.4,
                    height: rung.current ? 34 : 22,
                  },
                ]}
              />
              {rung.current && (
                <Text style={[styles.ladderCurrent, { color }]} numberOfLines={1}>
                  {rung.tier}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.ladderEnds}>
        <Text style={[styles.ladderEndLabel, { color: currentTheme.colors.text }]}>E-</Text>
        <Text style={[styles.ladderEndLabel, { color: currentTheme.colors.text }]}>S++</Text>
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
function AchievementGridView({ achievements, newIds }: { achievements: Achievement[]; newIds: Set<string> }) {
  const { currentTheme } = useTheme();
  const unlocked = achievements.filter(a => a.unlocked).length;
  // New first, then unlocked, then locked sorted by closest progress.
  const ordered = [...achievements].sort((a, b) => {
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
          {unlocked}/{achievements.length}
        </Text>
      </View>
      {newIds.size > 0 && (
        <Text style={[styles.achNewBanner, { color: currentTheme.colors.primary }]}>
          🎉 {newIds.size} newly unlocked
        </Text>
      )}
      <View style={styles.grid}>
        {ordered.map(a => (
          <AchievementTile key={a.id} achievement={a} isNew={newIds.has(a.id)} />
        ))}
      </View>
    </View>
  );
}

function AchievementTile({ achievement, isNew }: { achievement: Achievement; isNew: boolean }) {
  const { currentTheme } = useTheme();
  const accent = currentTheme.colors.primary;
  return (
    <View
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
      <Text style={[styles.achDesc, { color: currentTheme.colors.text }]} numberOfLines={1}>
        {achievement.description}
      </Text>
      {!achievement.unlocked && (
        <View style={[styles.achTrack, { backgroundColor: currentTheme.colors.border }]}>
          <View style={[styles.achFill, { backgroundColor: accent, width: `${Math.round(achievement.progress * 100)}%` }]} />
        </View>
      )}
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
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  hero: { alignItems: 'center', paddingVertical: 24 },
  heroTier: { fontSize: 72, fontWeight: '800', lineHeight: 78 },
  heroPercentile: { fontSize: 20, fontWeight: '600', marginTop: 4 },
  heroPercentileLabel: { fontSize: 14, fontWeight: '400', opacity: 0.5 },
  heroProgressWrap: { width: '70%', marginTop: 16, alignItems: 'center' },
  heroTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: 3 },
  heroNext: { fontSize: 13, opacity: 0.6, marginTop: 8 },

  section: { marginTop: 28 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, opacity: 0.45, textTransform: 'uppercase', marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31.5%', borderRadius: 12, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' },
  tileValue: { fontSize: 18, fontWeight: '700' },
  tileLabel: { fontSize: 11, opacity: 0.5, marginTop: 4, textAlign: 'center' },

  ladderRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 44 },
  ladderItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  ladderBar: { width: '70%', borderRadius: 3 },
  ladderCurrent: { fontSize: 10, fontWeight: '700', marginTop: 3 },
  ladderEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  ladderEndLabel: { fontSize: 11, opacity: 0.4 },

  timelineRow: { flexDirection: 'row' },
  timelineMarker: { alignItems: 'center', width: 24 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  timelineContent: { flex: 1, paddingBottom: 18, marginLeft: 8 },
  timelineTitle: { fontSize: 15, fontWeight: '600' },
  timelineDate: { fontSize: 13, opacity: 0.5, marginTop: 1 },

  achCount: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  achNewBanner: { fontSize: 14, fontWeight: '700', marginBottom: 12, marginTop: -4 },
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
