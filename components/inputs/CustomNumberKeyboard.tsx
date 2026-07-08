import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
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
  title?: string;
}

export default function CustomNumberKeyboard({
  visible,
  value,
  onValueChange,
  onDone,
  onCancel,
  placeholder = "0",
  maxLength = 6,
  allowDecimal = true,
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

    if (value.length >= maxLength) {
      return;
    }

    if (key === '0' && value === '0') {
      return;
    }

    // Replace leading zero with typed digit, but keep it before a decimal point
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
      keyContent = <Text style={[styles.keyText, { color: '#FFFFFF', fontWeight: '600' }]}>Done</Text>;
      onPress = onDone;
    } else {
      keyContent = <Text style={[styles.keyText, { color: currentTheme.colors.text, fontWeight: '500' }]}>{key}</Text>;
    }

    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.key,
          isSpecial && key === 'done' && { backgroundColor: currentTheme.colors.primary },
          isSpecial && key !== 'done' && { backgroundColor: currentTheme.colors.surface },
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent={false}
    >
      <View style={styles.modalContainer}>
        {/* box-none lets taps pass through to the content above the keyboard */}
        <View style={styles.transparentArea} pointerEvents="box-none" />

        <View style={[styles.keyboardContainer, { backgroundColor: currentTheme.colors.surface }]} pointerEvents="auto">
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelButtonContainer}>
              <Text style={[styles.cancelButton, { color: currentTheme.colors.text, fontWeight: '500' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <Text style={[styles.title, { color: currentTheme.colors.text, fontWeight: '600' }]}>
              {title}
            </Text>
            
            <View style={styles.spacer} />
          </View>

          <View style={[styles.display, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]}>
            <Text style={[
              styles.displayText, 
              { 
                color: value ? currentTheme.colors.text : currentTheme.colors.text + '60',
              }
            ]}>
              {displayValue}
            </Text>
          </View>

          <View style={styles.keyboard}>
            <View style={styles.row}>
              {renderKey('1')}
              {renderKey('2')}
              {renderKey('3')}
            </View>

            <View style={styles.row}>
              {renderKey('4')}
              {renderKey('5')}
              {renderKey('6')}
            </View>

            <View style={styles.row}>
              {renderKey('7')}
              {renderKey('8')}
              {renderKey('9')}
            </View>

            <View style={styles.row}>
              {allowDecimal ? renderKey('.') : <View style={styles.key} />}
              {renderKey('0')}
              {renderKey('backspace', true)}
            </View>

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
}); 