import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

// Flat (no fill/border/shadow), full-width; `padding` only sets vertical rhythm.
function Card({ children, style, padding = 12 }: CardProps) {
  return <View style={[{ paddingVertical: padding }, style]}>{children}</View>;
}

export default Card;
