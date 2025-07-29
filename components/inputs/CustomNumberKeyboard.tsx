import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/haptic';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface CustomNumberKeyboardProps {
  visible: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onDone: () => void;
  onCancel: () => void;
  placeholder?: string;
  maxLength?: number;
  allowDecimal?: boolean;
  allowRange?: boolean;
  title?: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CustomNumberKeyboard({
  visible,
  value,
  onValueChange,
  onDone,
  onCancel,
  placeholder = "0",
  maxLength = 6,
  allowDecimal = true,
  allowRange = false,
  title = "Enter Value",
}: CustomNumberKeyboardProps) {
  const { currentTheme } = useTheme();

  const handleKeyPress = (key: string) => {
    if (key === 'backspace') {
      onValueChange(value.slice(0, -1));
      playHapticFeedback('medium', false);
      return;
    }

    if (key === '.' && (!allowDecimal || value.includes('.'))) {
      return;
    }

    if (key === 'to' && allowRange) {
      // Simple logic: if no dash exists, add one after current value
      if (!value.includes('-')) {
        onValueChange(value + '-');
        playHapticFeedback('light', false);
      }
      return;
    }

    if (value.length >= maxLength) {
      return;
    }

    // Don't allow multiple leading zeros
    if (key === '0' && value === '0') {
      return;
    }

    // Replace leading zero with new number (unless it's a decimal point)
    if (value === '0' && key !== '.') {
      onValueChange(key);
      playHapticFeedback('light', false);
      return;
    }

    onValueChange(value + key);
    playHapticFeedback('light', false);
  };

  const renderKey = (key: string, isSpecial = false) => {
    let keyContent;
    let onPress = () => handleKeyPress(key);
    
    if (key === 'backspace') {
      keyContent = <Ionicons name="backspace-outline" size={24} color={currentTheme.colors.text} />;
    } else if (key === 'done') {
      keyContent = <Text style={[styles.keyText, { color: '#FFFFFF', fontFamily: 'Raleway_600SemiBold' }]}>Done</Text>;
      onPress = onDone;
    } else if (key === 'to') {
      keyContent = (
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.keyText, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>to</Text>
          <Text style={[styles.rangeSubtext, { color: currentTheme.colors.primary, marginTop: 2 }]}>range</Text>
        </View>
      );
    } else {
      keyContent = <Text style={[styles.keyText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>{key}</Text>;
    }

    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.key,
          isSpecial && key === 'done' && { backgroundColor: currentTheme.colors.primary },
          isSpecial && key === 'to' && { backgroundColor: currentTheme.colors.primary + '20', borderColor: currentTheme.colors.primary, borderWidth: 1 },
          isSpecial && key !== 'done' && key !== 'to' && { backgroundColor: currentTheme.colors.surface },
          !isSpecial && { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {keyContent}
      </TouchableOpacity>
    );
  };

  const displayValue = value || placeholder;
  const formattedDisplayValue = displayValue.replace('-', ' - ');

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent={false}
    >
      <View style={styles.modalContainer}>
        {/* Transparent area that allows interaction with content above */}
        <View style={styles.transparentArea} pointerEvents="box-none" />
        
        {/* Keyboard container */}
        <View style={[styles.keyboardContainer, { backgroundColor: currentTheme.colors.surface }]} pointerEvents="auto">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelButtonContainer}>
              <Text style={[styles.cancelButton, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <Text style={[styles.title, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              {title}
            </Text>
            
            <View style={styles.spacer} />
          </View>

          {/* Display */}
          <View style={[styles.display, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]}>
            <Text style={[
              styles.displayText, 
              { 
                color: value ? currentTheme.colors.text : currentTheme.colors.text + '60',
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              {formattedDisplayValue}
            </Text>
          </View>

          {/* Keyboard */}
          <View style={styles.keyboard}>
            {/* Row 1 */}
            <View style={styles.row}>
              {renderKey('1')}
              {renderKey('2')}
              {renderKey('3')}
            </View>

            {/* Row 2 */}
            <View style={styles.row}>
              {renderKey('4')}
              {renderKey('5')}
              {renderKey('6')}
            </View>

            {/* Row 3 */}
            <View style={styles.row}>
              {renderKey('7')}
              {renderKey('8')}
              {renderKey('9')}
            </View>

            {/* Row 4 */}
            <View style={styles.row}>
              {allowRange ? renderKey('to', true) : allowDecimal ? renderKey('.') : <View style={styles.key} />}
              {renderKey('0')}
              {renderKey('backspace', true)}
            </View>

            {/* Row 5 - Done button */}
            <View style={styles.row}>
              {renderKey('done', true)}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  transparentArea: {
    flex: 1,
  },
  keyboardContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelButtonContainer: {
    width: 60,
  },
  cancelButton: {
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    flex: 1,
  },
  spacer: {
    width: 60,
  },
  display: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  displayText: {
    fontSize: 32,
  },
  keyboard: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  key: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  keyText: {
    fontSize: 20,
  },
  rangeSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
}); 