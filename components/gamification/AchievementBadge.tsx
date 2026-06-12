import { useTheme } from '@/contexts/ThemeContext';
import { Rarity, RARITY_META } from '@/lib/gamification/rarity';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// A flat, on-brand achievement badge: a tinted disc with a 1px accent border and
// a monoline glyph — matching the app's border-first, single-color icon language
// (Card / TierBadge / the profile emblem). Rarity is conveyed by color, not by
// gloss or gradients (the app keeps those to data-viz only). Locked badges fall
// back to the neutral theme border with a muted glyph; new ones get a 2px ring.
interface Props {
  icon: string; // Ionicons name
  rarity: Rarity;
  size?: number;
  unlocked?: boolean;
  isNew?: boolean;
}

export default function AchievementBadge({
  icon,
  rarity,
  size = 44,
  unlocked = true,
  isNew = false,
}: Props) {
  const { currentTheme } = useTheme();
  const accent = RARITY_META[rarity].accent;
  const glyphSize = Math.round(size * 0.46);

  const backgroundColor = unlocked ? accent + '1A' : 'transparent';
  const borderColor = unlocked ? accent : currentTheme.colors.border;
  const glyphColor = unlocked ? accent : currentTheme.colors.text + '40';

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          borderColor,
          borderWidth: isNew ? 2 : 1,
        },
      ]}
    >
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={glyphSize} color={glyphColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
