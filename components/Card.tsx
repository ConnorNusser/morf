import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'surface' | 'elevated' | 'subtle' | 'clean';
  padding?: number;
}

export default function Card({
  children,
  style,
  variant = 'surface',
  padding = 20,
}: CardProps) {
  const { currentTheme } = useTheme();

  const getCardStyle = () => {
    const baseStyle = {
      borderRadius: currentTheme.borderRadius,
      padding,
    };

    switch (variant) {
      case 'surface':
        return {
          ...baseStyle,
          backgroundColor: currentTheme.colors.surface,
          borderWidth: 1,
          borderColor: currentTheme.colors.border,
        };
      case 'elevated':
        return {
          ...baseStyle,
          backgroundColor: currentTheme.colors.surface,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
          borderWidth: 1,
          borderColor: currentTheme.colors.border,
          
        };
      case 'subtle':
        return {
          ...baseStyle,
          backgroundColor: currentTheme.colors.secondary,
        };
      case 'clean':
        return {
          ...baseStyle,
        };
      default:
        return baseStyle;
    }
  };

  return (
    <View style={[styles.container, getCardStyle(), style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
}); 