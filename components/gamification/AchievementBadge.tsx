import { useTheme } from '@/contexts/ThemeContext';
import { Rarity, RARITY_META } from '@/lib/gamification/rarity';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

// A flat, on-brand achievement badge: a tinted disc with a 1px accent border. When
// the achievement has a bespoke RuneScape-themed emblem it renders that full-colour
// art; otherwise it falls back to a monoline Ionicon in the rarity accent. Rarity is
// conveyed by the ring colour. Locked badges are muted (border only, desaturated
// emblem); new ones get a 2px ring.
interface Props {
  icon: string; // Ionicons name (fallback)
  emblem?: ImageSourcePropType; // bespoke art; takes precedence over the glyph
  rarity: Rarity;
  size?: number;
  unlocked?: boolean;
  isNew?: boolean;
}

export default function AchievementBadge({
  icon,
  emblem,
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
      {emblem ? (
        <Image
          source={emblem}
          style={{ width: size * 0.72, height: size * 0.72, opacity: unlocked ? 1 : 0.35 }}
          resizeMode="contain"
        />
      ) : (
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={glyphSize} color={glyphColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
