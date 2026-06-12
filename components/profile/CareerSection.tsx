import Card from '@/components/Card';
import CareerModal from '@/components/gamification/CareerModal';
import ProfileIconPicker from '@/components/gamification/ProfileIconPicker';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor } from '@/lib/data/strengthStandards';
import { summarizeAchievements } from '@/lib/gamification/achievements';
import { CareerData, loadCareerData } from '@/lib/gamification/careerData';
import { storageService } from '@/lib/storage/storage';
import { formatCompact } from '@/lib/gamification/careerStats';
import { iconUnlockContext, newlyUnlockedEmblems, profileIconName } from '@/lib/gamification/profileIcons';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { HEAT_OPACITIES, heatLevel } from '@/lib/gamification/trainingHeatmap';
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
  const newEmblems = newlyUnlockedEmblems(data.newIds);
  const streakActive = data.stats.currentStreak > 0;
  const statItems = [
    { v: `${formatCompact(data.stats.totalVolume)}`, u: data.stats.unit, l: 'lifted', accent: false },
    { v: formatCompact(data.stats.totalWorkouts), u: '', l: 'workouts', accent: false },
    { v: `${data.stats.currentStreak}`, u: 'd', l: 'streak', accent: streakActive },
    { v: formatCompact(data.stats.daysActive), u: '', l: 'days', accent: false },
  ];

  const { nextUp, unlockedCount, total } = summarizeAchievements(data.achievements);

  // Consistency strip: the last 8 weeks, with a count so it reads on its own.
  const recentWeeks = data.heatmap.weeks.slice(-8);
  const recentActive = recentWeeks.reduce((n, wk) => n + wk.filter(c => c.trained).length, 0);

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={open}>
        <Card variant="elevated" style={styles.card} padding={18}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.heading, { color: currentTheme.colors.text }]}>Career</Text>
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

          {/* Tier hero — the custom emblem is the identity, the tier its rank badge */}
          <View style={styles.hero}>
            <TouchableOpacity
              onPress={() => setShowIconPicker(true)}
              activeOpacity={0.8}
              hitSlop={6}
              style={[styles.heroAvatar, { backgroundColor: color + '1A', borderColor: color }]}
            >
              <Ionicons
                name={profileIconName(data.profileIconId) as keyof typeof Ionicons.glyphMap}
                size={30}
                color={color}
              />
              <View style={[styles.heroRankBadge, { backgroundColor: color, borderColor: currentTheme.colors.surface }]}>
                <Text style={styles.heroRankText}>{data.tier}</Text>
              </View>
              {newEmblems.length > 0 && (
                <View style={[styles.emblemNewDot, { backgroundColor: currentTheme.colors.primary, borderColor: currentTheme.colors.surface }]} />
              )}
            </TouchableOpacity>
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

          <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />

          {/* Stat row */}
          <View style={[styles.statRow, { borderColor: currentTheme.colors.border }]}>
            {statItems.map(s => (
              <View key={s.l} style={styles.stat}>
                <Text
                  style={[styles.statValue, { color: s.accent ? currentTheme.colors.primary : currentTheme.colors.text }]}
                  numberOfLines={1}
                >
                  {s.v}
                  {s.u ? <Text style={styles.statUnit}>{s.u}</Text> : null}
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>{s.l}</Text>
              </View>
            ))}
          </View>

          {/* Activity — the last 8 weeks, labelled so it reads on its own */}
          <View style={styles.consistency}>
            <View style={styles.consistencyHead}>
              <Text style={[styles.consistencyLabel, { color: currentTheme.colors.text }]}>ACTIVITY</Text>
              <Text style={[styles.consistencyMeta, { color: currentTheme.colors.text }]}>
                {recentActive} active days · last 8 weeks
              </Text>
            </View>
            <View style={styles.heatRow}>
              {recentWeeks.map((week, w) => (
                <View key={w} style={styles.heatCol}>
                  {week.map((cell, d) => (
                    <View
                      key={d}
                      style={[
                        styles.heatCell,
                        cell.future
                          ? { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: currentTheme.colors.border }
                          : cell.trained
                            ? { backgroundColor: currentTheme.colors.primary, opacity: HEAT_OPACITIES[heatLevel(cell.intensity)] }
                            : { backgroundColor: currentTheme.colors.border, opacity: 0.45 },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />

          {/* Next goal */}
          {nextUp && (
            <View style={styles.nextGoal}>
              <View style={styles.nextBody}>
                <Text style={[styles.nextLabel, { color: currentTheme.colors.text }]} numberOfLines={1}>
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

          {/* Achievements — collection count; the full grid lives in the modal */}
          <View style={styles.achRow}>
            <Text style={[styles.achCount, { color: currentTheme.colors.text }]}>
              {unlockedCount}/{total} achievements unlocked
            </Text>
            {data.newIds.size > 0 && (
              <Text style={[styles.achNew, { color: currentTheme.colors.primary }]}>
                {data.newIds.size} new
              </Text>
            )}
          </View>
        </Card>
      </TouchableOpacity>

      <CareerModal visible={showModal} onClose={() => { setShowModal(false); load(); }} />

      <ProfileIconPicker
        visible={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        unlockContext={iconUnlockContext(data.achievements)}
        newIds={data.newIds}
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
  heading: { fontSize: 20, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  newBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginRight: 4 },
  newBadgeText: { fontSize: 11, fontWeight: '700' },
  viewAll: { fontSize: 13, fontWeight: '600' },

  axisLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.6, marginBottom: 3 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  heroRankBadge: { position: 'absolute', bottom: -4, right: -4, minWidth: 24, height: 22, borderRadius: 11, borderWidth: 2, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  emblemNewDot: { position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  heroRankText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  heroRight: { flex: 1 },
  percentile: { fontSize: 18, fontWeight: '700' },
  percentileLabel: { fontSize: 13, fontWeight: '400', opacity: 0.5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  fill: { height: 6, borderRadius: 3 },
  toNext: { fontSize: 12, opacity: 0.55, marginTop: 6 },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 16, fontWeight: '700' },
  statUnit: { fontSize: 11, fontWeight: '600', opacity: 0.6 },
  statLabel: { fontSize: 11, opacity: 0.5, marginTop: 2 },

  consistency: { gap: 8 },
  consistencyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  consistencyLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },
  consistencyMeta: { fontSize: 11, opacity: 0.5 },
  heatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heatCol: { gap: 3 },
  heatCell: { width: 12, height: 12, borderRadius: 2 },

  nextGoal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextBody: { flex: 1 },
  nextLabel: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
  nextTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  nextFill: { height: 5, borderRadius: 3 },
  nextCount: { fontSize: 12, fontWeight: '700', opacity: 0.6 },

  achRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achCount: { fontSize: 13, fontWeight: '600', opacity: 0.6 },
  achNew: { fontSize: 13, fontWeight: '700' },
});
