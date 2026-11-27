// Home's "Last 14 days" panel: six compact tiles (sessions, volume, work, PRs,
// split, most improved lift), each against the two weeks before. Math lives in
// lib/history/last14Days.ts; "most improved" reuses recap14's noise-guarded
// e1RM comparison and opens the lift's history. Tiles share the League card's surface, and every
// cells are flat and ruled; marks are neutral ink (tier hue is for strength).
import SoftBar from '@/components/ui/SoftBar';
import { Text, useInk } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import ExerciseHistoryModal from '@/components/history/ExerciseHistoryModal';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { PPL_LABELS, PPLCategory } from '@/lib/data/pplCategories';
import { buildExerciseStats } from '@/lib/history/exerciseStats';
import { computeLast14Days, Last14Days, WindowDelta } from '@/lib/history/last14Days';
import { computeRecap14, MostImproved } from '@/lib/history/recap14';
import { storageService } from '@/lib/storage/storage';
import { radius, space } from '@/lib/ui/tokens';
import { formatCompact, formatVolume } from '@/lib/utils/utils';
import { convertWeight, ExerciseWithMax, LoggedWorkout, WeightUnit } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  /** Optional accent; defaults to neutral ink (Swiss color budget: hue is for strength only). */
  accent?: string;
}

const SPLIT_ORDER: PPLCategory[] = ['push', 'pull', 'legs'];

export default function Last14DaysGrid({ accent: accentProp }: Props) {
  const inkTop = useInk();
  const accent = accentProp ?? inkTop.primary;
  const { userProfile } = useUser();
  const unit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';
  const { customExercises } = useCustomExercises();
  const [data, setData] = useState<Last14Days | null>(null);
  const [history, setHistory] = useState<LoggedWorkout[]>([]);
  const [improved, setImproved] = useState<MostImproved | null>(null);
  const [historyExercise, setHistoryExercise] = useState<ExerciseWithMax | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      storageService
        .getWorkoutHistory()
        .then(h => {
          if (cancelled) return;
          const now = new Date();
          setHistory(h);
          setData(computeLast14Days(h, now));
          setImproved(computeRecap14(h, unit, now).mostImproved);
        })
        .catch(error => console.error('Error loading 14-day stats:', error));
      return () => {
        cancelled = true;
      };
    }, [unit]),
  );

  const openImproved = () => {
    if (!improved) return;
    const stats = buildExerciseStats(history, customExercises, unit).find(e => e.id === improved.exerciseId);
    if (stats) setHistoryExercise(stats);
  };

  if (!data) return null;

  const weight = (lbs: number) => `${Math.round(convertWeight(lbs, 'lbs', unit))} ${unit}`;
  const topPr = data.prs[0];

  return (
    <View style={styles.section}>
      <SectionLabel>Last 14 days</SectionLabel>
      <View style={styles.grid}>
        <Tile label="Sessions" value={String(data.sessions.current)} accent={accent}>
          <DeltaLine d={data.sessions} accent={accent} />
          <DayDots values={data.sessionsByDay} accent={accent} />
        </Tile>

        <Tile label="Volume" value={formatVolume(data.volumeLbs.current, unit)} accent={accent}>
          <DeltaLine d={data.volumeLbs} accent={accent} />
          <DayBars values={data.volumeByDay} accent={accent} />
        </Tile>

        <Tile label="Work" value={`${data.sets.current} sets`} accent={accent}>
          <Text variant="meta" tone="secondary" numberOfLines={1}>
            {formatCompact(data.reps)} reps · {data.activeDays}/14 days
          </Text>
          <DeltaLine d={data.sets} accent={accent} />
        </Tile>

        <Tile label="PRs" value={String(data.prs.length)} accent={accent} highlight={data.prs.length > 0}>
          <Text variant="meta" tone="secondary" numberOfLines={1}>
            {topPr ? topPr.name : 'None yet'}
          </Text>
          <Text variant="meta" tone="muted" numberOfLines={1}>
            {topPr
              ? topPr.gainLbs > 0
                ? `+${weight(topPr.gainLbs)} e1RM`
                : `First log · ${weight(topPr.e1rmLbs)}`
              : 'Beat a best'}
          </Text>
        </Tile>

        <Tile label="Split" accent={accent}>
          <SplitBars split={data.split} accent={accent} />
        </Tile>

        {improved ? (
          <TouchableOpacity style={styles.tileTouch} onPress={openImproved} activeOpacity={0.8} accessibilityRole="button">
            <Tile label="Most improved" value={improved.name} accent={accent} compactValue fill>
              <Text variant="meta" weight="semiBold" style={{ color: accent }} numberOfLines={1}>
                +{improved.deltaPct}% e1RM
              </Text>
              <Text variant="meta" tone="muted" numberOfLines={1}>
                {improved.fromE1rm} → {improved.toE1rm} {unit}
              </Text>
            </Tile>
          </TouchableOpacity>
        ) : (
          <Tile label="Top lift" value={data.topLift?.name ?? '—'} accent={accent} compactValue>
            <Text variant="meta" tone="secondary" numberOfLines={1}>
              {data.topLift
                ? `${data.topLift.sets} sets${data.topLift.bestE1rmLbs > 0 ? ` · ${weight(data.topLift.bestE1rmLbs)}` : ''}`
                : 'Log a session'}
            </Text>
          </Tile>
        )}
      </View>

      <ExerciseHistoryModal exercise={historyExercise} weightUnit={unit} onClose={() => setHistoryExercise(null)} />
    </View>
  );
}

