import { useTheme } from '@/contexts/ThemeContext';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import KeyboardToolbar from './KeyboardToolbar';

export default function KeyboardToolbarTest() {
  const { currentTheme } = useTheme();
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const inputAccessoryViewID = 'TestKeyboardToolbar';

  const handleCancel = () => {
    Alert.alert('Cancel', 'Keyboard toolbar cancel pressed!');
    setText1('');
    setText2('');
  };

  const handleDone = () => {
    Alert.alert('Done', `Values: "${text1}", "${text2}"`);
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      <Text style={[styles.title, { 
        color: currentTheme.colors.text,
        fontFamily: 'Raleway_700Bold',
      }]}>
        Keyboard Toolbar Test
      </Text>
      
      <Text style={[styles.subtitle, { 
        color: currentTheme.colors.text,
        fontFamily: 'Raleway_400Regular',
        opacity: 0.7,
      }]}>
        Tap inputs to see keyboard toolbar (Development Build only)
      </Text>

      <TextInput
        style={[styles.input, { 
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
          color: currentTheme.colors.text,
          fontFamily: 'Raleway_400Regular',
        }]}
        placeholder="Test Input 1"
        placeholderTextColor={currentTheme.colors.text + '60'}
        value={text1}
        onChangeText={setText1}
        inputAccessoryViewID={inputAccessoryViewID}
      />

      <TextInput
        style={[styles.input, { 
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
          color: currentTheme.colors.text,
          fontFamily: 'Raleway_400Regular',
        }]}
        placeholder="Test Input 2"
        placeholderTextColor={currentTheme.colors.text + '60'}
        value={text2}
        onChangeText={setText2}
        inputAccessoryViewID={inputAccessoryViewID}
        keyboardType="numeric"
      />

      <KeyboardToolbar
        nativeID={inputAccessoryViewID}
        onCancel={handleCancel}
        onDone={handleDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
}); 