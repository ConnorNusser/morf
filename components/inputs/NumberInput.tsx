import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/haptic';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import CustomNumberKeyboard from './CustomNumberKeyboard';
import { useSound } from '@/hooks/useSound';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  placeholder?: string;
  allowDecimal?: boolean;
  maxLength?: number;
  style?: any;
}

export default function NumberInput({ 
  value, 
  onChange, 
  label, 
  placeholder = "0",
  allowDecimal = true,
  maxLength = 6,
  style 
}: NumberInputProps) {
  const { currentTheme } = useTheme();
  const [inputValue, setInputValue] = useState(value > 0 ? value.toString() : '');
  
  // Keyboard state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const { play: playNotification } = useSound('notification');

  // Sync inputValue with external value changes
  useEffect(() => {
    setInputValue(value > 0 ? value.toString() : '');
  }, [value]);

  const handleInputPress = () => {
    setTempValue(inputValue);
    setKeyboardVisible(true);
  };

  const handleKeyboardDone = () => {
    const numValue = parseFloat(tempValue) || 0;
    setInputValue(tempValue);
    onChange(numValue);
    setKeyboardVisible(false);
    playHapticFeedback('medium', false);
    playNotification();
  };

  const handleKeyboardCancel = () => {
    setTempValue(inputValue);
    setKeyboardVisible(false);
  };

  return (
    <>
      <View style={[styles.container, style]}>
        <Text style={[
          styles.label, 
          { 
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_600SemiBold',
          }
        ]}>
          {label}
        </Text>
        
        {/* Input Field */}
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
                fontFamily: 'Raleway_500Medium',
              },
            ]}
            value={inputValue}
            editable={false}
            pointerEvents="none"
            placeholder={placeholder}
            placeholderTextColor={currentTheme.colors.text + '60'}
          />
        </TouchableOpacity>
      </View>

      <CustomNumberKeyboard
        visible={keyboardVisible}
        value={tempValue}
        onValueChange={setTempValue}
        onDone={handleKeyboardDone}
        onCancel={handleKeyboardCancel}
        title={`Enter ${label}`}
        allowDecimal={allowDecimal}
        maxLength={maxLength}
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
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: 16,
    minHeight: 20,
  },
}); 