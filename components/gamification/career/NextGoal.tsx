import FlipCard from '@/components/gamification/FlipCard';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { Achievement, summarizeAchievements } from '@/lib/gamification/achievements';
import { formatCompact } from '@/lib/gamification/careerStats';
import { radius, space, tint, track, withAlpha } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

// ---- Next goal: the closest locked achievement, to chase ----
export default function NextGoal({ achievements }: { achievements: Achievement[] }) {
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

const styles = StyleSheet.create({
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
});
