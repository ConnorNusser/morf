import { useTheme } from '@/contexts/ThemeContext';
import { Ink, InkTone, inkColor, inkRamp } from '@/lib/ui/tokens';
import { type as typeScale } from '@/lib/ui/typography';
import React, { useMemo } from 'react';
import { Text as DefaultText, View as DefaultView } from 'react-native';

export type TextWeight = 'regular' | 'medium' | 'semiBold' | 'bold';
const WEIGHTS = { regular: '400', medium: '500', semiBold: '600', bold: '700' } as const;
export type TextVariant = keyof typeof typeScale;
export type TextProps = DefaultText['props'] & {
  weight?: TextWeight;
  /** Type-scale role → fontSize. Named `variant` because RN reserves `role` for accessibility. */
  variant?: TextVariant;
  /** Ink emphasis (lib/ui/tokens) — sets color from the theme text ramp. */
  tone?: InkTone;
};
export type ViewProps = DefaultView['props'];

/** The theme's text-emphasis ramp, for styling icons/borders outside <Text>. */
export function useInk(): Ink {
  const { currentTheme } = useTheme();
  return useMemo(() => inkRamp(currentTheme), [currentTheme]);
}

export const Text = React.memo(function Text(props: TextProps) {
  const { style, weight, variant, tone, ...otherProps } = props;
  const { currentTheme } = useTheme();

  // Variant/tone/weight tokens + theme color so callers don't repeat them. `style` still
  // wins (backward-compatible); without a tone the color stays the legacy primary default.
  const themedStyle = useMemo(
    () => ({
      color: tone ? inkColor(currentTheme, tone) : currentTheme.colors.primary,
      ...(variant ? { fontSize: typeScale[variant] } : null),
      ...(weight ? { fontWeight: WEIGHTS[weight] } : null),
    }),
    [currentTheme, weight, variant, tone]
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
