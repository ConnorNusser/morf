// Streak sheet, opened from the Home header's flame chip: your week streak,
// this week's days vs goal, and a "workout map" — a winding trail of weeks
// (past at the bottom, upcoming above) with a "you are here" node and milestone
// flags at 4 / 8 / 12 / 26 / 52 weeks.
import { Text, useInk } from '@/components/Themed';
import ScreenModal from '@/components/ui/ScreenModal';
import SectionLabel from '@/components/ui/SectionLabel';
import TierGlass from '@/components/ui/TierGlass';
import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage/storage';
import { radius, space } from '@/lib/ui/tokens';
import { buildStreakMap, StreakMap, WeekNode } from '@/lib/workout/streakMap';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const FLAME = '#FF8A3D';
const ROW = 84;
const NODE = 44;
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function StreakMapModal({ visible, onClose }: Props) {
  const [map, setMap] = useState<StreakMap | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    Promise.all([storageService.getWorkoutHistory(), storageService.getWeeklyGoal()])
      .then(([history, goal]) => {
        if (active) setMap(buildStreakMap(history, goal));
      })
      .catch(err => console.error('StreakMapModal: failed to load', err));
    return () => {
      active = false;
    };
  }, [visible]);

  return (
    <ScreenModal visible={visible} onClose={onClose} title="Workout map" presentation="pageSheet">
      {map ? <Content map={map} /> : null}
    </ScreenModal>
  );
}

function Content({ map }: { map: StreakMap }) {
  const ink = useInk();
  const { currentTheme } = useTheme();
  const { thisWeek } = map;
  const scrollRef = useRef<ScrollView>(null);
  const trailTop = useRef(0);
  // Land on "You are here": once the trail lays out, scroll its current node into view.
  const onCurrentY = (y: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, trailTop.current + y - 260), animated: false });
  };

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <TierGlass style={styles.hero}>
        <Ionicons name="flame" size={44} color={map.current > 0 ? FLAME : ink.faint} />
        <View style={styles.flex}>
          <Text variant="screenTitle" weight="bold" tone="primary">
            {map.current}-week streak
          </Text>
          <Text variant="meta" tone="secondary">
            {map.nextMilestone
              ? `${map.weeksToNextMilestone} to go until your ${map.nextMilestone}-week flag · best ${map.longest} wk`
              : `Every milestone cleared · best ${map.longest} wk`}
          </Text>
        </View>
      </TierGlass>

      <SectionLabel>This week</SectionLabel>
      <TierGlass style={styles.week}>
        <View style={styles.dayRow}>
          {thisWeek.trainedDays.map((on, i) => (
            <View key={i} style={styles.dayCol}>
              <View
                style={[
                  styles.dayDot,
                  on ? { backgroundColor: FLAME } : { borderWidth: 1.5, borderColor: ink.hairline },
                ]}
              >
                {on ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
              </View>
              <Text variant="meta" tone="muted">{DAYS[i]}</Text>
            </View>
          ))}
        </View>
        <Text variant="meta" tone="secondary" style={styles.weekLine}>
          {thisWeek.daysTrained} of {thisWeek.goal} days
          {thisWeek.daysTrained >= thisWeek.goal
            ? ' · goal hit'
            : thisWeek.daysTrained > 0
              ? ' · streak safe this week'
              : ' · train once to keep the streak'}
        </Text>
      </TierGlass>

      <SectionLabel>Your trail</SectionLabel>
      <View onLayout={e => { trailTop.current = e.nativeEvent.layout.y; }}>
        <Trail nodes={map.nodes} trackColor={ink.hairline} textColor={currentTheme.colors.text} onCurrentY={onCurrentY} />
      </View>
      <Legend />
    </ScrollView>
  );
}

