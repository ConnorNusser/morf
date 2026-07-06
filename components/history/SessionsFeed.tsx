// The Sessions feed — a workout HISTORY: the last few sessions as detailed log
// entries (header + a per-exercise table), newest first. Reads like a training
// log, not a social feed. (The volume-per-session bars live on the This Week
// card, which owns the volume story.)
import AchievementBadge from '@/components/gamification/AchievementBadge';
import AchievementModal, { AchievementModalItem } from '@/components/gamification/AchievementModal';
import { Text } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS, PPL_LABELS } from '@/lib/data/pplCategories';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { Rarity } from '@/lib/gamification/rarity';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { space } from '@/lib/ui/tokens';
import { formatCompact } from '@/lib/utils/utils';
import { SessionRecap } from '@/lib/history/sessionRecap';
import { GeneratedWorkout, WeightUnit } from '@/types';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

// An achievement earned by a specific session — shown as its real badge art
// on that session's entry; tap for the full-screen spotlight.
export interface SessionAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
}

// One green accent per screen: the newest entry's PR row. Rare and earned — older
// entries mark their PRs quietly, so celebration never becomes wallpaper.
const POS = '#34C759';

// Suppress the auto-generated default title ("Workout - 7/3/2026") so the entry
// header reads as just the day; keep real titles like "Leg Day".
const cleanTitle = (t: string): string | null => {
  const s = (t || '').trim();
  return !s || /^workout\b/i.test(s) ? null : s;
};

// Drop the trailing "(Equipment)" — matches the shortening the lineup/headlines use.
const shortHeroName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

// ── one session as a detailed log entry: header (title; date · split · sets ·
// time, the split word carrying its Push/Pull/Legs color; volume right), an
// optional narrative note, then the full per-exercise table — every exercise
// with its set count and top set, PRs marked on their row.
function SessionEntry({ recap, weightUnit, celebrate, achievements, onPress, onPressAchievement }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  celebrate: boolean;
  achievements?: SessionAchievement[];
  onPress: (w: GeneratedWorkout) => void;
  onPressAchievement: (a: SessionAchievement, recap: SessionRecap) => void;
}) {
  const prName = recap.pr ? shortHeroName(recap.pr.name) : null;
  // The narrative note earns its line only when it says something the exercise
  // table can't (comeback / biggest-yet); a plain "X PR" is told on the row itself.
  const note = recap.headline && !/\bPR\b/.test(recap.headline) ? recap.headline : null;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(recap.workout)} style={styles.entry}>
      {/* entry header — identity left, session volume right. The split word in
          the meta line is the entry's one dab of Push/Pull/Legs color (the same
          PPL_COLORS the Career activity grid and This Week bars use). */}
      <RNView style={styles.entryHead}>
        <RNView style={styles.entryIdentity}>
          <Text variant="title" tone="primary" weight="semiBold" style={styles.entryTitle} numberOfLines={1}>
            {cleanTitle(recap.title) ?? (recap.split ? `${PPL_LABELS[recap.split]} session` : 'Workout')}
          </Text>
          <Text variant="meta" tone="secondary" numberOfLines={1}>
            {formatRelativeDate(recap.workout.createdAt)}
            {recap.split && (
              <>
                {' · '}
                <Text variant="meta" weight="semiBold" style={{ color: PPL_COLORS[recap.split] }}>
                  {PPL_LABELS[recap.split]}
                </Text>
              </>
            )}
            {' · '}{recap.sets} sets · {recap.durationMin}m
          </Text>
        </RNView>
        <Text variant="emphasis" tone="primary" weight="bold" style={styles.entryVolume} numberOfLines={1}>
          {formatCompact(recap.volumeDisplay)} {weightUnit}
        </Text>
      </RNView>

      {note && (
        <Text variant="meta" tone="secondary" style={styles.entryNote} numberOfLines={1}>
          {note}
        </Text>
      )}

      {/* achievements this session earned — the app's real badge art with the
          title beside it, between the header and the log; tap one for its
          full-screen spotlight. */}
      {achievements && achievements.length > 0 && (
        <RNView style={styles.achRow}>
          {achievements.slice(0, 5).map(a => (
            <TouchableOpacity
              key={a.id}
              style={styles.achItem}
              onPress={() => onPressAchievement(a, recap)}
              activeOpacity={0.7}
              hitSlop={6}
              accessibilityLabel={a.title}
              accessibilityRole="button"
            >
              <AchievementBadge icon={a.icon} emblem={emblemFor(a.id)} rarity={a.rarity} size={30} />
              <Text variant="meta" tone="secondary" weight="semiBold" numberOfLines={1}>
                {a.title}
              </Text>
            </TouchableOpacity>
          ))}
        </RNView>
      )}

      {/* the log proper — one aligned row per exercise: name + set count left,
          top set right; the day's PR wears its marker on the row it happened. */}
      <RNView style={styles.exList}>
        {recap.lineup.map((l, i) => {
          const isPRRow = prName != null && l.name === prName;
          return (
            <RNView key={`${l.name}-${i}`} style={styles.exRow}>
              <Text variant="emphasis" tone="primary" weight="semiBold" style={styles.exName} numberOfLines={1}>
                {l.name}
                <Text variant="meta" tone="muted">  {l.sets}×</Text>
              </Text>
              {isPRRow && (
                <Text
                  variant="meta"
                  tone="secondary"
                  weight="bold"
                  style={[styles.prTag, celebrate && { color: POS }]}
                >
                  {celebrate && recap.prGainDisplay > 0 ? `PR +${recap.prGainDisplay}` : 'PR'}
                </Text>
              )}
              <Text
                variant="meta"
                tone="secondary"
                style={[styles.exSet, isPRRow && celebrate && { color: POS }]}
                numberOfLines={1}
              >
                {l.weight > 0 ? `${l.weight} × ${l.reps}` : `${l.reps} reps`}
              </Text>
            </RNView>
          );
        })}
      </RNView>
    </TouchableOpacity>
  );
}

