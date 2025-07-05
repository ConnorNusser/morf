import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface ProgressBarModalProps {
  visible: boolean;
  onClose: () => void;
  progress: number;
  currentWeight?: number;
  targetWeight?: number;
  exerciseName?: string;
}

export default function ProgressBarModal({
  visible,
  onClose,
  progress,
  currentWeight,
  targetWeight,
  exerciseName,
}: ProgressBarModalProps) {
  const { currentTheme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.modal, { backgroundColor: currentTheme.colors.surface }]}>
          <Text style={[
            styles.title, 
            { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_700Bold',
            }
          ]}>
            {exerciseName ? `${exerciseName} Progress` : 'Progress Details'}
          </Text>
          
          <View style={styles.content}>
            <Text style={[
              styles.label, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              Progress: {Math.round(progress)}%
            </Text>
            
            {currentWeight && (
              <Text style={[
                styles.label, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Current: {currentWeight}lbs
              </Text>
            )}
            
            {targetWeight && (
              <Text style={[
                styles.label, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Target: {targetWeight}lbs
              </Text>
            )}
          </View>
          
          <Pressable style={[styles.closeButton, { backgroundColor: currentTheme.colors.primary }]} onPress={onClose}>
            <Text style={[
              styles.closeText,
              { fontFamily: 'Raleway_600SemiBold' }
            ]}>
              Close
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    margin: 20,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    minWidth: 250,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  content: {
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  closeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeText: {
    color: 'white',
    fontWeight: 'bold',
  },
}); 