import AnimatedBar from '@/components/AnimatedBar';
import AnimatedCount from '@/components/AnimatedCount';
import Card from '@/components/Card';
import CareerModal from '@/components/gamification/CareerModal';
import FlipCard from '@/components/gamification/FlipCard';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor } from '@/lib/data/strengthStandards';
import { rarityBreakdown, summarizeAchievements } from '@/lib/gamification/achievements';
import { CareerData, loadCareerData } from '@/lib/gamification/careerData';
import { formatCompact } from '@/lib/gamification/careerStats';
import { RARITY_META } from '@/lib/gamification/rarity';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { HEAT_OPACITIES, heatLevel, SPLIT_META, TrainingSplit } from '@/lib/gamification/trainingHeatmap';
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
  const statItems = [
    { v: `${formatCompact(data.stats.totalVolume)}`, u: data.stats.unit, l: 'lifted', accent: false },
    { v: formatCompact(data.stats.totalWorkouts), u: '', l: 'workouts', accent: false },
    { v: `${data.stats.currentStreak}`, u: 'd', l: 'streak', accent: streakActive },
    { v: formatCompact(data.stats.daysActive), u: '', l: 'days', accent: false },
  ];

  const { nextUp, unlockedCount, total } = summarizeAchievements(data.achievements);
  const rarity = rarityBreakdown(data.achievements);
  const achProgress = total > 0 ? unlockedCount / total : 0;

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

          {/* Strength hero — full-width now the emblem is gone; the percentile
              counts up and its progress bar fills on load. */}
          <View style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={[styles.tierPill, { backgroundColor: color + '1A', borderColor: color }]}>
                <Text style={[styles.tierPillText, { color }]}>{data.tier} TIER</Text>
              </View>
            </View>
            <View style={styles.percentileRow}>
              <AnimatedCount
                value={data.overall}
                duration={1100}
                style={[styles.percentile, { color: currentTheme.colors.text }]}
              />
              <Text style={[styles.percentileLabel, { color: currentTheme.colors.text }]}> percentile</Text>
            </View>
            <AnimatedBar
              progress={band.progress}
              color={color}
              trackColor={currentTheme.colors.border}
              height={8}
              delay={150}
              style={styles.heroBar}
            />
            <Text style={[styles.toNext, { color: currentTheme.colors.text }]}>
              {band.nextTier ? `${band.toNext} to ${band.nextTier}` : 'Max tier reached'}
            </Text>
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
                            ? { backgroundColor: SPLIT_META[cell.split ?? 'other'].color, opacity: HEAT_OPACITIES[heatLevel(cell.intensity)] }
                            : { backgroundColor: currentTheme.colors.border, opacity: 0.45 },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>

            {/* Color = which split (Push/Pull/Legs); opacity = Less→More volume. */}
            <View style={styles.legendRow}>
              {(['push', 'pull', 'legs'] as TrainingSplit[]).map(s => (
                <View key={s} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SPLIT_META[s].color }]} />
                  <Text style={[styles.legendText, { color: currentTheme.colors.text }]}>{SPLIT_META[s].label}</Text>
                </View>
              ))}
              <View style={styles.legendSpacer} />
              <Text style={[styles.legendText, { color: currentTheme.colors.text }]}>Less</Text>
              {HEAT_OPACITIES.map((op, i) => (
                <View
                  key={i}
                  style={[styles.legendCell, { backgroundColor: currentTheme.colors.text, opacity: op }]}
                />
              ))}
              <Text style={[styles.legendText, { color: currentTheme.colors.text }]}>More</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />

          {/* Next goal — tap to flip for what it takes */}
          {nextUp && (
            <FlipCard
              height={48}
              style={styles.nextWrap}
              front={
                <View style={styles.nextGoalFace}>
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
              }
              back={
                <View style={styles.nextGoalBack}>
                  <Text style={[styles.nextBackText, { color: currentTheme.colors.text }]} numberOfLines={2}>
                    {nextUp.description}
                  </Text>
                  <Text style={[styles.nextBackPct, { color: currentTheme.colors.primary }]}>
                    {Math.round(nextUp.progress * 100)}%
                  </Text>
                </View>
              }
            />
          )}

          {/* Achievements — a flippable bar: collection progress on the front,
              rarity breakdown on the back. Full grid lives in the modal. */}
          <FlipCard
            height={60}
            style={styles.achWrap}
            front={
              <View style={styles.achFace}>
                <View style={styles.achTopRow}>
                  <Text style={[styles.achLabel, { color: currentTheme.colors.text }]}>ACHIEVEMENTS</Text>
                  <View style={styles.achTopRight}>
                    {data.newIds.size > 0 && (
                      <View style={[styles.achNewPill, { backgroundColor: currentTheme.colors.primary }]}>
                        <Text style={[styles.achNewPillText, { color: currentTheme.colors.surface }]}>
                          {data.newIds.size} NEW
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.achBig, { color: currentTheme.colors.text }]}>
                      {unlockedCount}
                      <Text style={[styles.achBigTotal, { color: currentTheme.colors.text }]}>/{total}</Text>
                    </Text>
                  </View>
                </View>
                <AnimatedBar
                  progress={achProgress}
                  color={currentTheme.colors.primary}
                  trackColor={currentTheme.colors.border}
                  height={6}
                  delay={250}
                />
              </View>
            }
            back={
              <View style={styles.achBackFace}>
                {rarity.map(rb => {
                  const rc = RARITY_META[rb.rarity].accent;
                  return (
                    <View key={rb.rarity} style={styles.rarityCell}>
                      <View style={[styles.rarityDot, { backgroundColor: rc, opacity: rb.unlocked > 0 ? 1 : 0.3 }]} />
                      <Text style={[styles.rarityCount, { color: currentTheme.colors.text }]}>
                        {rb.unlocked}/{rb.total}
                      </Text>
                      <Text style={[styles.rarityLabel, { color: rc }]}>{RARITY_META[rb.rarity].label}</Text>
                    </View>
                  );
                })}
              </View>
            }
          />
        </Card>
      </TouchableOpacity>

      <CareerModal visible={showModal} onClose={() => { setShowModal(false); load(); }} />
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

  hero: { gap: 6 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' },
  tierPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  tierPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  percentileRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  percentile: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  percentileLabel: { fontSize: 13, fontWeight: '400', opacity: 0.5 },
  heroBar: { marginTop: 8 },
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
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 9, opacity: 0.55 },
  legendSpacer: { flex: 1, minWidth: 8 },
  legendCell: { width: 9, height: 9, borderRadius: 2 },

  nextWrap: { width: '100%' },
  nextGoalFace: { width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextGoalBack: { width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nextBody: { flex: 1 },
  nextLabel: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
  nextBackText: { flex: 1, fontSize: 12, opacity: 0.7, lineHeight: 16 },
  nextBackPct: { fontSize: 14, fontWeight: '700' },
  nextTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  nextFill: { height: 5, borderRadius: 3 },
  nextCount: { fontSize: 12, fontWeight: '700', opacity: 0.6 },

  achWrap: { width: '100%' },
  achFace: { width: '100%', height: '100%', justifyContent: 'center', gap: 10 },
  achTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.5 },
  achTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  achNewPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  achNewPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  achBig: { fontSize: 18, fontWeight: '800' },
  achBigTotal: { fontSize: 13, fontWeight: '600', opacity: 0.45 },
  achBackFace: { width: '100%', height: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rarityCell: { alignItems: 'center', gap: 3, flex: 1 },
  rarityDot: { width: 8, height: 8, borderRadius: 4 },
  rarityCount: { fontSize: 13, fontWeight: '800' },
  rarityLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
});