interface SessionsFeedProps {
  recaps: SessionRecap[];
  weightUnit: WeightUnit;
  visibleCount: number;
  onPressSession: (w: GeneratedWorkout) => void;
  onToggleShowAll?: () => void;
  totalCount: number;
  /** Achievements earned per workout id — pills on that session's entry. */
  achievementsByWorkout?: Record<string, SessionAchievement[]>;
}

export default function SessionsFeed({ recaps, weightUnit, visibleCount, onPressSession, onToggleShowAll, totalCount, achievementsByWorkout }: SessionsFeedProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);
  if (recaps.length === 0) return null;

  const openSpotlight = (a: SessionAchievement, recap: SessionRecap) => {
    const where = cleanTitle(recap.title) ?? (recap.split ? `${PPL_LABELS[recap.split]} session` : 'Workout');
    setSpotlight({ ...a, earnedLabel: `${where} · ${formatRelativeDate(recap.workout.createdAt)}` });
  };

  const entries = recaps.slice(0, Math.max(1, visibleCount));
  const hasMore = totalCount > visibleCount;

  return (
    <RNView>
      {/* SESSIONS — the same micro-label header grammar as every section on the tab. */}
      <RNView style={styles.feedHead}>
        <SectionLabel style={styles.microLabel}>SESSIONS</SectionLabel>
      </RNView>

      {entries.map((r, i) => (
        <RNView
          key={r.workout.id}
          style={[styles.entryWrap, { borderTopColor: colors.border }]}
        >
          <SessionEntry
            recap={r}
            weightUnit={weightUnit}
            celebrate={i === 0}
            achievements={achievementsByWorkout?.[r.workout.id]}
            onPress={onPressSession}
            onPressAchievement={openSpotlight}
          />
        </RNView>
      ))}

      {onToggleShowAll && (hasMore || visibleCount > 6) && (
        <TouchableOpacity style={styles.viewAll} onPress={onToggleShowAll} activeOpacity={0.7}>
          <Text variant="meta" weight="semiBold">
            {hasMore ? `View all ${totalCount} sessions` : 'Show less'}
          </Text>
        </TouchableOpacity>
      )}

      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} featurable />
    </RNView>
  );
}

const styles = StyleSheet.create({
  // Career-grammar shared bits: the SectionLabel micro-label heads the feed.
  feedHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: space.md, paddingBottom: space.md },
  microLabel: { marginBottom: 0 },
  // Log entries, separated by hairlines like every list on the tab.
  entryWrap: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.md },
  entry: { paddingTop: space.lg, paddingBottom: space.md },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  entryIdentity: { flex: 1, gap: 2 },
  entryTitle: { letterSpacing: -0.2 },
  entryVolume: { letterSpacing: -0.2 },
  entryNote: { marginTop: space.sm },
  // Earned-this-session achievements: badge art + title, tappable.
  achRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  achItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // The per-exercise table.
  exList: { marginTop: space.md, gap: space.sm },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // The lift names are the table's primary read; the set values sit quiet.
  exName: { flex: 1 },
  prTag: { letterSpacing: 0.3 },
  exSet: { letterSpacing: -0.2, minWidth: 64, textAlign: 'right' },
  viewAll: { paddingVertical: space.lg, alignItems: 'center' },
});
