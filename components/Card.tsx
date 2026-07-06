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
  padding = 12,
}: CardProps) {
  const { currentTheme } = useTheme();

  // Flat: no fill, border, or shadow — content sits on the page, separated by
  // spacing and section labels instead of a raised box. With the box gone the
  // horizontal padding is dead space too, so cards run full-width; the `padding`
  // prop now only sets vertical rhythm between stacked cards.
  const getCardStyle = () => ({ paddingVertical: padding });

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