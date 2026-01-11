import { useTheme } from '@/contexts/ThemeContext';
import { ThemeLevel } from '@/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SnowEffect, SpringEffect } from './effects';

// ============ TEST MODE ============
// Set to 'snow' or 'spring' to force that effect, or null for normal behavior
const TEST_EFFECT: 'snow' | 'spring' | null = null;

// ============ EFFECT CONFIGURATION ============

type EffectType = 'snow' | 'spring' | 'none';
// Future effect types: 'spooky' | 'hearts' | 'fireworks' | 'confetti'

interface ThemeEffectConfig {
  effect: EffectType;
  intervalMs: number;
  isActive: () => boolean; // Function to check if effect should be active (e.g., date range)
}

// Check if we're in winter season (Dec 1 - March 20)
const isWinterSeason = (): boolean => {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  // Dec (11), Jan (0), Feb (1), or March 1-20 (2)
  return month === 11 || month === 0 || month === 1 || (month === 2 && day <= 20);
};

// Check if we're in spring season (March 21 - June 20)
const isSpringSeason = (): boolean => {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  // March 21+ (2), April (3), May (4), or June 1-20 (5)
  return (month === 2 && day >= 21) || month === 3 || month === 4 || (month === 5 && day <= 20);
};

// Default snow effect for all themes during winter
const DEFAULT_SNOW_CONFIG: ThemeEffectConfig = {
  effect: 'snow',
  intervalMs: 2 * 60 * 1000, // 2 minutes
  isActive: isWinterSeason,
};

// Default spring effect for all themes during spring
const DEFAULT_SPRING_CONFIG: ThemeEffectConfig = {
  effect: 'spring',
  intervalMs: 90 * 1000, // 90 seconds
  isActive: isSpringSeason,
};

// Get seasonal effect config for a theme
const getSeasonalConfig = (theme: ThemeLevel): ThemeEffectConfig | null => {
  // Christmas theme gets more frequent snow in winter
  if (theme === 'christmas_theme_2025' && isWinterSeason()) {
    return {
      effect: 'snow',
      intervalMs: 25 * 1000, // 25 seconds - frequent snowfall
      isActive: () => true,
    };
  }

  // Check winter first, then spring
  if (isWinterSeason()) {
    return { ...DEFAULT_SNOW_CONFIG, isActive: () => true };
  }

  if (isSpringSeason()) {
    return { ...DEFAULT_SPRING_CONFIG, isActive: () => true };
  }

  return null;
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
    case 'spring':
      return <SpringEffect intervalMs={intervalMs} />;
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

  // TEST MODE: Force a specific effect for testing
  if (TEST_EFFECT) {
    const testIntervalMs = TEST_EFFECT === 'snow' ? 25 * 1000 : 45 * 1000;
    return (
      <View style={styles.container} pointerEvents="none">
        <EffectRenderer effect={TEST_EFFECT} intervalMs={testIntervalMs} />
      </View>
    );
  }

  // Get seasonal effect config for current theme
  const config = getSeasonalConfig(currentThemeLevel);

  // No seasonal effect active
  if (!config) return null;

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
