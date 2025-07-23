import CustomNumberKeyboard from '@/components/inputs/CustomNumberKeyboard';
import { Text } from '@/components/Themed';
import { Theme } from '@/lib/theme';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface CompactRepsInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder: string;
  showPlaceholderStyle?: boolean;
  themeColors: Theme['colors'];
}

export default function CompactRepsInput({ 
  value, 
  onChange, 
  placeholder,
  showPlaceholderStyle = false,
  themeColors 
}: CompactRepsInputProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [tempValue, setTempValue] = useState('');

  const isEmpty = !value || value === 0;

  // Get the effective value (use placeholder if empty)
  const getEffectiveValue = () => {
    if (isEmpty) {
      return parseInt(placeholder) || 0;
    }
    return value;
  };

  const getTextColor = () => {
    if (isEmpty) {
      return themeColors.text + '60'; // Always placeholder color when empty
    }
    if (showPlaceholderStyle) {
      return themeColors.text + '60'; // Gray when exercise not completed
    }
    return themeColors.text; // Normal color when completed
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
          color: getTextColor()
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