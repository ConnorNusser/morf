import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface ExerciseOptions {
  sets: number;
  reps: string;
  weight?: string;
}

interface ExerciseOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (options: ExerciseOptions) => void;
  title: string;
  initialValues?: ExerciseOptions;
  primaryButtonText?: string;
  showWeight?: boolean;
  weightLabel?: string;
  weightPlaceholder?: string;
}

export default function ExerciseOptionsModal({
  visible,
  onClose,
  onSave,
  title,
  initialValues = { sets: 3, reps: '8-12', weight: '' },
  primaryButtonText = 'Save',
  showWeight = true,
  weightLabel = 'Weight (optional)',
  weightPlaceholder = 'e.g. 135 lbs'
}: ExerciseOptionsModalProps) {
  const { currentTheme } = useTheme();
  const [options, setOptions] = useState<ExerciseOptions>(initialValues);

  // Reset to initial values when modal opens
  useEffect(() => {
    if (visible) {
      setOptions(initialValues);
    }
  }, [visible, initialValues]);

  const handleSave = () => {
    // Basic validation
    if (options.sets < 1 || options.sets > 20) {
      return; // Could show error message
    }
    if (!options.reps.trim()) {
      return; // Could show error message
    }

    onSave(options);
    onClose();
  };

  const handleCancel = () => {
    setOptions(initialValues); // Reset to initial values
    onClose();
  };

  const incrementSets = () => {
    setOptions(prev => ({ ...prev, sets: Math.min(20, prev.sets + 1) }));
  };

  const decrementSets = () => {
    setOptions(prev => ({ ...prev, sets: Math.max(1, prev.sets - 1) }));
  };

  const updateReps = (reps: string) => {
    setOptions(prev => ({ ...prev, reps }));
  };

  const updateWeight = (weight: string) => {
    setOptions(prev => ({ ...prev, weight }));
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdropTouchable} 
          activeOpacity={1} 
          onPress={handleCancel}
        />
        
        <View style={[
          styles.bottomPanel, 
          { 
            backgroundColor: currentTheme.colors.surface,
            borderTopColor: currentTheme.colors.border 
          }
        ]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[
              styles.title,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_700Bold',
              }
            ]}>
              {title}
            </Text>
            <TouchableOpacity 
              onPress={handleCancel}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} color={currentTheme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Options Container */}
          <View style={styles.optionsContainer}>
            {/* Sets */}
            <View style={styles.optionGroup}>
              <Text style={[
                styles.optionLabel, 
                { 
                  color: currentTheme.colors.text, 
                  fontFamily: 'Raleway_600SemiBold' 
                }
              ]}>
                Sets
              </Text>
              <View style={[
                styles.numberInputContainer,
                { backgroundColor: currentTheme.colors.background + '50' }
              ]}>
                <TouchableOpacity
                  style={[
                    styles.numberButton, 
                    { 
                      backgroundColor: currentTheme.colors.surface, 
                      borderColor: currentTheme.colors.border 
                    }
                  ]}
                  onPress={decrementSets}
                >
                  <Ionicons name="remove" size={16} color={currentTheme.colors.text} />
                </TouchableOpacity>
                <Text style={[
                  styles.numberValue, 
                  { 
                    color: currentTheme.colors.text, 
                    fontFamily: 'Raleway_600SemiBold' 
                  }
                ]}>
                  {options.sets}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.numberButton, 
                    { 
                      backgroundColor: currentTheme.colors.surface, 
                      borderColor: currentTheme.colors.border 
                    }
                  ]}
                  onPress={incrementSets}
                >
                  <Ionicons name="add" size={16} color={currentTheme.colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Reps */}
            <View style={styles.optionGroup}>
              <Text style={[
                styles.optionLabel, 
                { 
                  color: currentTheme.colors.text, 
                  fontFamily: 'Raleway_600SemiBold' 
                }
              ]}>
                Reps
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: currentTheme.colors.background,
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_500Medium',
                  }
                ]}
                value={options.reps}
                onChangeText={updateReps}
                placeholder="8-12"
                placeholderTextColor={currentTheme.colors.text + '60'}
              />
            </View>

            {/* Weight (optional) */}
            {showWeight && (
              <View style={styles.optionGroup}>
                <Text style={[
                  styles.optionLabel, 
                  { 
                    color: currentTheme.colors.text, 
                    fontFamily: 'Raleway_600SemiBold' 
                  }
                ]}>
                  {weightLabel}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: currentTheme.colors.background,
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}
                  value={options.weight || ''}
                  onChangeText={updateWeight}
                  placeholder={weightPlaceholder}
                  placeholderTextColor={currentTheme.colors.text + '60'}
                />
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                }
              ]}
              onPress={handleCancel}
            >
              <Text style={[
                styles.secondaryButtonText,
                {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton, 
                { backgroundColor: currentTheme.colors.primary }
              ]}
              onPress={handleSave}
            >
              <Text style={[
                styles.primaryButtonText,
                {
                  color: currentTheme.colors.background,
                  fontFamily: 'Raleway_700Bold',
                }
              ]}>
                {primaryButtonText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  bottomPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 40, // Extra padding for safe area
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    marginBottom: 24,
    gap: 20,
  },
  optionGroup: {
    gap: 10,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 24,
  },
  numberButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberValue: {
    fontSize: 22,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'center',
  },
  textInput: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 