import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { storageService } from '@/lib/storage';
import { CustomExercise } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

interface CustomExercisesSectionProps {
  onExercisesUpdate?: () => Promise<void>;
}

export default function CustomExercisesSection({ onExercisesUpdate }: CustomExercisesSectionProps) {
  const { currentTheme } = useTheme();
  const { play: playSound } = useSound('pop');
  const [isExpanded, setIsExpanded] = useState(false);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<CustomExercise | null>(null);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const exercises = await storageService.getCustomExercises();
      setCustomExercises(exercises);
    } catch (error) {
      console.error('Error loading custom exercises:', error);
    }
  };

  const toggleExpanded = () => {
    playHapticFeedback('selection', false);
    setIsExpanded(!isExpanded);
  };

  const getSummary = () => {
    const count = customExercises.length;
    if (count === 0) {
      return 'No custom exercises yet';
    }
    return `${count} custom exercise${count === 1 ? '' : 's'}`;
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleEditExercise = (exercise: CustomExercise) => {
    playHapticFeedback('selection', false);
    setEditingExercise(exercise);
    setEditedName(exercise.name);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingExercise || !editedName.trim()) return;

    const trimmedName = editedName.trim();

    // Check if name changed
    if (trimmedName === editingExercise.name) {
      setEditModalVisible(false);
      return;
    }

    try {
      playHapticFeedback('medium', false);
      playSound();

      // Update the exercise with new name
      const updatedExercise: CustomExercise = {
        ...editingExercise,
        name: trimmedName,
      };

      await storageService.saveCustomExercise(updatedExercise);
      await loadData();

      if (onExercisesUpdate) {
        await onExercisesUpdate();
      }

      setEditModalVisible(false);
      setEditingExercise(null);
      setEditedName('');
    } catch (error) {
      console.error('Error updating exercise:', error);
      Alert.alert('Error', 'Failed to update exercise name');
    }
  };

  const handleCancelEdit = () => {
    Keyboard.dismiss();
    setEditModalVisible(false);
    setEditingExercise(null);
    setEditedName('');
  };

  const handleDeleteExercise = (exercise: CustomExercise) => {
    Alert.alert(
      'Delete Custom Exercise',
      `Are you sure you want to delete "${exercise.name}"?\n\nThis won't affect your workout history, but the exercise won't appear in AI suggestions anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              playHapticFeedback('medium', false);
              playSound();
              await storageService.deleteCustomExercise(exercise.id);
              await loadData();
              if (onExercisesUpdate) {
                await onExercisesUpdate();
              }
            } catch (error) {
              console.error('Error deleting custom exercise:', error);
              Alert.alert('Error', 'Failed to delete exercise');
            }
          }
        }
      ]
    );
  };

  const handleClearAll = () => {
    if (customExercises.length === 0) return;

    Alert.alert(
      'Clear All Custom Exercises',
      `This will delete all ${customExercises.length} custom exercises. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              playHapticFeedback('heavy', false);
              await storageService.clearCustomExercises();
              await loadData();
              if (onExercisesUpdate) {
                await onExercisesUpdate();
              }
            } catch (error) {
              console.error('Error clearing custom exercises:', error);
              Alert.alert('Error', 'Failed to clear exercises');
            }
          }
        }
      ]
    );
  };

  return (
    <>
      <Card style={styles.card} variant="clean">
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <View style={[styles.sectionHeaderContent, { backgroundColor: 'transparent' }]}>
            <View style={[styles.titleRow, { backgroundColor: 'transparent' }]}>
              <Text style={[
                styles.sectionTitle,
                {
                  color: currentTheme.colors.text,
                  fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
                }
              ]}>
                Custom Exercises
              </Text>
              {customExercises.length > 0 && (
                <View style={[styles.badge, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                  <Text style={[styles.badgeText, { color: currentTheme.colors.primary }]}>
                    {customExercises.length}
                  </Text>
                </View>
              )}
            </View>
            {!isExpanded && (
              <Text style={[
                styles.subtitle,
                {
                  color: currentTheme.colors.primary,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                {getSummary()}
              </Text>
            )}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={currentTheme.colors.text}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={[
              styles.description,
              {
                color: currentTheme.colors.text + '70',
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              These exercises were created from your workout notes. Tap an exercise to edit its name.
            </Text>

            {customExercises.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: currentTheme.colors.surface }]}>
                <Ionicons
                  name="barbell-outline"
                  size={32}
                  color={currentTheme.colors.text + '40'}
                />
                <Text style={[
                  styles.emptyText,
                  { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }
                ]}>
                  No custom exercises yet
                </Text>
                <Text style={[
                  styles.emptySubtext,
                  { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }
                ]}>
                  Log workouts with new exercises and they'll appear here
                </Text>
              </View>
            ) : (
              <>
                <ScrollView style={styles.exercisesList} showsVerticalScrollIndicator={false}>
                  {customExercises.map((exercise) => (
                    <TouchableOpacity
                      key={exercise.id}
                      style={[
                        styles.exerciseItem,
                        {
                          backgroundColor: currentTheme.colors.surface,
                          borderColor: currentTheme.colors.border + '30',
                        }
                      ]}
                      onPress={() => handleEditExercise(exercise)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.exerciseInfo}>
                        <View style={[styles.exerciseNameRow, { backgroundColor: 'transparent' }]}>
                          <Text style={[
                            styles.exerciseName,
                            {
                              color: currentTheme.colors.text,
                              fontFamily: 'Raleway_600SemiBold',
                            }
                          ]}>
                            {exercise.name}
                          </Text>
                          <Ionicons
                            name="pencil-outline"
                            size={14}
                            color={currentTheme.colors.primary}
                            style={styles.editIcon}
                          />
                        </View>
                        <Text style={[
                          styles.exerciseId,
                          {
                            color: currentTheme.colors.text + '50',
                            fontFamily: 'Raleway_400Regular',
                          }
                        ]} numberOfLines={1}>
                          ID: {exercise.id}
                        </Text>
                        <Text style={[
                          styles.exerciseDate,
                          {
                            color: currentTheme.colors.text + '40',
                            fontFamily: 'Raleway_400Regular',
                          }
                        ]}>
                          Created {formatDate(exercise.createdAt)}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteExercise(exercise);
                        }}
                        style={[styles.deleteButton, { backgroundColor: '#DC262610' }]}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#DC2626"
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.clearAllButton, { backgroundColor: '#DC262615' }]}
                  onPress={handleClearAll}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text style={[styles.clearAllText, { fontFamily: 'Raleway_600SemiBold' }]}>
                    Clear All Custom Exercises
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </Card>

      {/* Edit Exercise Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelEdit}
      >
        <TouchableWithoutFeedback onPress={handleCancelEdit}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalKeyboardView}
              >
                <View style={[styles.modalContent, { backgroundColor: currentTheme.colors.background }]}>
                  <Text style={[
                    styles.modalTitle,
                    { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }
                  ]}>
                    Edit Exercise Name
                  </Text>

                  <Text style={[
                    styles.modalLabel,
                    { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }
                  ]}>
                    Exercise Name
                  </Text>

                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: currentTheme.colors.surface,
                        color: currentTheme.colors.text,
                        borderColor: currentTheme.colors.border,
                        fontFamily: 'Raleway_500Medium',
                      }
                    ]}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Enter exercise name"
                    placeholderTextColor={currentTheme.colors.text + '40'}
                    autoFocus
                    selectTextOnFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveEdit}
                  />

                  {editingExercise && (
                    <Text style={[
                      styles.modalIdText,
                      { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }
                    ]}>
                      ID: {editingExercise.id}
                    </Text>
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton, { backgroundColor: currentTheme.colors.surface }]}
                      onPress={handleCancelEdit}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.cancelButtonText,
                        { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }
                      ]}>
                        Cancel
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.modalButton,
                        styles.saveButton,
                        { backgroundColor: currentTheme.colors.primary },
                        !editedName.trim() && styles.disabledButton
                      ]}
                      onPress={handleSaveEdit}
                      activeOpacity={0.7}
                      disabled={!editedName.trim()}
                    >
                      <Text style={[
                        styles.saveButtonText,
                        { fontFamily: 'Raleway_600SemiBold' }
                      ]}>
                        Save
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Raleway_600SemiBold',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  expandedContent: {
    paddingTop: 12,
    gap: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 4,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  exercisesList: {
    maxHeight: 300,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exerciseName: {
    fontSize: 15,
  },
  editIcon: {
    marginTop: 1,
  },
  exerciseId: {
    fontSize: 11,
    marginTop: 2,
  },
  exerciseDate: {
    fontSize: 11,
    marginTop: 1,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  clearAllText: {
    color: '#DC2626',
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalKeyboardView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  modalIdText: {
    fontSize: 12,
    marginTop: -8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {},
  cancelButtonText: {
    fontSize: 16,
  },
  saveButton: {},
  saveButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
