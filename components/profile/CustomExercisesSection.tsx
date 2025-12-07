import Card from '@/components/Card';
import { useAlert } from '@/components/CustomAlert';
import { Text, View } from '@/components/Themed';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { aiWorkoutGenerator } from '@/lib/aiWorkoutGenerator';
import playHapticFeedback from '@/lib/haptic';
import { CustomExercise, Equipment } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

interface CustomExercisesSectionProps {
  onExercisesUpdate?: () => Promise<void>;
}

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'smith-machine', label: 'Smith Machine' },
  { value: 'cable', label: 'Cable' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

const formatEquipmentLabel = (equipment: Equipment): string => {
  switch (equipment) {
    case 'barbell': return 'Barbell';
    case 'dumbbell': return 'Dumbbell';
    case 'machine': return 'Machine';
    case 'smith-machine': return 'Smith Machine';
    case 'cable': return 'Cable';
    case 'kettlebell': return 'Kettlebell';
    case 'bodyweight': return 'Bodyweight';
    default: return equipment;
  }
};

const generateFullExerciseName = (baseName: string, equipment: Equipment): string => {
  const trimmedName = baseName.trim();
  const titleCased = trimmedName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return `${titleCased} (${formatEquipmentLabel(equipment)})`;
};

const generateExerciseId = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

export default function CustomExercisesSection({ onExercisesUpdate }: CustomExercisesSectionProps) {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
  const { play: playSound } = useSound('pop');
  const {
    customExercises,
    addExercise,
    updateExercise,
    deleteExercise,
    clearAll,
    getByName,
  } = useCustomExercises();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | 'all'>('all');
  const [editingExercise, setEditingExercise] = useState<CustomExercise | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>('machine');
  const [isGenerating, setIsGenerating] = useState(false);

  const openModal = () => {
    playHapticFeedback('selection', false);
    setSearchQuery('');
    setEquipmentFilter('all');
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setSearchQuery('');
    setEquipmentFilter('all');
    setEditingExercise(null);
    setIsAdding(false);
    setEditedName('');
    setSelectedEquipment('machine');
  };

  const getCustomSummary = () => {
    const count = customExercises.length;
    if (count === 0) return 'No custom exercises yet';
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

  const filteredCustomExercises = useMemo(() => {
    let result = customExercises;

    if (equipmentFilter !== 'all') {
      result = result.filter(ex => ex.equipment?.includes(equipmentFilter));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(ex =>
        ex.name.toLowerCase().includes(query) ||
        ex.id.toLowerCase().includes(query) ||
        ex.primaryMuscles?.some(m => m.toLowerCase().includes(query)) ||
        ex.equipment?.some(e => e.toLowerCase().includes(query)) ||
        ex.category?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [customExercises, searchQuery, equipmentFilter]);

  const extractBaseName = (fullName: string): string => {
    return fullName.replace(/\s*\([^)]+\)\s*$/, '').trim();
  };

  const extractEquipment = (exercise: CustomExercise): Equipment => {
    if (exercise.equipment && exercise.equipment.length > 0) {
      return exercise.equipment[0];
    }
    return 'machine';
  };

  const handleStartEdit = (exercise: CustomExercise) => {
    playHapticFeedback('selection', false);
    setEditingExercise(exercise);
    setEditedName(extractBaseName(exercise.name));
    setSelectedEquipment(extractEquipment(exercise));
    setIsAdding(false);
  };

  const handleStartAdd = () => {
    playHapticFeedback('selection', false);
    setIsAdding(true);
    setEditingExercise(null);
    setEditedName('');
    setSelectedEquipment('machine');
  };

  const handleCancelEditAdd = () => {
    Keyboard.dismiss();
    setIsAdding(false);
    setEditingExercise(null);
    setEditedName('');
    setSelectedEquipment('machine');
  };

  const handleSaveEdit = async () => {
    if (!editingExercise || !editedName.trim()) return;

    const fullName = generateFullExerciseName(editedName, selectedEquipment);
    const newId = generateExerciseId(fullName);

    try {
      playHapticFeedback('medium', false);
      playSound();

      const updatedExercise: CustomExercise = {
        ...editingExercise,
        id: newId,
        name: fullName,
        equipment: [selectedEquipment],
      };

      await updateExercise(editingExercise.id, updatedExercise);

      if (onExercisesUpdate) {
        await onExercisesUpdate();
      }

      setEditingExercise(null);
      setEditedName('');
      setSelectedEquipment('machine');
    } catch (error) {
      console.error('Error updating exercise:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to update exercise',
        type: 'error',
      });
    }
  };

  const handleSaveAdd = async () => {
    if (!editedName.trim()) return;

    const fullName = generateFullExerciseName(editedName, selectedEquipment);

    try {
      const existingCustom = getByName(fullName);
      if (existingCustom) {
        showAlert({
          title: 'Exercise Exists',
          message: `An exercise named "${fullName}" already exists.`,
          type: 'warning',
        });
        return;
      }

      setIsGenerating(true);
      playHapticFeedback('medium', false);
      playSound();

      const newExercise = await aiWorkoutGenerator.generateCustomExerciseMetadata(fullName);
      newExercise.equipment = [selectedEquipment];

      await addExercise(newExercise);

      if (onExercisesUpdate) {
        await onExercisesUpdate();
      }

      setIsAdding(false);
      setEditedName('');
      setSelectedEquipment('machine');
    } catch (error) {
      console.error('Error adding exercise:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to add exercise',
        type: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteExercise = (exercise: CustomExercise) => {
    showAlert({
      title: 'Delete Custom Exercise',
      message: `Are you sure you want to delete "${exercise.name}"?\n\nThis won't affect your workout history, but the exercise won't appear in AI suggestions anymore.`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              playHapticFeedback('medium', false);
              playSound();
              await deleteExercise(exercise.id);
              if (onExercisesUpdate) {
                await onExercisesUpdate();
              }
            } catch (error) {
              console.error('Error deleting custom exercise:', error);
              showAlert({
                title: 'Error',
                message: 'Failed to delete exercise',
                type: 'error',
              });
            }
          }
        },
      ],
    });
  };

  const handleClearAll = () => {
    if (customExercises.length === 0) return;

    showAlert({
      title: 'Clear All Custom Exercises',
      message: `This will delete all ${customExercises.length} custom exercises. This action cannot be undone.`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              playHapticFeedback('heavy', false);
              await clearAll();
              if (onExercisesUpdate) {
                await onExercisesUpdate();
              }
            } catch (error) {
              console.error('Error clearing custom exercises:', error);
              showAlert({
                title: 'Error',
                message: 'Failed to clear exercises',
                type: 'error',
              });
            }
          }
        },
      ],
    });
  };

  const renderCustomExerciseItem = (exercise: CustomExercise) => {
    const isEditing = editingExercise?.id === exercise.id;

    if (isEditing) {
      const fullNamePreview = editedName.trim()
        ? generateFullExerciseName(editedName, selectedEquipment)
        : '';
      const previewId = fullNamePreview ? generateExerciseId(fullNamePreview) : 'exercise-id';

      return (
        <View
          key={exercise.id}
          style={[
            styles.exerciseItem,
            styles.editingItem,
            {
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.primary,
            }
          ]}
        >
          <View style={styles.editForm}>
            <Text style={[styles.editLabel, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }]}>
              Exercise Name (without equipment)
            </Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  backgroundColor: currentTheme.colors.background,
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
            />

            <Text style={[styles.editLabel, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium', marginTop: 12 }]}>
              Equipment Type
            </Text>
            <View style={styles.equipmentRow}>
              {EQUIPMENT_OPTIONS.map((eq) => (
                <TouchableOpacity
                  key={eq.value}
                  style={[
                    styles.equipmentChip,
                    {
                      backgroundColor: selectedEquipment === eq.value
                        ? currentTheme.colors.primary
                        : currentTheme.colors.background,
                      borderColor: selectedEquipment === eq.value
                        ? currentTheme.colors.primary
                        : currentTheme.colors.border,
                    }
                  ]}
                  onPress={() => setSelectedEquipment(eq.value)}
                >
                  <Text style={[
                    styles.equipmentChipText,
                    {
                      color: selectedEquipment === eq.value ? '#FFFFFF' : currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    {eq.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {fullNamePreview && (
              <View style={[styles.previewBox, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]}>
                <Text style={[styles.previewLabel, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                  Full Name:
                </Text>
                <Text style={[styles.previewValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                  {fullNamePreview}
                </Text>
                <Text style={[styles.previewLabel, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular', marginTop: 4 }]}>
                  ID:
                </Text>
                <Text style={[styles.previewValue, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_400Regular' }]}>
                  {previewId}
                </Text>
              </View>
            )}

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editActionButton, { backgroundColor: currentTheme.colors.background }]}
                onPress={handleCancelEditAdd}
              >
                <Text style={[styles.editActionText, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editActionButton,
                  { backgroundColor: currentTheme.colors.primary },
                  !editedName.trim() && styles.disabledButton
                ]}
                onPress={handleSaveEdit}
                disabled={!editedName.trim()}
              >
                <Text style={[styles.editActionText, { color: '#FFFFFF', fontFamily: 'Raleway_600SemiBold' }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View
        key={exercise.id}
        style={[
          styles.exerciseItem,
          {
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }
        ]}
      >
        <View style={styles.exerciseInfo}>
          <Text style={[
            styles.exerciseName,
            {
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }
          ]}>
            {exercise.name}
          </Text>

          <View style={styles.metadataRow}>
            {exercise.equipment && exercise.equipment.length > 0 && (
              <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.primary + '15' }]}>
                <Text style={[styles.metadataChipText, { color: currentTheme.colors.primary, fontFamily: 'Raleway_500Medium' }]}>
                  {exercise.equipment[0]}
                </Text>
              </View>
            )}
            {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
              <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.text + '10' }]}>
                <Text style={[styles.metadataChipText, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }]}>
                  {exercise.primaryMuscles.join(', ')}
                </Text>
              </View>
            )}
            {exercise.category && (
              <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.text + '10' }]}>
                <Text style={[styles.metadataChipText, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }]}>
                  {exercise.category}
                </Text>
              </View>
            )}
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

        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => handleStartEdit(exercise)}
            style={[styles.actionButton, { backgroundColor: currentTheme.colors.primary + '15' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil" size={16} color={currentTheme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteExercise(exercise)}
            style={[styles.actionButton, { backgroundColor: '#DC262615' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAddForm = () => {
    if (!isAdding) return null;

    const fullNamePreview = editedName.trim()
      ? generateFullExerciseName(editedName, selectedEquipment)
      : '';
    const previewId = fullNamePreview ? generateExerciseId(fullNamePreview) : 'exercise-id';

    return (
      <View
        style={[
          styles.exerciseItem,
          styles.editingItem,
          {
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.primary,
          }
        ]}
      >
        <View style={styles.editForm}>
          <Text style={[styles.editLabel, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }]}>
            Exercise Name (without equipment)
          </Text>
          <TextInput
            style={[
              styles.editInput,
              {
                backgroundColor: currentTheme.colors.background,
                color: currentTheme.colors.text,
                borderColor: currentTheme.colors.border,
                fontFamily: 'Raleway_500Medium',
              }
            ]}
            value={editedName}
            onChangeText={setEditedName}
            placeholder="e.g., Super Horizontal Press"
            placeholderTextColor={currentTheme.colors.text + '40'}
            autoFocus
          />

          <Text style={[styles.editLabel, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium', marginTop: 12 }]}>
            Equipment Type
          </Text>
          <View style={styles.equipmentRow}>
            {EQUIPMENT_OPTIONS.map((eq) => (
              <TouchableOpacity
                key={eq.value}
                style={[
                  styles.equipmentChip,
                  {
                    backgroundColor: selectedEquipment === eq.value
                      ? currentTheme.colors.primary
                      : currentTheme.colors.background,
                    borderColor: selectedEquipment === eq.value
                      ? currentTheme.colors.primary
                      : currentTheme.colors.border,
                  }
                ]}
                onPress={() => setSelectedEquipment(eq.value)}
              >
                <Text style={[
                  styles.equipmentChipText,
                  {
                    color: selectedEquipment === eq.value ? '#FFFFFF' : currentTheme.colors.text,
                    fontFamily: 'Raleway_500Medium',
                  }
                ]}>
                  {eq.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {fullNamePreview && (
            <View style={[styles.previewBox, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]}>
              <Text style={[styles.previewLabel, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                Full Name:
              </Text>
              <Text style={[styles.previewValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                {fullNamePreview}
              </Text>
              <Text style={[styles.previewLabel, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular', marginTop: 4 }]}>
                ID:
              </Text>
              <Text style={[styles.previewValue, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_400Regular' }]}>
                {previewId}
              </Text>
            </View>
          )}

          <Text style={[styles.hintText, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
            AI will generate muscle group metadata
          </Text>

          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.editActionButton, { backgroundColor: currentTheme.colors.background }]}
              onPress={handleCancelEditAdd}
              disabled={isGenerating}
            >
              <Text style={[styles.editActionText, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.editActionButton,
                { backgroundColor: currentTheme.colors.primary },
                (!editedName.trim() || isGenerating) && styles.disabledButton
              ]}
              onPress={handleSaveAdd}
              disabled={!editedName.trim() || isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.editActionText, { color: '#FFFFFF', fontFamily: 'Raleway_600SemiBold' }]}>
                  Add
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <Card style={styles.card} variant="clean">
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={openModal}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderContent}>
            <View style={styles.titleRow}>
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
            <Text style={[
              styles.subtitle,
              {
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              {getCustomSummary()}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={currentTheme.colors.text}
          />
        </TouchableOpacity>
      </Card>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
            >
              <View style={styles.modalHeader}>
                <View style={{ width: 40 }} />
                <Text style={[styles.modalHeaderTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                  Custom Exercises
                </Text>
                <TouchableOpacity
                  onPress={closeModal}
                  style={[styles.closeButton, { backgroundColor: currentTheme.colors.surface }]}
                >
                  <Ionicons name="close" size={20} color={currentTheme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={[styles.disclaimerBanner, { backgroundColor: currentTheme.colors.primary + '10', borderColor: currentTheme.colors.primary + '30' }]}>
                <Ionicons name="sparkles" size={16} color={currentTheme.colors.primary} />
                <Text style={[styles.disclaimerText, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
                  Custom exercises are auto-created when you log workouts with new exercises. You can also add them manually here.
                </Text>
              </View>

              <View style={styles.searchContainer}>
                <View style={[styles.searchBar, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                  <Ionicons name="search" size={18} color={currentTheme.colors.text + '60'} />
                  <TextInput
                    style={[styles.searchInput, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}
                    placeholder="Search exercises..."
                    placeholderTextColor={currentTheme.colors.text + '40'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color={currentTheme.colors.text + '60'} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterContainer}
                contentContainerStyle={styles.filterContent}
              >
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: equipmentFilter === 'all'
                        ? currentTheme.colors.primary
                        : currentTheme.colors.surface,
                      borderColor: equipmentFilter === 'all'
                        ? currentTheme.colors.primary
                        : currentTheme.colors.border,
                    }
                  ]}
                  onPress={() => setEquipmentFilter('all')}
                >
                  <Text style={[
                    styles.filterChipText,
                    {
                      color: equipmentFilter === 'all' ? '#FFFFFF' : currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    All
                  </Text>
                </TouchableOpacity>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <TouchableOpacity
                    key={eq.value}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: equipmentFilter === eq.value
                          ? currentTheme.colors.primary
                          : currentTheme.colors.surface,
                        borderColor: equipmentFilter === eq.value
                          ? currentTheme.colors.primary
                          : currentTheme.colors.border,
                      }
                    ]}
                    onPress={() => setEquipmentFilter(eq.value)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      {
                        color: equipmentFilter === eq.value ? '#FFFFFF' : currentTheme.colors.text,
                        fontFamily: 'Raleway_500Medium',
                      }
                    ]}>
                      {eq.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {!isAdding && !editingExercise && (
                <View style={styles.addButtonContainer}>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: currentTheme.colors.primary }]}
                    onPress={handleStartAdd}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={[styles.addButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
                      Add Custom Exercise
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <ScrollView
                style={styles.exercisesList}
                contentContainerStyle={styles.exercisesListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {renderAddForm()}

                {filteredCustomExercises.length === 0 && !isAdding ? (
                  <View style={[styles.emptyState, { backgroundColor: currentTheme.colors.surface }]}>
                    <Ionicons
                      name={searchQuery ? "search-outline" : "barbell-outline"}
                      size={32}
                      color={currentTheme.colors.text + '40'}
                    />
                    <Text style={[
                      styles.emptyText,
                      { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }
                    ]}>
                      {searchQuery ? 'No exercises found' : 'No custom exercises yet'}
                    </Text>
                    <Text style={[
                      styles.emptySubtext,
                      { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }
                    ]}>
                      {searchQuery
                        ? 'Try a different search term'
                        : 'Log workouts with new exercises and they\'ll appear here'}
                    </Text>
                  </View>
                ) : (
                  <>
                    {searchQuery && (
                      <Text style={[styles.resultsCount, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                        {filteredCustomExercises.length} result{filteredCustomExercises.length !== 1 ? 's' : ''}
                      </Text>
                    )}

                    {filteredCustomExercises.map((exercise) => renderCustomExerciseItem(exercise))}

                    {customExercises.length > 0 && !searchQuery && !isAdding && !editingExercise && (
                      <TouchableOpacity
                        style={[styles.clearAllButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DC262630' }]}
                        onPress={handleClearAll}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.clearAllText, { fontFamily: 'Raleway_600SemiBold' }]}>
                          Clear All Custom Exercises
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalHeaderTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  addButtonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  filterContainer: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    lineHeight: 18,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesListContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  resultsCount: {
    fontSize: 13,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 4,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  editingItem: {
    borderWidth: 2,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  exerciseName: {
    fontSize: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  metadataChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metadataChipText: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  exerciseId: {
    fontSize: 11,
    marginTop: 2,
  },
  exerciseDate: {
    fontSize: 11,
    marginTop: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearAllButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 12,
  },
  clearAllText: {
    color: '#DC2626',
    fontSize: 14,
  },
  editForm: {
    flex: 1,
  },
  editLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  equipmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipmentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  equipmentChipText: {
    fontSize: 13,
  },
  previewBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewLabel: {
    fontSize: 11,
  },
  previewValue: {
    fontSize: 14,
  },
  hintText: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  editActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActionText: {
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