function Tile({
  label,
  value,
  accent,
  highlight,
  compactValue,
  fill,
  children,
}: {
  /** Fill the parent (when wrapped in a touchable that owns the grid width). */
  fill?: boolean;
  label: string;
  value?: string;
  accent: string;
  highlight?: boolean;
  compactValue?: boolean;
  children?: React.ReactNode;
}) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  return (
    <View style={[styles.tile, fill && styles.tileFill, { borderColor: ink.hairline }]}>
      <Text variant="meta" weight="semiBold" tone="muted">{label}</Text>
      {value != null && (
        <Text
          variant={compactValue ? 'emphasis' : 'statHero'}
          weight="bold"
          tone={highlight ? undefined : 'primary'}
          style={[styles.value, highlight && { color: accent }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      )}
      <View style={styles.tileBody}>{children}</View>
    </View>
  );
}

function DeltaLine({ d, accent }: { d: WindowDelta; accent: string }) {
  if (d.pct == null) {
    return <Text variant="meta" tone="muted" numberOfLines={1}>{d.current > 0 ? 'New vs prior 14d' : 'Nothing logged'}</Text>;
  }
  const up = d.pct >= 0;
  return (
    <Text variant="meta" tone="muted" numberOfLines={1}>
      <Text variant="meta" weight="semiBold" tone={up ? undefined : 'secondary'} style={up ? { color: accent } : undefined}>
        {up ? '▲' : '▼'} {Math.abs(d.pct)}%
      </Text>
      {' vs prior'}
    </Text>
  );
}

function DayDots({ values, accent }: { values: number[]; accent: string }) {
  const ink = useInk();
  return (
    <View style={styles.dots}>
      {values.map((n, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: n > 0 ? accent : ink.ghost }]} />
      ))}
    </View>
  );
}

function DayBars({ values, accent }: { values: number[]; accent: string }) {
  const ink = useInk();
  const max = Math.max(...values, 1);
  return (
    <View style={styles.bars}>
      {values.map((v, i) => (
        <View key={i} style={styles.barSlot}>
          <View
            style={[
              styles.bar,
              { height: v > 0 ? `${Math.max(12, (v / max) * 100)}%` : 2, backgroundColor: v > 0 ? accent : ink.ghost },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function SplitBars({ split, accent }: { split: Record<PPLCategory, number>; accent: string }) {
  const ink = useInk();
  const total = SPLIT_ORDER.reduce((s, k) => s + split[k], 0);
  if (total === 0) {
    return <Text variant="meta" tone="muted">No sets yet</Text>;
  }
  return (
    <View style={styles.split}>
      {SPLIT_ORDER.map(k => (
        <View key={k} style={styles.splitRow}>
          <Text variant="meta" tone="secondary" style={styles.splitLabel}>{PPL_LABELS[k]}</Text>
          <SoftBar progress={((split[k] / total) * 100) / 100} color={accent} />
          <Text variant="meta" tone="muted" style={styles.splitCount}>{split[k]}</Text>
        </View>
      ))}
    </View>
  );
}

const TILE_HEIGHT = 128;

const styles = StyleSheet.create({
  section: { marginTop: space.lg },
  // Swiss: two ruled columns, no filled tiles — each cell has a hairline above.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tileTouch: { width: '48.5%' },
  tileFill: { width: '100%' },
  tile: {
    width: '48.5%',
    height: TILE_HEIGHT,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  value: { fontVariant: ['tabular-nums'] },
  tileBody: { flex: 1, justifyContent: 'flex-end', gap: 2 },
  dots: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 22, gap: 2, marginTop: space.xs },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 2 },
  split: { gap: space.xs, marginTop: space.xs },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  splitLabel: { width: 40 },
  splitTrack: { flex: 1, height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  splitFill: { height: '100%', borderRadius: radius.pill },
  splitCount: { minWidth: 20, textAlign: 'right' },
});
