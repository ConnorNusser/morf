import { Text, View } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import AchievementBadge from '@/components/gamification/AchievementBadge';
import AnimatedCounter from '@/components/workout/workoutComplete/AnimatedCounter';
import { getStrengthTier, getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { ACHIEVEMENT_EMBLEMS } from '@/lib/gamification/achievementEmblems';
import { RARITY_META } from '@/lib/gamification/rarity';
import { SessionRewards } from '@/lib/gamification/sessionRewards';
import {
  CardVariant,
  cardTitleFor,
  LiftSpotlight,
  PRInfo,
  shortName,
} from '@/lib/gamification/sessionShareCard';
import { space, track, trend } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { getPercentileSuffix } from '@/lib/utils/utils';
import { WeightUnit } from '@/types';
import React from 'react';
import { StyleSheet } from 'react-native';

export const CARD_HAIRLINE = 'rgba(255,255,255,0.08)';

export interface ShareCardBodyProps {
  activeVariant: CardVariant;
  liftSpotlight: LiftSpotlight | null;
  prs: PRInfo[];
  spotlightAchievement: SessionRewards['newAchievements'][number] | null;
  volumeDisplay: string | null;
  overallTier: StrengthTier | null;
  overallAfter: number;
  stats: {
    exercises: number;
    sets: number;
    durationStr: string;
  };
  title?: string | null;
  weightUnit: WeightUnit;
}

// Middle of the card, by layout. One message per card — a single dominant
// number the eye lands on first, one support line, and nothing that repeats.
// (Shareable-card psychology: the hero stat carries the post; extra rows
// read as UI, not a flex.)
export default function ShareCardBody({
  activeVariant,
  liftSpotlight,
  prs,
  spotlightAchievement,
  volumeDisplay,
  overallTier,
  overallAfter,
  stats,
  title,
  weightUnit,
}: ShareCardBodyProps) {
  return activeVariant === 'lift' && liftSpotlight ? (
    <View style={styles.cardHero}>
      <Text variant="meta" weight="bold" style={styles.cardLabel}>
        {liftSpotlight.name.toUpperCase()}
      </Text>
      <Text
        style={[
          styles.cardHeroTier,
          { color: getTierColor(getStrengthTier(liftSpotlight.percentile)) },
        ]}
      >
        {liftSpotlight.percentile}
        {getPercentileSuffix(liftSpotlight.percentile)}
      </Text>
      <Text variant="body" weight="semiBold" style={styles.cardHeroLine}>
        Stronger than {liftSpotlight.percentile}% of {liftSpotlight.name} lifters
      </Text>
      <Text variant="meta" style={styles.cardHeroMeta}>
        {liftSpotlight.e1rm} {weightUnit} 1RM
      </Text>
    </View>
  ) : activeVariant === 'volume' ? (
    <View style={styles.cardHero}>
      <Text variant="meta" weight="bold" style={styles.cardLabel}>
        WORK DONE
      </Text>
      <Text style={styles.cardHeroVolume}>{volumeDisplay}</Text>
      <Text variant="body" weight="semiBold" style={styles.cardHeroLine}>
        moved in {stats.durationStr}
      </Text>
      <Text variant="meta" style={styles.cardHeroMeta} numberOfLines={1}>
        {stats.sets} {stats.sets === 1 ? 'set' : 'sets'} · {stats.exercises}{' '}
        {stats.exercises === 1 ? 'exercise' : 'exercises'}
      </Text>
    </View>
  ) : activeVariant === 'achievement' && spotlightAchievement ? (
    <View style={styles.cardHero}>
      <AchievementBadge
        icon={spotlightAchievement.icon}
        emblem={ACHIEVEMENT_EMBLEMS[spotlightAchievement.id]}
        rarity={spotlightAchievement.rarity}
        size={84}
      />
      <Text
        variant="meta"
        weight="bold"
        style={[
          styles.cardLabel,
          styles.cardAchLabel,
          { color: RARITY_META[spotlightAchievement.rarity].accent },
        ]}
      >
        {RARITY_META[spotlightAchievement.rarity].label.toUpperCase()} · UNLOCKED
      </Text>
      <Text style={styles.cardAchTitle} numberOfLines={1}>
        {spotlightAchievement.title}
      </Text>
      <Text variant="meta" style={styles.cardAchDesc} numberOfLines={2}>
        {spotlightAchievement.description}
      </Text>
    </View>
  ) : activeVariant === 'prs' ? (
    <>
      <View style={styles.cardHero}>
        <Text style={[styles.cardHeroTier, styles.cardHeroGold]}>
          {prs.length} {prs.length === 1 ? 'PR' : 'PRs'}
        </Text>
        <Text variant="body" weight="semiBold" style={styles.cardHeroLine}>
          New personal {prs.length === 1 ? 'record' : 'records'} today
        </Text>
      </View>
      <View style={[styles.cardSection, { borderTopColor: CARD_HAIRLINE }]}>
        {prs.map((pr, index) => (
          <View key={pr.exerciseId || index} style={styles.cardRow}>
            <Text variant="body" weight="semiBold" style={styles.cardRowName} numberOfLines={1}>
              {shortName(pr.exerciseName)}
            </Text>
            <View style={styles.prValueCluster}>
              <AnimatedCounter
                value={pr.newPR}
                delay={600 + index * 100}
                duration={1000}
                style={styles.prValue}
              />
              <Text variant="meta" style={styles.prUnit}>
                {weightUnit}
              </Text>
              {pr.improvement > 0 && (
                <Text variant="meta" weight="bold" style={styles.improvementText}>
                  ↑{pr.improvement}
                </Text>
              )}
              {pr.percentile != null && <TierBadge percentile={pr.percentile} size="small" />}
            </View>
          </View>
        ))}
      </View>
    </>
  ) : (
    <View style={styles.cardHero}>
      {overallTier ? (
        <>
          <Text style={[styles.cardHeroTier, { color: getTierColor(overallTier) }]}>
            {overallTier}
          </Text>
          <Text variant="body" weight="semiBold" style={styles.cardHeroLine}>
            Stronger than {overallAfter}% of lifters
          </Text>
        </>
      ) : (
        volumeDisplay && (
          <>
            <Text style={styles.cardHeroVolume}>{volumeDisplay}</Text>
            <Text variant="body" weight="semiBold" style={styles.cardHeroLine}>
              lifted today
            </Text>
          </>
        )
      )}
      <Text variant="meta" style={styles.cardHeroMeta} numberOfLines={1}>
        {cardTitleFor(title)} · {stats.durationStr}
      </Text>
    </View>
  );
}

// White-alpha palette is a named exception (screen is always dark).
const styles = StyleSheet.create({
  cardHero: {
    alignItems: 'center',
    paddingVertical: space.lg,
  },
  // The tier letter is the app's display glyph (Career hero uses 72) — sized
  // for the card, same named type-scale exception.
  cardHeroTier: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 62,
  },
  cardHeroVolume: {
    fontSize: type.header,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: track.display,
  },
  cardHeroLine: {
    color: '#fff',
    marginTop: space.xs,
  },
  cardHeroMeta: {
    color: 'rgba(255,255,255,0.55)',
    marginTop: space.sm,
  },
  cardSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
    marginBottom: space.md,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: track.caps,
    marginBottom: space.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
  },
  cardRowName: {
    color: '#fff',
    flexShrink: 1,
  },
  cardRowValue: {
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  prValueCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  prValue: {
    fontSize: type.emphasis,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  prUnit: {
    color: 'rgba(255,255,255,0.5)',
  },
  improvementText: {
    color: trend.up,
  },
  cardHeroGold: {
    color: '#FFD700',
  },
  cardAchLabel: {
    marginTop: space.lg,
    marginBottom: 0,
  },
  cardAchTitle: {
    fontSize: type.header,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: track.display,
    marginTop: space.sm,
    textAlign: 'center',
  },
  cardAchDesc: {
    color: 'rgba(255,255,255,0.55)',
    marginTop: space.sm,
    textAlign: 'center',
    lineHeight: lineHeightFor(type.meta),
  },
});
