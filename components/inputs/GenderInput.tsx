import { useTheme } from '@/contexts/ThemeContext';
import { gap } from '@/lib/ui/styles';
import { Gender } from '@/lib/storage/userProfile';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

interface GenderInputProps {
  value: Gender;
  onChange: (gender: Gender) => void;
  style?: ViewStyle;
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export default function GenderInput({ value, onChange, style }: GenderInputProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Text style={[
        styles.label, 
        { 
          color: currentTheme.colors.text,
        }
      ]}>
        Gender
      </Text>
      
      <View style={gap.gap8}>
        {GENDER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              { 
                backgroundColor: value === option.value ? currentTheme.colors.primary : currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              },
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[
              styles.optionText,
              {
                color: value === option.value ? '#FFFFFF' : currentTheme.colors.text,
              },
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 