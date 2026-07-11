// Monoline tab-bar icons — one family with ProfileIcon: 24 grid, stroke-width 2,
// round caps, stroke = tint color. The center Workout tab carries the hex-badge
// mark from the app's visual identity.
import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

export function HomeIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 10L12 2L22 10V22H15V16H9V22H2Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function WorkoutIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L21 7V17L12 22L3 17V7Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Line x1="12" y1="8" x2="12" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function HistoryIcon({ size = 24, color = '#000000' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" fill="none" />
      <Path
        d="M12 7v5l4 2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function RoutinesIcon({ size = 24, color = '#000000' }: IconProps) {
  // The up-next ring: a segmented cycle of days with the current-day node.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.41 4.37A8 8 0 0 1 19.81 13.73" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M17.41 17.9A8 8 0 0 1 6.59 17.9" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M4.19 13.73A8 8 0 0 1 9.59 4.37" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Circle cx="12" cy="4" r="1.8" fill={color} />
    </Svg>
  );
}

export function MorfMarkIcon({ size = 24, color = '#000000' }: IconProps) {
  // The brand M (monoline take on the app icon's letterform) — profile is your
  // Morf identity. Slightly heavier stroke so the letter carries at tab size.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20V5L12 14.5L20 5V20"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
