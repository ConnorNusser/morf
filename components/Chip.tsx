import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
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
        weight={selected ? 'semiBold' : 'medium'}
        style={[selected && { color: currentTheme.colors.background }, textStyle]}
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
  small: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  medium: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  disabled: {
    opacity: 0.5,
  },
});