// Past at the bottom, upcoming at the top: you climb the map.
function Trail({
  nodes,
  trackColor,
  textColor,
  onCurrentY,
}: {
  nodes: WeekNode[];
  trackColor: string;
  textColor: string;
  onCurrentY?: (y: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const ordered = useMemo(() => [...nodes].reverse(), [nodes]);
  const height = ordered.length * ROW;

  const pts = useMemo(
    () =>
      ordered.map((_, i) => ({
        x: width / 2 + Math.sin(i * 0.95) * width * 0.26,
        y: i * ROW + ROW / 2,
      })),
    [ordered, width],
  );

  const currentIdx = ordered.findIndex(n => n.isCurrent);
  useEffect(() => {
    if (width > 0 && currentIdx >= 0) onCurrentY?.(currentIdx * ROW + ROW / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per layout
  }, [width, currentIdx]);

  // One curved segment per hop. Styling per hop: upcoming → dashed, inside the
  // live streak → flame, anything else (gaps, older weeks) → quiet track.
  const hop = (i: number) => {
    const a = pts[i];
    const b = pts[i + 1];
    const my = (a.y + b.y) / 2;
    return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
  };
  const hopStyle = (i: number) => {
    const n1 = ordered[i];
    const n2 = ordered[i + 1];
    if (n1.state === 'upcoming') return { stroke: trackColor, dash: '2 10', opacity: 1 };
    const inStreak = n1.streakAt !== null && n2.streakAt !== null && n2.state !== 'missed' && n1.state !== 'missed';
    return inStreak ? { stroke: FLAME, dash: undefined, opacity: 0.6 } : { stroke: trackColor, dash: undefined, opacity: 1 };
  };

  return (
    <View style={[styles.trail, { height }]} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {pts.slice(0, -1).map((_, i) => {
            const st = hopStyle(i);
            return (
              <Path
                key={i}
                d={hop(i)}
                stroke={st.stroke}
                strokeOpacity={st.opacity}
                strokeWidth={4}
                strokeDasharray={st.dash}
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
        </Svg>
      )}
      {width > 0 &&
        ordered.map((n, i) => {
          const p = pts[i];
          const labelLeft = p.x > width / 2; // label on the open side
          return (
            <View key={n.weekStart.toISOString()}>
              <Node node={n} x={p.x} y={p.y} />
              <View
                style={[
                  styles.label,
                  { top: p.y - 20 },
                  labelLeft ? { right: width - p.x + NODE / 2 + space.md, alignItems: 'flex-end' } : { left: p.x + NODE / 2 + space.md },
                ]}
              >
                <Text variant="meta" weight="bold" style={{ color: textColor }} numberOfLines={1}>
                  {n.isCurrent ? 'You are here' : n.milestone ? `${n.milestone}-week flag` : weekLabel(n.weekStart)}
                </Text>
                <Text variant="meta" tone="muted" numberOfLines={1}>
                  {n.state === 'upcoming'
                    ? n.streakAt
                      ? `Week ${n.streakAt} of the streak`
                      : weekLabel(n.weekStart)
                    : `${n.daysTrained}/${n.goal} days${n.isCurrent || n.milestone ? ` · ${weekLabel(n.weekStart)}` : ''}`}
                </Text>
              </View>
            </View>
          );
        })}
    </View>
  );
}

function Node({ node, x, y }: { node: WeekNode; x: number; y: number }) {
  const ink = useInk();
  const { currentTheme } = useTheme();
  const base = { left: x - NODE / 2, top: y - NODE / 2 };
  let style: object;
  let icon: React.ReactNode = null;
  switch (node.state) {
    case 'goal':
      style = { backgroundColor: FLAME };
      icon = <Ionicons name="flame" size={20} color="#FFFFFF" />;
      break;
    case 'trained':
      style = { backgroundColor: FLAME, opacity: 0.6 };
      icon = <Text variant="meta" weight="bold" style={{ color: '#FFFFFF' }}>{node.daysTrained}</Text>;
      break;
    case 'missed':
      style = { borderWidth: 2, borderColor: ink.hairline, backgroundColor: currentTheme.colors.background };
      break;
    case 'current':
      style = { borderWidth: 3, borderColor: FLAME, backgroundColor: currentTheme.colors.background };
      icon = <Text variant="meta" weight="bold" style={{ color: FLAME }}>{node.daysTrained}</Text>;
      break;
    default:
      style = { borderWidth: 2, borderStyle: 'dashed', borderColor: ink.faint, backgroundColor: currentTheme.colors.background };
  }
  if (node.milestone && node.state === 'upcoming') {
    icon = <Ionicons name="flag" size={18} color={FLAME} />;
  }
  return (
    <View style={[styles.node, base, style, node.isCurrent && styles.current]}>
      {icon}
    </View>
  );
}

function Legend() {
  const ink = useInk();
  const items: [string, object][] = [
    ['Goal hit', { backgroundColor: FLAME }],
    ['Trained', { backgroundColor: FLAME, opacity: 0.6 }],
    ['Missed', { borderWidth: 2, borderColor: ink.hairline }],
    ['Upcoming', { borderWidth: 2, borderStyle: 'dashed', borderColor: ink.faint }],
  ];
  return (
    <View style={styles.legend}>
      {items.map(([label, s]) => (
        <View key={label} style={styles.legendItem}>
          <View style={[styles.legendDot, s]} />
          <Text variant="meta" tone="muted">{label}</Text>
        </View>
      ))}
    </View>
  );
}

function weekLabel(d: Date): string {
  return `Wk of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

const styles = StyleSheet.create({
  scroll: { padding: space.xl, paddingBottom: space.section * 2, gap: space.md },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg, borderRadius: radius.card + 6 },
  week: { padding: space.lg, borderRadius: radius.card + 6 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: space.xs },
  dayDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  weekLine: { marginTop: space.md },
  trail: { position: 'relative', marginTop: space.sm },
  node: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  current: { transform: [{ scale: 1.15 }] },
  label: { position: 'absolute', maxWidth: 150 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
});
