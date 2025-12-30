import { useTheme } from '@/contexts/ThemeContext';
import { ThemeLevel } from '@/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SnowEffect } from './effects';

// ============ EFFECT CONFIGURATION ============

type EffectType = 'snow' | 'none';
// Future effect types: 'spooky' | 'hearts' | 'fireworks' | 'confetti'

interface ThemeEffectConfig {
  effect: EffectType;
  intervalMs: number;
  isActive: () => boolean; // Function to check if effect should be active (e.g., date range)
}

// Configuration for each theme's overlay effect
const THEME_EFFECTS: Partial<Record<ThemeLevel, ThemeEffectConfig>> = {
  christmas_theme_2025: {
    effect: 'snow',
    intervalMs: 2 * 60 * 1000, // 2 minutes
    isActive: () => {
      // Active Dec 1 - Jan 15
      const now = new Date();
      const month = now.getMonth();
      const day = now.getDate();
      return month === 11 || (month === 0 && day <= 15);
    },
  },
  // Add more theme effects here:
  // halloween_2025: {
  //   effect: 'spooky',
  //   intervalMs: 30 * 60 * 1000,
  //   isActive: () => { /* Oct 1 - Nov 1 */ },
  // },
  // valentines_2026: {
  //   effect: 'hearts',
  //   intervalMs: 30 * 60 * 1000,
  //   isActive: () => { /* Feb 1 - Feb 15 */ },
  // },
};

// ============ EFFECT RENDERER ============

interface EffectRendererProps {
  effect: EffectType;
  intervalMs: number;
}

function EffectRenderer({ effect, intervalMs }: EffectRendererProps) {
  switch (effect) {
    case 'snow':
      return <SnowEffect intervalMs={intervalMs} />;
    // Add more effect components here:
    // case 'spooky':
    //   return <SpookyEffect intervalMs={intervalMs} />;
    // case 'hearts':
    //   return <HeartsEffect intervalMs={intervalMs} />;
    case 'none':
    default:
      return null;
  }
}

// ============ MAIN OVERLAY COMPONENT ============

export default function ThemeOverlay() {
  const { currentThemeLevel } = useTheme();

  // Get effect config for current theme
  const config = THEME_EFFECTS[currentThemeLevel];

  // No effect configured for this theme
  if (!config) return null;

  // Effect exists but is not active (e.g., outside date range)
  if (!config.isActive()) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <EffectRenderer effect={config.effect} intervalMs={config.intervalMs} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});
