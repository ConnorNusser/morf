import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface DividerProps {
  style?: any;
  thickness?: number;
  margin?: number;
}

export default function Divider({ style, thickness = 1, margin = 16 }: DividerProps) {
  const { currentTheme } = useTheme();

  return (
    <View
      style={[
        styles.divider,
        {
          height: thickness,
          backgroundColor: currentTheme.colors.border,
          marginVertical: margin,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    width: '100%',
  },
}); 