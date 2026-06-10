import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

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

  const sizeStyles = size === 'small' ? styles.small : styles.medium;
  const textSizeStyles = size === 'small' ? styles.textSmall : styles.textMedium;

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        sizeStyles,
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
        style={[
          styles.text,
          textSizeStyles,
          {
            color: selected ? currentTheme.colors.background : currentTheme.colors.text,
            fontFamily: currentTheme.fonts.medium,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default React.memo(Chip);

const styles = StyleSheet.create({
  chip: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  small: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  medium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {},
  textSmall: {
    fontSize: 12,
  },
  textMedium: {
    fontSize: 13,
  },
});
