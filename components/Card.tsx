import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

// Flat: no fill, border, or shadow — content sits on the page, separated by
// spacing and section labels instead of a raised box. With the box gone the
// horizontal padding is dead space too, so cards run full-width; the `padding`
// prop only sets vertical rhythm between stacked cards.
function Card({ children, style, padding = 12 }: CardProps) {
  return <View style={[{ paddingVertical: padding }, style]}>{children}</View>;
}

export default Card;
