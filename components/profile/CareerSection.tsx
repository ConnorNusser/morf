import Card from '@/components/Card';
import CareerModal from '@/components/gamification/CareerModal';
import ProfileIconPicker from '@/components/gamification/ProfileIconPicker';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor } from '@/lib/data/strengthStandards';
import { summarizeAchievements } from '@/lib/gamification/achievements';
import { CareerData, loadCareerData } from '@/lib/gamification/careerData';
import { storageService } from '@/lib/storage/storage';
import { formatCompact } from '@/lib/gamification/careerStats';
import { iconUnlockContext, profileIconName } from '@/lib/gamification/profileIcons';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { CHALLENGE_DONE_COLOR } from '@/lib/gamification/weeklyChallenge';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// A prominent, inline Career section for the Profile — the gamification
// centerpiece. Shows the headline tier hero, lifetime stats, next goal and an
// achievement preview; tapping anything opens the full Career modal.
export default function CareerSection() {
  const { currentTheme } = useTheme();
  const [data, setData] = useState<CareerData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await loadCareerData());
    } catch (err) {
      console.error('CareerSection: failed to load', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!data) return null;

  const color = getTierColor(data.tier);
  const open = () => setShowModal(true);

  const band = getTierBandProgress(data.overall);
  const streakActive = data.stats.currentStreak > 0;
  const challengeColor = data.weeklyChallenge.completed ? CHALLENGE_DONE_COLOR : currentTheme.colors.primary;
  const statItems = [
    { v: `${formatCompact(data.stats.totalVolume)}`, u: data.stats.unit, l: 'lifted', accent: false },
    { v: formatCompact(data.stats.totalWorkouts), u: '', l: 'workouts', accent: false },
    { v: `${data.stats.currentStreak}`, u: 'd', l: 'streak', accent: streakActive },
    { v: formatCompact(data.stats.daysActive), u: '', l: 'days', accent: false },
  ];

  const { nextUp, unlockedCount, total } = summarizeAchievements(data.achievements);

  // Preview chips: newly-unlocked first, then unlocked, then closest locked.
  const previewChips = [...data.achievements]
    .sort((a, b) => {
      const an = data.newIds.has(a.id) ? 1 : 0;
      const bn = data.newIds.has(b.id) ? 1 : 0;
      if (an !== bn) return bn - an;
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return b.progress - a.progress;
    })
    .slice(0, 6);

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={open}>
        <Card variant="elevated" style={styles.card} padding={18}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => setShowIconPicker(true)}
                activeOpacity={0.7}
                hitSlop={8}
                style={[styles.emblem, { backgroundColor: currentTheme.colors.primary }]}
              >
                <Ionicons
                  name={profileIconName(data.profileIconId) as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={currentTheme.colors.surface}
                />
              </TouchableOpacity>
              <Text style={[styles.heading, { color: currentTheme.colors.text }]}>Career</Text>
            </View>
            <View style={styles.headerRight}>
              {data.newIds.size > 0 && (
                <View style={[styles.newBadge, { backgroundColor: currentTheme.colors.primary }]}>
                  <Text style={[styles.newBadgeText, { color: currentTheme.colors.surface }]}>
                    {data.newIds.size} new
                  </Text>
                </View>
              )}
              <Text style={[styles.viewAll, { color: currentTheme.colors.primary }]}>View all</Text>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.primary} />
            </View>
          </View>

          {/* Weekly challenge */}
          <View style={[styles.challenge, { backgroundColor: challengeColor + '12', borderColor: challengeColor + '40' }]}>
            <View style={styles.challengeBody}>
              <Text style={[styles.challengeLabel, { color: challengeColor }]}>
                THIS WEEK{data.weeklyChallenge.completed ? ' · DONE ✓' : ''}
              </Text>
              <Text style={[styles.challengeTitle, { color: currentTheme.colors.text }]} numberOfLines={1}>
                {data.weeklyChallenge.description}
              </Text>
              <View style={[styles.challengeTrack, { backgroundColor: currentTheme.colors.border }]}>
                <View
                  style={[styles.challengeFill, { backgroundColor: challengeColor, width: `${Math.round(data.weeklyChallenge.progress * 100)}%` }]}
                />
              </View>
            </View>
            <Text style={[styles.challengeCount, { color: currentTheme.colors.text }]}>
              {data.weeklyChallenge.current}/{data.weeklyChallenge.target}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />

          {/* Tier hero */}
          <View style={styles.hero}>
            <Text style={[styles.tier, { color }]}>{data.tier}</Text>
            <View style={styles.heroRight}>
              <Text style={[styles.axisLabel, { color }]}>STRENGTH</Text>
              <Text style={[styles.percentile, { color: currentTheme.colors.text }]}>
                {data.overall}
                <Text style={[styles.percentileLabel, { color: currentTheme.colors.text }]}> percentile</Text>
              </Text>
              <View style={[styles.track, { backgroundColor: currentTheme.colors.border }]}>
                <View style={[styles.fill, { backgroundColor: color, width: `${Math.round(band.progress * 100)}%` }]} />
              </View>
              <Text style={[styles.toNext, { color: currentTheme.colors.text }]}>
                {band.nextTier ? `${band.toNext} to ${band.nextTier}` : 'Max tier reached'}
              </Text>
            </View>
          </View>

          {/* Stat row */}
          <View style={[styles.statRow, { borderColor: currentTheme.colors.border }]}>
            {statItems.map(s => (
              <View key={s.l} style={styles.stat}>
                <View style={styles.statValueRow}>
                  {s.accent && <Ionicons name="flame" size={13} color={currentTheme.colors.primary} />}
                  <Text
                    style={[styles.statValue, { color: s.accent ? currentTheme.colors.primary : currentTheme.colors.text }]}
                    numberOfLines={1}
                  >
                    {s.v}
                    {s.u ? <Text style={styles.statUnit}>{s.u}</Text> : null}
                  </Text>
                </View>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>{s.l}</Text>
              </View>
            ))}
          </View>

          {/* Consistency heatmap (last 8 weeks) */}
          <View style={styles.heatRow}>
            {data.heatmap.weeks.slice(-8).map((week, w) => (
              <View key={w} style={styles.heatCol}>
                {week.map((cell, d) => (
                  <View
                    key={d}
                    style={[
                      styles.heatCell,
                      cell.future
                        ? { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: currentTheme.colors.border }
                        : cell.trained
                          ? { backgroundColor: currentTheme.colors.primary, opacity: 0.3 + 0.7 * cell.intensity }
                          : { backgroundColor: currentTheme.colors.border, opacity: 0.45 },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>

          <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />

          {/* Next goal */}
          {nextUp && (
            <View style={styles.nextGoal}>
              <View style={[styles.nextIcon, { backgroundColor: currentTheme.colors.primary + '1A' }]}>
                <Ionicons name={nextUp.icon as keyof typeof Ionicons.glyphMap} size={16} color={currentTheme.colors.primary} />
              </View>
              <View style={styles.nextBody}>
                <Text style={[styles.nextLabel, { color: currentTheme.colors.text }]}>
                  NEXT · {nextUp.title}
                </Text>
                <View style={[styles.nextTrack, { backgroundColor: currentTheme.colors.border }]}>
                  <View
                    style={[styles.nextFill, { backgroundColor: currentTheme.colors.primary, width: `${Math.round(nextUp.progress * 100)}%` }]}
                  />
                </View>
              </View>
              <Text style={[styles.nextCount, { color: currentTheme.colors.text }]}>
                {formatCompact(nextUp.current)}/{formatCompact(nextUp.target)}
              </Text>
            </View>
          )}

          {/* Achievement preview */}
          <View style={styles.achRow}>
            <Text style={[styles.achCount, { color: currentTheme.colors.text }]}>
              {unlockedCount}/{total} achievements
            </Text>
            <View style={styles.chips}>
              {previewChips.map(a => {
                const isNew = data.newIds.has(a.id);
                return (
                  <View
                    key={a.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: a.unlocked ? currentTheme.colors.primary + '1A' : 'transparent',
                        borderColor: isNew ? currentTheme.colors.primary : currentTheme.colors.border,
                        borderWidth: isNew ? 2 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={a.icon as keyof typeof Ionicons.glyphMap}
                      size={15}
                      color={a.unlocked ? currentTheme.colors.primary : currentTheme.colors.text + '40'}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </Card>
      </TouchableOpacity>

      <CareerModal visible={showModal} onClose={() => { setShowModal(false); load(); }} />

      <ProfileIconPicker
        visible={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        unlockContext={iconUnlockContext(data.achievements)}
        currentId={data.profileIconId}
        onSelect={async id => {
          await storageService.setProfileIconId(id);
          setShowIconPicker(false);
          load();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.7 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emblem: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 20, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  newBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginRight: 4 },
  newBadgeText: { fontSize: 11, fontWeight: '700' },
  viewAll: { fontSize: 13, fontWeight: '600' },

  axisLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.6, marginBottom: 3 },

  challenge: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  challengeBody: { flex: 1 },
  challengeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  challengeTitle: { fontSize: 14, fontWeight: '600', marginTop: 2, marginBottom: 7 },
  challengeTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  challengeFill: { height: 6, borderRadius: 3 },
  challengeCount: { fontSize: 14, fontWeight: '700', opacity: 0.7 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tier: { fontSize: 52, fontWeight: '800', lineHeight: 56, minWidth: 72, textAlign: 'center' },
  heroRight: { flex: 1 },
  percentile: { fontSize: 18, fontWeight: '700' },
  percentileLabel: { fontSize: 13, fontWeight: '400', opacity: 0.5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  fill: { height: 6, borderRadius: 3 },
  toNext: { fontSize: 12, opacity: 0.55, marginTop: 6 },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  stat: { alignItems: 'center', flex: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '700' },
  statUnit: { fontSize: 11, fontWeight: '600', opacity: 0.6 },
  statLabel: { fontSize: 11, opacity: 0.5, marginTop: 2 },

  heatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heatCol: { gap: 3 },
  heatCell: { width: 12, height: 12, borderRadius: 2 },

  nextGoal: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  nextBody: { flex: 1 },
  nextLabel: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
  nextTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  nextFill: { height: 5, borderRadius: 3 },
  nextCount: { fontSize: 12, fontWeight: '700', opacity: 0.6 },

  achRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achCount: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
