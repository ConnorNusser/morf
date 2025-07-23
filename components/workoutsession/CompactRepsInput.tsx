import CustomNumberKeyboard from '@/components/inputs/CustomNumberKeyboard';
import { Text } from '@/components/Themed';
import { Theme } from '@/lib/theme';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface CompactRepsInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  themeColors: Theme['colors'];
}

export default function CompactRepsInput({ value, onChange, placeholder, themeColors }: CompactRepsInputProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [tempValue, setTempValue] = useState('');

  const isEmpty = !value || value === 0;

  // Get the effective value (use placeholder if empty)
  const getEffectiveValue = () => {
    if (isEmpty && placeholder) {
      // Parse placeholder like "8-12" to get the first number
      if (placeholder.includes('-')) {
        const firstNum = parseInt(placeholder.split('-')[0]);
        return firstNum || 0;
      }
      return parseInt(placeholder) || 0;
    }
    return value;
  };

  const handlePress = () => {
    setTempValue(getEffectiveValue().toString());
    setKeyboardVisible(true);
  };

  const handleKeyboardDone = () => {
    const numValue = parseInt(tempValue) || 0;
    onChange(numValue);
    setKeyboardVisible(false);
  };

  const handleKeyboardCancel = () => {
    setTempValue(getEffectiveValue().toString());
    setKeyboardVisible(false);
  };

  const displayValue = isEmpty ? placeholder : value.toString();

  return (
    <>
      <TouchableOpacity
        style={[styles.display, { 
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border
        }]}
        onPress={handlePress}
      >
        <Text style={[styles.value, { 
          color: isEmpty ? themeColors.text + '60' : themeColors.text 
        }]}>
          {displayValue}
        </Text>
      </TouchableOpacity>

      <CustomNumberKeyboard
        visible={keyboardVisible}
        value={tempValue}
        onValueChange={setTempValue}
        onDone={handleKeyboardDone}
        onCancel={handleKeyboardCancel}
        title="Enter Reps"
        allowDecimal={false}
        maxLength={3}
      />
    </>
  );
}

const styles = StyleSheet.create({
  display: {
    width: 80, // Increased to match new column width
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
}); 