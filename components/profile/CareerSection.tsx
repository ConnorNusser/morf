import AnimatedBar from '@/components/AnimatedBar';
import AnimatedCount from '@/components/AnimatedCount';
import Card from '@/components/Card';
import CareerModal from '@/components/gamification/CareerModal';
import FlipCard from '@/components/gamification/FlipCard';
import TierBadge from '@/components/TierBadge';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor } from '@/lib/data/strengthStandards';
import { rarityBreakdown, summarizeAchievements } from '@/lib/gamification/achievements';
import { CareerData, loadCareerData } from '@/lib/gamification/careerData';
import { formatCompact } from '@/lib/gamification/careerStats';
import { RARITY_META } from '@/lib/gamification/rarity';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { HEAT_OPACITIES, heatLevel } from '@/lib/gamification/trainingHeatmap';
import { panelPad, radius, space } from '@/lib/ui/tokens';
import { type as typeScale } from '@/lib/ui/typography';
import { PPL_COLORS, PPL_LABELS, PPLCategory } from '@/lib/data/pplCategories';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

// Inline Career section for the Profile: tier hero, lifetime stats, next goal and achievement preview; tap opens the full Career modal.
export default function CareerSection() {
  const { currentTheme } = useTheme();
  const ink = useInk();
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
    { v: `${data.stats.currentStreak}`, u: 'w', l: 'streak', accent: streakActive },
    { v: formatCompact(data.stats.daysActive), u: '', l: 'days', accent: false },
  ];

  const { nextUp, unlockedCount, total } = summarizeAchievements(data.achievements);
  const rarity = rarityBreakdown(data.achievements);
  const achProgress = total > 0 ? unlockedCount / total : 0;

  const recentWeeks = data.heatmap.weeks.slice(-8);
  const recentActive = recentWeeks.reduce((n, wk) => n + wk.filter(c => c.trained).length, 0);

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={open}>
        <Card style={styles.card} padding={panelPad}>
          <View style={styles.headerRow}>
            <Text variant="heading" weight="bold" tone="primary">Career</Text>
            <View style={styles.headerRight}>
              {data.newIds.size > 0 && (
                <View style={[styles.newBadge, { backgroundColor: currentTheme.colors.primary }]}>
                  <Text variant="meta" weight="bold" style={{ color: currentTheme.colors.surface }}>
                    {data.newIds.size} new
                  </Text>
                </View>
              )}
              <Text variant="meta" weight="semiBold">View all</Text>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.primary} />
            </View>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <AnimatedCount
                  value={data.overall}
                  duration={1100}
                  style={[styles.percentile, { color: currentTheme.colors.text }]}
                />
                <Text variant="meta" tone="muted" style={styles.heroStatLabel}>percentile</Text>
              </View>
              <View style={styles.heroStat}>
                <TierBadge tier={data.tier} size="large" variant="text" showTooltip={false} />
                <Text variant="meta" tone="muted" style={styles.heroStatLabel}>tier</Text>
              </View>
            </View>
            <AnimatedBar
              progress={band.progress}
              color={color}
              trackColor={ink.hairline}
              height={8}
              delay={150}
              style={styles.heroBar}
            />
            <Text variant="meta" tone="muted" style={styles.toNext}>
              {band.nextTier ? `${band.toNext} to ${band.nextTier}` : 'Max tier reached'}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: ink.hairline }]} />

          <View style={[styles.statRow, { borderColor: currentTheme.colors.border }]}>
            {statItems.map(s => (
              <View key={s.l} style={styles.stat}>
                <Text
                  variant="emphasis"
                  weight="bold"
                  tone={s.accent ? undefined : 'primary'}
                  numberOfLines={1}
                >
                  {s.v}
                  {s.u ? (
                    <Text
                      variant="meta"
                      weight="semiBold"
                      style={[styles.statUnit, { color: s.accent ? currentTheme.colors.primary : currentTheme.colors.text }]}
                    >
                      {s.u}
                    </Text>
                  ) : null}
                </Text>
                <Text variant="meta" tone="muted" style={styles.statLabel}>{s.l}</Text>
              </View>
            ))}
          </View>

          <View style={styles.consistency}>
            <View style={styles.consistencyHead}>
              <Text variant="meta" weight="bold" tone="muted" style={styles.consistencyLabel}>ACTIVITY</Text>
              <Text variant="meta" tone="muted">
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
                            ? { backgroundColor: cell.split ? PPL_COLORS[cell.split] : currentTheme.colors.primary, opacity: HEAT_OPACITIES[heatLevel(cell.intensity)] }
                            : { backgroundColor: currentTheme.colors.surface },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>

            {/* Color = Push/Pull/Legs; bolder cells = more volume that day. */}
            <View style={styles.legendRow}>
              {(['push', 'pull', 'legs'] as PPLCategory[]).map(s => (
                <View key={s} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: PPL_COLORS[s] }]} />
                  <Text variant="meta" tone="muted">{PPL_LABELS[s]}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: ink.hairline }]} />

          {nextUp && (
            <FlipCard
              height={48}
              style={styles.nextWrap}
              front={
                <View style={styles.nextGoalFace}>
                  <View style={styles.nextBody}>
                    <Text variant="meta" weight="semiBold" tone="primary" style={styles.nextLabel} numberOfLines={1}>
                      NEXT · {nextUp.title}
                    </Text>
                    <View style={[styles.nextTrack, { backgroundColor: ink.hairline }]}>
                      <View
                        style={[styles.nextFill, { backgroundColor: currentTheme.colors.primary, width: `${Math.round(nextUp.progress * 100)}%` }]}
                      />
                    </View>
                  </View>
                  <Text variant="meta" weight="bold" tone="muted">
                    {formatCompact(nextUp.current)}/{formatCompact(nextUp.target)}
                  </Text>
                </View>
              }
              back={
                <View style={styles.nextGoalBack}>
                  <Text variant="meta" tone="secondary" style={styles.nextBackText} numberOfLines={2}>
                    {nextUp.description}
                  </Text>
                  <Text variant="meta" weight="bold">
                    {Math.round(nextUp.progress * 100)}%
                  </Text>
                </View>
              }
            />
          )}

          <FlipCard
            height={60}
            style={styles.achWrap}
            front={
              <View style={styles.achFace}>
                <View style={styles.achTopRow}>
                  <Text variant="meta" weight="bold" tone="muted" style={styles.achLabel}>ACHIEVEMENTS</Text>
                  <View style={styles.achTopRight}>
                    {data.newIds.size > 0 && (
                      <View style={[styles.achNewPill, { backgroundColor: currentTheme.colors.primary }]}>
                        <Text variant="meta" weight="bold" style={[styles.achNewPillText, { color: currentTheme.colors.surface }]}>
                          {data.newIds.size} NEW
                        </Text>
                      </View>
                    )}
                    <Text variant="emphasis" weight="bold" tone="primary">
                      {unlockedCount}
                      <Text variant="meta" weight="semiBold" tone="muted">/{total}</Text>
                    </Text>
                  </View>
                </View>
                <AnimatedBar
                  progress={achProgress}
                  color={currentTheme.colors.primary}
                  trackColor={ink.hairline}
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
                      <Text variant="meta" weight="bold" tone="primary">
                        {rb.unlocked}/{rb.total}
                      </Text>
                      <Text variant="meta" weight="bold" style={[styles.rarityLabel, { color: rc }]}>{RARITY_META[rb.rarity].label}</Text>
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
  card: { gap: space.lg },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.7 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  newBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.badge, marginRight: space.xs },

  hero: { gap: space.sm },
  heroStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroStat: { alignItems: 'center' },
  percentile: { fontSize: typeScale.hero, fontWeight: '800', lineHeight: 33, letterSpacing: -0.5 },
  heroStatLabel: { marginTop: space.xs },
  heroBar: { marginTop: space.md },
  toNext: { marginTop: space.sm },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.lg },
  stat: { alignItems: 'center', flex: 1 },
  statUnit: { opacity: 0.6 },
  statLabel: { marginTop: space.xs },

  consistency: { gap: space.sm },
  consistencyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  consistencyLabel: { letterSpacing: 1 },
  heatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heatCol: { gap: 3 },
  heatCell: { width: 12, height: 12, borderRadius: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendDot: { width: 9, height: 9, borderRadius: 3 },

  nextWrap: { width: '100%' },
  nextGoalFace: { width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', gap: space.md },
  nextGoalBack: { width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  nextBody: { flex: 1 },
  nextLabel: { marginBottom: space.xs },
  nextBackText: { flex: 1, lineHeight: 19 },
  nextTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  nextFill: { height: 5, borderRadius: 3 },

  achWrap: { width: '100%' },
  achFace: { width: '100%', height: '100%', justifyContent: 'center', gap: space.md },
  achTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achLabel: { letterSpacing: 1 },
  achTopRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  achNewPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.badge },
  achNewPillText: { letterSpacing: 0.3 },
  achBackFace: { width: '100%', height: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rarityCell: { alignItems: 'center', gap: 3, flex: 1 },
  rarityDot: { width: 8, height: 8, borderRadius: 4 },
  rarityLabel: { letterSpacing: 0.3, textTransform: 'uppercase' },
});
