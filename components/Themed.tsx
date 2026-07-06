import { useTheme } from '@/contexts/ThemeContext';
import React, { useMemo } from 'react';
import { Text as DefaultText, View as DefaultView } from 'react-native';

export type TextWeight = 'regular' | 'medium' | 'semiBold' | 'bold';
const WEIGHTS = { regular: '400', medium: '500', semiBold: '600', bold: '700' } as const;
export type TextProps = DefaultText['props'] & { weight?: TextWeight };
export type ViewProps = DefaultView['props'];

export const Text = React.memo(function Text(props: TextProps) {
  const { style, weight, ...otherProps } = props;
  const { currentTheme } = useTheme();

  // Apply the theme color and (when a weight is given) the matching system-font
  // weight, so callers don't repeat fontWeight on every label. Anything in `style`
  // still wins, keeping this backward-compatible.
  const themedStyle = useMemo(
    () => ({
      color: currentTheme.colors.primary,
      ...(weight ? { fontWeight: WEIGHTS[weight] } : null),
    }),
    [currentTheme.colors.primary, weight]
  );

  return (
    <DefaultText
      style={[themedStyle, style]}
      {...otherProps}
    />
  );
});

export const View = React.memo(function View(props: ViewProps) {
  const { style, ...otherProps } = props;

  return (
    <DefaultView
      style={style}
      {...otherProps}
    />
  );
});
