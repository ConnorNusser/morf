import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { readableInkOn } from '@/lib/ui/contrast';
import { radius, space } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TextStyle, View, ViewStyle } from 'react-native';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type BadgeVariant = 'tinted' | 'solid' | 'outline';

interface BadgeProps {
  label: string | number;
  /** tinted = 12% wash + accent text (default); solid = filled accent + readable text; outline = accent border, no fill. */
  variant?: BadgeVariant;
  /** Accent color; defaults to the theme primary. */
  color?: string;
  /** Optional leading icon. */
  icon?: IoniconsName;
  size?: 'small' | 'medium';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/** Small rounded status / count / PR / delta pill. The one shared shape for the
 *  ~radius.badge pills that were hand-rolled across history, feed, profile, etc. */
export default function Badge({
  label,
  variant = 'tinted',
  color,
  icon,
  size = 'small',
  style,
  textStyle,
}: BadgeProps) {
  const { currentTheme } = useTheme();
  const accent = color ?? currentTheme.colors.primary;

  const fg = variant === 'solid' ? readableInkOn(accent) : accent;
  const bg = variant === 'solid' ? accent : variant === 'tinted' ? accent + '20' : 'transparent';

  return (
    <View
      style={[
        styles.badge,
        size === 'medium' ? styles.medium : styles.small,
        {
          backgroundColor: bg,
          borderColor: accent,
          borderWidth: variant === 'outline' ? 1 : 0,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons name={icon} size={size === 'medium' ? 14 : 12} color={fg} style={styles.icon} />
      )}
      <Text variant="meta" weight="semiBold" style={[{ color: fg }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.badge,
  },
  small: { paddingHorizontal: space.sm, paddingVertical: space.xs },
  medium: { paddingHorizontal: space.md, paddingVertical: space.xs },
  icon: { marginRight: space.xs },
});
