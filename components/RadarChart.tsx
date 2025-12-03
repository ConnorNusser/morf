import { useTheme } from '@/contexts/ThemeContext';
import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';

interface RadarDatum {
  label: string;
  value: number;
}

interface TierRing {
  label: string;
  threshold: number;
}

interface RadarChartProps {
  data: RadarDatum[];
  size?: number;
  tiers?: TierRing[];
  selectedIndex?: number;
  onPointPress?: (index: number, point: { x: number; y: number }) => void;
  details?: { lines: string[] }[];
  inlineTooltip?: boolean;
}

export default function RadarChart({ data, size, tiers = [], selectedIndex = -1, onPointPress, details = [], inlineTooltip = true }: RadarChartProps) {
  const { currentTheme } = useTheme();

  const chartSize = size || Math.min(Dimensions.get('window').width - 80, 320);
  const center = chartSize / 2;
  const radius = center - 24; // extra padding to avoid label clipping

  const angleStep = (Math.PI * 2) / Math.max(1, data.length);

  const axisPoints = useMemo(() => {
    return data.map((_, index) => {
      const angle = -Math.PI / 2 + angleStep * index;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      return { x, y, angle } as const;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- data dependency covered by data.length
  }, [data.length, center, radius, angleStep]);

  const valuePointCoords = useMemo(() => {
    return data.map((item, index) => {
      const angle = -Math.PI / 2 + angleStep * index;
      const r = radius * Math.max(0, Math.min(1, item.value / 100));
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      return { x, y };
    });
  }, [data, center, radius, angleStep]);

  const valuePoints = valuePointCoords.map(p => `${p.x},${p.y}`);

  const polygonPoints = valuePoints.join(' ');

  const ringRadii = useMemo(() => {
    return tiers
      .filter(t => t.threshold >= 0)
      .sort((a, b) => a.threshold - b.threshold)
      .map(t => ({ label: t.label, r: radius * (t.threshold / 100) }));
  }, [tiers, radius]);

  const primary = currentTheme.colors.primary;
  const muted = currentTheme.colors.border;
  const text = currentTheme.colors.text;

  return (
    <View style={styles.container}>
      <Svg width={chartSize} height={chartSize}>
        <G>
          {ringRadii.map((ring, i) => (
            <G key={`ring-${i}`}>
              <Circle
                cx={center}
                cy={center}
                r={ring.r}
                fill="none"
                stroke={muted}
                strokeWidth={1}
                strokeOpacity={0.35}
              />
            </G>
          ))}

          {axisPoints.map((p, i) => (
            <G key={`axis-${i}`}>
              <Line x1={center} y1={center} x2={p.x} y2={p.y} stroke={muted} strokeWidth={1} />
              {(() => {
                const labelRadius = radius * 0.92;
                const lx = center + Math.cos(p.angle) * labelRadius;
                const ly = center + Math.sin(p.angle) * labelRadius;
                const cos = Math.cos(p.angle);
                const sin = Math.sin(p.angle);
                const anchor = Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end';
                const dy = sin > 0.25 ? 10 : sin < -0.25 ? -4 : 4;
                return (
                  <SvgText
                    x={lx}
                    y={ly}
                    dy={dy}
                    fill={text}
                    fontSize="11"
                    textAnchor={anchor as "start" | "middle" | "end"}
                  >
                    {data[i].label}
                  </SvgText>
                );
              })()}
            </G>
          ))}

          <Polygon
            points={polygonPoints}
            fill={primary}
            opacity={0.25}
            stroke={primary}
            strokeWidth={2}
          />

          {valuePointCoords.map((p, i) => (
            <G key={`pt-${i}`}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={28}
                fill="rgba(0,0,0,0.001)"
                onPressIn={() => onPointPress && onPointPress(i, { x: p.x, y: p.y })}
              />
              <Circle
                cx={p.x}
                cy={p.y}
                r={i === selectedIndex ? 5 : 3.5}
                fill={primary}
                stroke={i === selectedIndex ? '#FFFFFF' : 'transparent'}
                strokeWidth={i === selectedIndex ? 2 : 0}
              />
            </G>
          ))}

          <Rect
            x={0}
            y={0}
            width={chartSize}
            height={chartSize}
            fill="rgba(0,0,0,0.001)"
            onPressIn={(e) => {
              if (!onPointPress || data.length === 0) return;
              // @ts-ignore react-native-svg provides locationX/Y
              const { locationX, locationY } = e.nativeEvent;
              const dx = locationX - center;
              const dy = locationY - center;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > radius + 24) return; // ignore far outside taps
              const rawAngle = Math.atan2(dy, dx); // -PI..PI (0 at +x)
              const angleFromTop = rawAngle + Math.PI / 2; // 0 at top
              const normalized = (angleFromTop + Math.PI * 2) % (Math.PI * 2);
              let idx = Math.round(normalized / angleStep) % data.length;
              const target = valuePointCoords[idx];
              onPointPress(idx, { x: target.x, y: target.y });
            }}
          />

          {inlineTooltip && selectedIndex >= 0 && valuePointCoords[selectedIndex] && (
            (() => {
              const p = valuePointCoords[selectedIndex];
              const title = `${data[selectedIndex].label}: ${data[selectedIndex].value}%`;
              const extra = details[selectedIndex]?.lines || [];
              const lines = [title, ...extra];
              const longest = lines.reduce((m, s) => Math.max(m, s.length), 0);
              const width = Math.min(chartSize - 16, Math.max(100, longest * 6.2 + 16));
              const height = 22 + (extra.length * 16);
              const offsetX = p.x < center ? -width - 8 : 8;
              const offsetY = p.y < center ? -height - 8 : 8;
              const x = Math.max(8, Math.min(p.x + offsetX, chartSize - width - 8));
              const y = Math.max(8, Math.min(p.y + offsetY, chartSize - height - 8));
              return (
                <G>
                  <Circle cx={p.x} cy={p.y} r={7} fill={primary} opacity={0.15} />
                  <Circle cx={p.x} cy={p.y} r={1} fill={primary} />
                  <G>
                    <Line x1={x} y1={y} x2={x + width} y2={y} stroke={muted} strokeWidth={1} />
                    <Line x1={x} y1={y + height} x2={x + width} y2={y + height} stroke={muted} strokeWidth={1} />
                    <Line x1={x} y1={y} x2={x} y2={y + height} stroke={muted} strokeWidth={1} />
                    <Line x1={x + width} y1={y} x2={x + width} y2={y + height} stroke={muted} strokeWidth={1} />
                    <SvgText x={x + 8} y={y + 16} fill={text} fontSize="12">{title}</SvgText>
                    {extra.map((line, idx) => (
                      <SvgText key={idx} x={x + 8} y={y + 16 + (idx + 1) * 14} fill={text} fontSize="11" opacity={0.8}>{line}</SvgText>
                    ))}
                  </G>
                </G>
              );
            })()
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

