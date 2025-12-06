import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface IconButtonProps {
  icon: IoniconsName;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'surface' | 'primary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
  iconSize?: number;
  iconColor?: string;
}

export default function IconButton({
  icon,
  onPress,
  size = 'medium',
  variant = 'surface',
  disabled = false,
  style,
  iconSize,
  iconColor,
}: IconButtonProps) {
  const { currentTheme } = useTheme();

  const sizeStyles = {
    small: { width: 32, height: 32, borderRadius: 6 },
    medium: { width: 40, height: 40, borderRadius: 8 },
    large: { width: 48, height: 48, borderRadius: 10 },
  };

  const iconSizes = {
    small: 16,
    medium: 20,
    large: 24,
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'surface':
        return currentTheme.colors.surface;
      case 'primary':
        return currentTheme.colors.primary;
      case 'ghost':
        return 'transparent';
      default:
        return currentTheme.colors.surface;
    }
  };

  const getIconColor = () => {
    if (iconColor) return iconColor;
    switch (variant) {
      case 'primary':
        return '#FFFFFF';
      case 'ghost':
      case 'surface':
      default:
        return currentTheme.colors.text;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.button,
        sizeStyles[size],
        { backgroundColor: getBackgroundColor() },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={iconSize || iconSizes[size]}
        color={getIconColor()}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
