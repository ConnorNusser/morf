import { useTheme } from '@/contexts/ThemeContext';
import React, { useMemo } from 'react';
import { Text as DefaultText, View as DefaultView } from 'react-native';

export type TextProps = DefaultText['props'];
export type ViewProps = DefaultView['props'];

export const Text = React.memo(function Text(props: TextProps) {
  const { style, ...otherProps } = props;
  const { currentTheme } = useTheme();

  const colorStyle = useMemo(
    () => ({ color: currentTheme.colors.primary }),
    [currentTheme.colors.primary]
  );

  return (
    <DefaultText
      style={[colorStyle, style]}
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

export const Surface = React.memo(function Surface(props: ViewProps) {
  const { style, ...otherProps } = props;
  const { currentTheme } = useTheme();

  const surfaceStyle = useMemo(
    () => ({
      backgroundColor: currentTheme.colors.surface || currentTheme.colors.background,
      borderRadius: 8,
      padding: 16,
    }),
    [currentTheme.colors.surface, currentTheme.colors.background]
  );

  return (
    <DefaultView
      style={[surfaceStyle, style]}
      {...otherProps}
    />
  );
});
