import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface ProfileIconProps {
  size?: number;
  color?: string;
}

export default function ProfileIcon({ size = 24, color = '#000000' }: ProfileIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle 
        cx="12" 
        cy="8" 
        r="4" 
        stroke={color} 
        strokeWidth="2" 
        fill="none"
      />
      <Path 
        d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" 
        stroke={color} 
        strokeWidth="2" 
        fill="none"
      />
    </Svg>
  );
} 