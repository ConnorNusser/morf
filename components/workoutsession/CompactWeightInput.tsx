import CustomNumberKeyboard from '@/components/inputs/CustomNumberKeyboard';
import { Text } from '@/components/Themed';
import { Theme } from '@/lib/theme';
import { convertWeight, WeightUnit } from '@/types';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface CompactWeightInputProps {
  value: { value: number; unit: 'lbs' | 'kg' };
  displayUnit: WeightUnit;
  placeholder: string;
  onChange: (value: { value: number; unit: 'lbs' | 'kg' }) => void;
  themeColors: Theme['colors'];
}

export default function CompactWeightInput({ 
  value, 
  displayUnit, 
  placeholder,
  onChange, 
  themeColors 
}: CompactWeightInputProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [tempValue, setTempValue] = useState('');

  const displayValue = convertWeight(value.value, 'lbs', displayUnit);
  const isEmpty = !value.value || value.value === 0;

  // Get the effective value (use placeholder if empty)
  const getEffectiveValue = () => {
    if (isEmpty) {
      return parseFloat(placeholder) || 0;
    }
    return displayValue;
  };

  const handlePress = () => {
    setTempValue(getEffectiveValue().toString());
    setKeyboardVisible(true);
  };

  const handleKeyboardDone = () => {
    const displayNumber = parseFloat(tempValue) || 0;
    
    // Convert back to lbs for storage
    const lbsValue = displayUnit === 'kg' 
      ? Math.round(displayNumber * 2.20462 * 100) / 100 
      : displayNumber;
    
    onChange({
      value: lbsValue,
      unit: 'lbs' // Always store as lbs
    });
    setKeyboardVisible(false);
  };

  const handleKeyboardCancel = () => {
    setTempValue(getEffectiveValue().toString());
    setKeyboardVisible(false);
  };

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
          {isEmpty ? placeholder : displayValue}
        </Text>
      </TouchableOpacity>

      <CustomNumberKeyboard
        visible={keyboardVisible}
        value={tempValue}
        onValueChange={setTempValue}
        onDone={handleKeyboardDone}
        onCancel={handleKeyboardCancel}
        title="Enter Weight"
        allowDecimal={true}
        maxLength={6}
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