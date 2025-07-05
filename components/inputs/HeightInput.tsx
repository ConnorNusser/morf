import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { HeightUnit, convertHeight, formatHeight } from '@/lib/userProfile';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import CustomNumberKeyboard from './CustomNumberKeyboard';

interface HeightInputProps {
  value: {
    value: number;
    unit: HeightUnit;
  };
  onChange: (height: { value: number; unit: HeightUnit }) => void;
  style?: any;
}

export default function HeightInput({ value, onChange, style }: HeightInputProps) {
  const { currentTheme } = useTheme();
  const [feet, setFeet] = useState(Math.floor(value.value));
  const [inches, setInches] = useState(Math.round((value.value - Math.floor(value.value)) * 12));
  const [cm, setCm] = useState(value.unit === 'cm' ? value.value : convertHeight(value.value, 'feet', 'cm'));
  
  // Keyboard state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activeInput, setActiveInput] = useState<'feet' | 'inches' | 'cm' | null>(null);
  const [tempValue, setTempValue] = useState('');
  
  const { play: playNotification } = useSound('notification');
  
  const handleUnitChange = (newUnit: HeightUnit) => {
    if (newUnit === value.unit) return;
    
    const convertedValue = convertHeight(value.value, value.unit, newUnit);
    
    if (newUnit === 'feet') {
      const newFeet = Math.floor(convertedValue);
      const newInches = Math.round((convertedValue - newFeet) * 12);
      setFeet(newFeet);
      setInches(newInches);
    } else {
      setCm(convertedValue);
    }
    
    onChange({
      value: convertedValue,
      unit: newUnit,
    });
  };

  const handleInputPress = (inputType: 'feet' | 'inches' | 'cm') => {
    setActiveInput(inputType);
    const currentValue = inputType === 'feet' ? feet.toString() : 
                        inputType === 'inches' ? inches.toString() : 
                        cm.toString();
    setTempValue(currentValue);
    setKeyboardVisible(true);
  };

  const handleKeyboardDone = () => {
    const numValue = parseInt(tempValue) || 0;
    
    if (activeInput === 'feet') {
      setFeet(numValue);
      const totalHeight = numValue + (inches / 12);
      onChange({
        value: totalHeight,
        unit: 'feet',
      });
    } else if (activeInput === 'inches') {
      setInches(numValue);
      const totalHeight = feet + (numValue / 12);
      onChange({
        value: totalHeight,
        unit: 'feet',
      });
    } else if (activeInput === 'cm') {
      setCm(numValue);
      onChange({
        value: numValue,
        unit: 'cm',
      });
    }
    
    setKeyboardVisible(false);
    setActiveInput(null);
    playHapticFeedback('medium', false);
    playNotification();
  };

  const handleKeyboardCancel = () => {
    setKeyboardVisible(false);
    setActiveInput(null);
    setTempValue('');
  };

  const getKeyboardTitle = () => {
    if (activeInput === 'feet') return 'Enter Feet';
    if (activeInput === 'inches') return 'Enter Inches';
    if (activeInput === 'cm') return 'Enter Height (cm)';
    return 'Enter Height';
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
          Height
        </Text>
        
        {/* Unit Toggle */}
        <View style={styles.unitToggle}>
          <TouchableOpacity
            style={[
              styles.unitButton,
              { 
                backgroundColor: value.unit === 'feet' ? currentTheme.colors.primary : currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              },
            ]}
            onPress={() => handleUnitChange('feet')}
          >
            <Text style={[
              styles.unitButtonText,
              { 
                color: value.unit === 'feet' ? '#FFFFFF' : currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              ft/in
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.unitButton,
              { 
                backgroundColor: value.unit === 'cm' ? currentTheme.colors.primary : currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              },
            ]}
            onPress={() => handleUnitChange('cm')}
          >
            <Text style={[
              styles.unitButtonText,
              { 
                color: value.unit === 'cm' ? '#FFFFFF' : currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              cm
            </Text>
          </TouchableOpacity>
        </View>

        {/* Input Fields */}
        {value.unit === 'feet' ? (
          <View style={styles.feetInputContainer}>
            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={[
                  styles.input,
                  {
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
                onPress={() => handleInputPress('feet')}
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
                  value={feet.toString()}
                  editable={false}
                  pointerEvents="none"
                  placeholder="5"
                  placeholderTextColor={currentTheme.colors.text + '60'}
                />
              </TouchableOpacity>
              <Text style={[
                styles.inputLabel, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>ft</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={[
                  styles.input,
                  {
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
                onPress={() => handleInputPress('inches')}
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
                  value={inches.toString()}
                  editable={false}
                  pointerEvents="none"
                  placeholder="11"
                  placeholderTextColor={currentTheme.colors.text + '60'}
                />
              </TouchableOpacity>
              <Text style={[
                styles.inputLabel, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>in</Text>
            </View>
          </View>
        ) : (
          <View style={styles.cmInputContainer}>
            <TouchableOpacity
              style={[
                styles.input,
                styles.cmInput,
                {
                  backgroundColor: currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                },
              ]}
              onPress={() => handleInputPress('cm')}
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
                value={cm.toString()}
                editable={false}
                pointerEvents="none"
                placeholder="180"
                placeholderTextColor={currentTheme.colors.text + '60'}
              />
            </TouchableOpacity>
            <Text style={[
              styles.inputLabel, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>cm</Text>
          </View>
        )}

        {/* Height Display */}
        <View style={styles.heightDisplay}>
          <Text style={[
            styles.heightText, 
            { 
              color: currentTheme.colors.text + '80',
              fontFamily: 'Raleway_500Medium',
            }
          ]}>
            {formatHeight(value)}
          </Text>
        </View>
      </View>

      <CustomNumberKeyboard
        visible={keyboardVisible}
        value={tempValue}
        onValueChange={setTempValue}
        onDone={handleKeyboardDone}
        onCancel={handleKeyboardCancel}
        title={getKeyboardTitle()}
        allowDecimal={false}
        maxLength={3}
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
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  feetInputContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  cmInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  cmInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 24,
  },
  heightDisplay: {
    alignItems: 'center',
    marginTop: 8,
  },
  heightText: {
    fontSize: 14,
  },
}); 