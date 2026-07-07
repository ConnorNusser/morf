import { useTheme } from '@/contexts/ThemeContext';
import { ThemeLevel } from '@/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SnowEffect, SpringEffect } from './effects';

type EffectType = 'snow' | 'spring' | 'none';

interface ThemeEffectConfig {
  effect: EffectType;
  intervalMs: number;
}

const isWinterSeason = (): boolean => {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  // Dec 1 – Mar 20: Dec (11), Jan (0), Feb (1), or March 1-20 (2)
  return month === 11 || month === 0 || month === 1 || (month === 2 && day <= 20);
};

const DEFAULT_SNOW_CONFIG: ThemeEffectConfig = {
  effect: 'snow',
  intervalMs: 8 * 60 * 1000, // 8 minutes
};

const getSeasonalConfig = (theme: ThemeLevel): ThemeEffectConfig | null => {
  // Winter theme gets more frequent snow
  if (theme === 'winter_2026' && isWinterSeason()) {
    return {
      effect: 'snow',
      intervalMs: 25 * 1000, // 25 seconds
    };
  }

  if (isWinterSeason()) {
    return DEFAULT_SNOW_CONFIG;
  }

  return null;
};

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
    case 'none':
    default:
      return null;
  }
}

export default function ThemeOverlay() {
  const { currentThemeLevel } = useTheme();

  const config = getSeasonalConfig(currentThemeLevel);
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
