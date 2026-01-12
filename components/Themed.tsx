import { useTheme } from '@/contexts/ThemeContext';
import { Text as DefaultText, View as DefaultView } from 'react-native';

export type TextProps = DefaultText['props'];
export type ViewProps = DefaultView['props'];

export function Text(props: TextProps) {
  const { style, ...otherProps } = props;
  const { currentTheme } = useTheme();

  return (
    <DefaultText 
      style={[
        { 
          color: currentTheme.colors.primary,
        }, 
        style
      ]} 
      {...otherProps} 
    />
  );
}

export function View(props: ViewProps) {
  const { style, ...otherProps } = props;

  return (
    <DefaultView
      style={style}
      {...otherProps}
    />
  );
}

export function Surface(props: ViewProps) {
  const { style, ...otherProps } = props;
  const { currentTheme } = useTheme();

  return (
    <DefaultView 
      style={[
        { 
          backgroundColor: currentTheme.colors.surface || currentTheme.colors.background,
          borderRadius: 8,
          padding: 16,
        }, 
        style
      ]} 
      {...otherProps} 
    />
  );
} 