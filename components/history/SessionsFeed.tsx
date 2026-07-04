// The Sessions feed — History's reflective centerpiece. Replaces the abstract
// Strength Index with a re-livable record of each gym session: the latest workout
// as a cinematic hero recap, past sessions as narrative moment cards. Every card
// leads with meaning (a headline or the standout set), not a stat dump.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { formatCompact } from '@/lib/utils/utils';
import { SessionRecap } from '@/lib/history/sessionRecap';
import { NextMilestone } from '@/lib/history/milestones';
import { GeneratedWorkout, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

const POS = '#34C759';

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Asymmetric by design: a bigger session is celebrated (green), a lighter one is
// stated neutrally, never punished with an alarm color. The research is clear that
// "failure"-framed regressions drive avoidance, so a deload should read as information,
// not a red mark.
function DeltaPill({ pct }: { pct: number }) {
  const { currentTheme } = useTheme();
  if (pct === 0) return null;
  const up = pct > 0;
  const color = up ? POS : currentTheme.colors.text + '70';
  return (
    <RNView style={styles.deltaRow}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={color} />
      <Text style={[styles.deltaText, { color, fontFamily: currentTheme.fonts.semiBold }]}>
        {Math.abs(pct)}%
      </Text>
    </RNView>
  );
}

function MuscleRow({ muscles }: { muscles: string[] }) {
  const { currentTheme } = useTheme();
  if (muscles.length === 0) return null;
  return (
    <RNView style={styles.muscleRow}>
      {muscles.slice(0, 4).map(m => (
        <RNView key={m} style={[styles.muscleChip, { backgroundColor: currentTheme.colors.text + '0D' }]}>
          <Text style={[styles.muscleText, { color: currentTheme.colors.text + 'AA', fontFamily: currentTheme.fonts.medium }]}>
            {titleCase(m)}
          </Text>
        </RNView>
      ))}
    </RNView>
  );
}

// ── the latest session, given the cinematic treatment ────────────────────────
function SessionHero({ recap, weightUnit, onPress }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  onPress: (w: GeneratedWorkout) => void;
}) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const isPR = !!recap.pr;
  // The trophy is reserved for MAJOR records so celebration stays rare and meaningful
  // (badge spam reads as childish and de-motivating past a point). Standard PRs still
  // earn the narrative headline, just not the icon.
  const showTrophy = recap.pr?.tier === 'major';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(recap.workout)}
      style={[styles.hero, { backgroundColor: colors.surface, borderColor: showTrophy ? colors.primary + '55' : colors.border }]}
    >
      {/* eyebrow: when · what */}
      <RNView style={styles.heroEyebrow}>
        <Text style={[styles.eyebrowText, { color: colors.primary, fontFamily: fonts.semiBold }]}>
          {formatRelativeDate(recap.workout.createdAt).toUpperCase()} · {recap.title}
        </Text>
        {showTrophy && (
          <RNView style={[styles.prChip, { backgroundColor: colors.primary }]}>
            <Ionicons name="trophy" size={10} color="#fff" />
            <Text style={[styles.prChipText, { color: '#fff', fontFamily: fonts.semiBold }]}>PR</Text>
          </RNView>
        )}
      </RNView>

      {/* the emotional hook: a narrative headline, else the standout lift name */}
      <Text style={[styles.heroHeadline, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={2}>
        {recap.headline ?? (recap.standout ? `${recap.standout.name}` : recap.title)}
      </Text>

      {/* the standout moment as a big, re-livable stat. Subtitle never repeats the
          headline: on a PR it quantifies the record, otherwise it names the lift. */}
      {recap.standout && (
        <RNView style={styles.heroStandout}>
          <Text style={[styles.standoutValue, { color: colors.text, fontFamily: fonts.bold }]}>
            {recap.standout.weight > 0 ? `${recap.standout.weight}` : recap.standout.reps}
            <Text style={[styles.standoutUnit, { color: colors.text + '70', fontFamily: fonts.medium }]}>
              {recap.standout.weight > 0 ? ` ${weightUnit} × ${recap.standout.reps}` : ' reps'}
            </Text>
          </Text>
          <Text style={[styles.standoutName, { color: colors.text + '80', fontFamily: fonts.medium }]} numberOfLines={1}>
            {isPR
              ? `${recap.standout.name} · +${recap.prGainDisplay} ${weightUnit} over your best`
              : recap.headline
                ? recap.standout.name
                : 'top set'}
          </Text>
        </RNView>
      )}

      {/* how it stacks up */}
      {recap.comparison && recap.comparison.deltaVolumePct !== 0 && (
        <RNView style={styles.heroCompare}>
          <DeltaPill pct={recap.comparison.deltaVolumePct} />
          <Text style={[styles.compareText, { color: colors.text + '70', fontFamily: fonts.regular }]}>
            volume vs {recap.comparison.refLabel}
          </Text>
        </RNView>
      )}

      <MuscleRow muscles={recap.muscles} />

      {/* effort footer */}
      <RNView style={[styles.heroFooter, { borderTopColor: colors.border }]}>
        <FooterStat label="Volume" value={`${formatCompact(recap.volumeDisplay)} ${weightUnit}`} />
        <FooterStat label="Sets" value={`${recap.sets}`} />
        <FooterStat label="Time" value={`${recap.durationMin}m`} />
      </RNView>
    </TouchableOpacity>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  const { currentTheme } = useTheme();
  return (
    <RNView style={styles.footerStat}>
      <Text style={[styles.footerValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>{value}</Text>
      <Text style={[styles.footerLabel, { color: currentTheme.colors.text + '55', fontFamily: currentTheme.fonts.regular }]}>{label}</Text>
    </RNView>
  );
}

// ── a past session as a compact moment card ──────────────────────────────────
function MomentCard({ recap, weightUnit, onPress }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  onPress: (w: GeneratedWorkout) => void;
}) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const standoutLine = recap.standout
    ? `${recap.standout.name} · ${recap.standout.weight > 0 ? `${recap.standout.weight} ${weightUnit} × ${recap.standout.reps}` : `${recap.standout.reps} reps`}`
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(recap.workout)}
      style={[styles.moment, { borderBottomColor: colors.border }]}
    >
      <RNView style={styles.momentTop}>
        <Text style={[styles.momentWhen, { color: colors.text + '70', fontFamily: fonts.medium }]}>
          {formatRelativeDate(recap.workout.createdAt)} · {recap.title}
        </Text>
        {recap.pr?.tier === 'major' && (
          <RNView style={[styles.prDot, { backgroundColor: colors.primary }]}>
            <Ionicons name="trophy" size={9} color="#fff" />
          </RNView>
        )}
      </RNView>

      {/* lead with the headline if there is one, else the standout set */}
      <Text style={[styles.momentLead, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
        {recap.headline ?? standoutLine ?? recap.title}
      </Text>

      <RNView style={styles.momentMeta}>
        <Text style={[styles.momentMetaText, { color: colors.text + '60', fontFamily: fonts.regular }]} numberOfLines={1}>
          {recap.headline && standoutLine ? `${standoutLine} · ` : ''}
          {formatCompact(recap.volumeDisplay)} {weightUnit} · {recap.sets} sets
        </Text>
        {recap.comparison && recap.comparison.deltaVolumePct !== 0 && (
          <DeltaPill pct={recap.comparison.deltaVolumePct} />
        )}
      </RNView>
    </TouchableOpacity>
  );
}

interface SessionsFeedProps {
  recaps: SessionRecap[];
  weightUnit: WeightUnit;
  visibleCount: number;
  milestone?: NextMilestone | null;
  onPressSession: (w: GeneratedWorkout) => void;
  onToggleShowAll?: () => void;
  totalCount: number;
}

export default function SessionsFeed({ recaps, weightUnit, visibleCount, milestone, onPressSession, onToggleShowAll, totalCount }: SessionsFeedProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  if (recaps.length === 0) return null;

  const [hero, ...rest] = recaps;
  const moments = rest.slice(0, Math.max(0, visibleCount - 1));
  const hasMore = totalCount > visibleCount;

  return (
    <RNView>
      {/* Forward pull: the target you're closest to actually hitting (goal-gradient) —
          turns looking back into a reason to come back. */}
      {milestone && (
        <RNView style={styles.milestone}>
          <Ionicons name="flag" size={13} color={colors.primary} />
          <Text style={[styles.milestoneText, { color: colors.text + 'CC', fontFamily: fonts.medium }]} numberOfLines={1}>
            <Text style={{ color: colors.primary, fontFamily: fonts.semiBold }}>{milestone.gap} {milestone.unit}</Text>
            {' '}from a {milestone.label}
          </Text>
        </RNView>
      )}
      <SessionHero recap={hero} weightUnit={weightUnit} onPress={onPressSession} />
      {moments.length > 0 && (
        <RNView style={styles.momentsList}>
          {moments.map(r => (
            <MomentCard key={r.workout.id} recap={r} weightUnit={weightUnit} onPress={onPressSession} />
          ))}
        </RNView>
      )}
      {onToggleShowAll && (hasMore || visibleCount > 6) && (
        <TouchableOpacity style={styles.viewAll} onPress={onToggleShowAll} activeOpacity={0.7}>
          <Text style={[styles.viewAllText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>
            {hasMore ? `View all ${totalCount} sessions` : 'Show less'}
          </Text>
        </TouchableOpacity>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  // hero
  hero: { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 8 },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eyebrowText: { fontSize: 12, letterSpacing: 0.4 },
  heroHeadline: { fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  heroStandout: { marginTop: 14 },
  standoutValue: { fontSize: 34, letterSpacing: -1 },
  standoutUnit: { fontSize: 18, letterSpacing: -0.3 },
  standoutName: { fontSize: 13, marginTop: 1 },
  heroCompare: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  compareText: { fontSize: 13 },
  heroFooter: { flexDirection: 'row', gap: 24, marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footerStat: {},
  footerValue: { fontSize: 15 },
  footerLabel: { fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  // shared
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  deltaText: { fontSize: 13 },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  muscleChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
  muscleText: { fontSize: 12 },
  prChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  prChipText: { fontSize: 10, letterSpacing: 0.5 },
  // moments
  momentsList: { marginTop: 8 },
  moment: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  momentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  momentWhen: { fontSize: 12, letterSpacing: 0.2 },
  prDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  momentLead: { fontSize: 15, lineHeight: 20, letterSpacing: -0.2, marginTop: 4 },
  momentMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, gap: 8 },
  momentMetaText: { flex: 1, fontSize: 12, lineHeight: 16 },
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: 14 },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  milestoneText: { fontSize: 13, flex: 1 },
});
