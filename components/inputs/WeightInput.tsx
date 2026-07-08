import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/utils/haptic';
import { WeightUnit, convertWeight } from '@/lib/storage/userProfile';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';
import UnitToggle from '@/components/ui/UnitToggle';
import CustomNumberKeyboard from './CustomNumberKeyboard';

interface WeightInputProps {
  value: {
    value: number;
    unit: WeightUnit;
  };
  onChange: (weight: { value: number; unit: WeightUnit }) => void;
  style?: ViewStyle;
}

export default function WeightInput({ value, onChange, style }: WeightInputProps) {
  const { currentTheme } = useTheme();
  const [inputValue, setInputValue] = useState(value.value.toString());

  const { play: playNotification } = useSound('notification');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [tempValue, setTempValue] = useState('');

  // Sync with external value changes
  useEffect(() => {
    setInputValue(value.value.toString());
  }, [value.value]);

  const handleUnitChange = (newUnit: WeightUnit) => {
    if (newUnit === value.unit) return;
    
    const convertedValue = convertWeight(value.value, value.unit, newUnit);
    setInputValue(convertedValue.toString());
    
    onChange({
      value: convertedValue,
      unit: newUnit,
    });
  };

  const handleInputPress = () => {
    setTempValue(inputValue);
    setKeyboardVisible(true);
  };

  const handleKeyboardDone = () => {
    const numValue = parseFloat(tempValue) || 0;
    setInputValue(tempValue);
    onChange({
      value: numValue,
      unit: value.unit,
    });
    setKeyboardVisible(false);
    playHapticFeedback('medium', false);
    playNotification();
  };

  const handleKeyboardCancel = () => {
    setTempValue(inputValue);
    setKeyboardVisible(false);
  };

  const placeholder = value.unit === 'lbs' ? '185' : '84';

  return (
    <>
      <View style={[styles.container, style]}>
        <Text style={[
          styles.label, 
          { 
            color: currentTheme.colors.text,
          }
        ]}>
          Weight
        </Text>
        
        <UnitToggle
          style={styles.unitToggle}
          value={value.unit}
          onChange={handleUnitChange}
          options={[
            { label: 'lbs', value: 'lbs' },
            { label: 'kg', value: 'kg' },
          ]}
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={[
              styles.input,
              {
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              },
            ]}
            onPress={handleInputPress}
            activeOpacity={0.7}
          >
            <TextInput
              style={[
                styles.inputText,
                {
                  color: currentTheme.colors.text,
                },
              ]}
              value={inputValue}
              editable={false}
              pointerEvents="none"
              placeholder={placeholder}
              placeholderTextColor={currentTheme.colors.text + '60'}
            />
          </TouchableOpacity>
          <Text style={[
            styles.inputLabel, 
            { 
              color: currentTheme.colors.text,
            }
          ]}>
            {value.unit}
          </Text>
        </View>
      </View>

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
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  unitToggle: {
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: 16,
    minHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 30,
  },
}); 