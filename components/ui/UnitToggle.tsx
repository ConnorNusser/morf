import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { readableInkOn } from '@/lib/ui/contrast';
import { radius, space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';

export interface UnitToggleOption<T extends string> {
  label: string;
  value: T;
}

interface UnitToggleProps<T extends string> {
  options: UnitToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

/**
 * Equal-width segmented selector for a small set of units (lbs/kg, ft·in/cm, …):
 * primary fill on the active segment, bordered surface otherwise. The shared
 * form-toggle used by WeightInput/HeightInput and the onboarding flow.
 */
export default function UnitToggle<T extends string>({
  options,
  value,
  onChange,
  style,
}: UnitToggleProps<T>) {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.row, style]}>
      {options.map(opt => {
        const selected = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.button,
              {
                backgroundColor: selected ? currentTheme.colors.primary : currentTheme.colors.surface,
                borderColor: selected ? currentTheme.colors.primary : currentTheme.colors.border,
              },
            ]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
          >
            <Text
              variant="meta"
              tone={selected ? undefined : 'secondary'}
              weight="medium"
              style={selected ? { color: readableInkOn(currentTheme.colors.primary) } : undefined}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  button: {
    flex: 1,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
