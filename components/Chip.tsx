import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { readableInkOn } from '@/lib/ui/contrast';
import { radius, space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * The one pill-shaped filter/sort chip: primary fill when selected,
 * bordered surface otherwise.
 */
function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  size = 'medium',
  style,
  textStyle,
}: ChipProps) {
  const { currentTheme } = useTheme();

  return (
    <TouchableOpacity
      hitSlop={8}
      style={[
        styles.chip,
        size === 'small' ? styles.small : styles.medium,
        {
          backgroundColor: selected ? currentTheme.colors.primary : currentTheme.colors.surface,
          borderColor: selected ? currentTheme.colors.primary : currentTheme.colors.border,
        },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled || !onPress}
    >
      <Text
        variant="meta"
        tone={selected ? undefined : 'secondary'}
        // Weight is held constant across states: the fill + ink already carry the
        // selected emphasis, and flipping medium→semiBold changed the label's
        // glyph width, resizing the pill and reflowing its neighbors on select.
        weight="medium"
        style={[selected && { color: readableInkOn(currentTheme.colors.primary) }, textStyle]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default React.memo(Chip);

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  // minHeights + hitSlop keep the effective tap target ≥44pt.
  small: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    minHeight: 28,
    justifyContent: 'center',
  },
  medium: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
