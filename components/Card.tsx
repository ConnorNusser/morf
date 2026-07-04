import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'surface' | 'elevated' | 'subtle' | 'clean';
  padding?: number;
}

function Card({
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

    // Flat: cards carry no fill, border, or shadow — content sits on the page,
    // separated by spacing and section labels instead of a raised box.
    return baseStyle;
  };

  return (
    <View style={[styles.container, getCardStyle(), style]}>
      {children}
    </View>
  );
}

export default React.memo(Card);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
}); 