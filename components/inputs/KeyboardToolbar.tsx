import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { InputAccessoryView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface KeyboardToolbarProps {
  nativeID: string;
  onCancel?: () => void;
  onDone?: () => void;
  cancelText?: string;
  doneText?: string;
  showCancel?: boolean;
  showDone?: boolean;
}

export default function KeyboardToolbar({
  nativeID,
  onCancel,
  onDone,
  cancelText = 'Cancel',
  doneText = 'Done',
  showCancel = true,
  showDone = true,
}: KeyboardToolbarProps) {
  const { currentTheme } = useTheme();

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={[styles.toolbar, { 
        backgroundColor: currentTheme.colors.surface,
        borderTopColor: currentTheme.colors.border,
      }]}>
        {showCancel ? (
          <TouchableOpacity
            onPress={onCancel}
            style={styles.button}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_500Medium',
            }]}>
              {cancelText}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.button} />
        )}
        
        {showDone ? (
          <TouchableOpacity
            onPress={onDone}
            style={styles.button}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, styles.doneText, { 
              color: currentTheme.colors.primary,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              {doneText}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.button} />
        )}
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    height: 44, // Standard iOS toolbar height
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
  },
  doneText: {
    fontWeight: '600',
  },
}); 