import Card from '@/components/Card';
import { formatFullDate as formatDate } from '@/lib/ui/formatters';
import { useAlert } from '@/components/CustomAlert';
import { Text, View, useInk } from '@/components/Themed';
import { danger, radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { aiWorkoutGenerator } from '@/lib/ai/aiWorkoutGenerator';
import { ALL_EQUIPMENT, EQUIPMENT_LABELS, formatEquipmentLabel } from '@/lib/workout/equipment';
import playHapticFeedback from '@/lib/utils/haptic';
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

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = ALL_EQUIPMENT.map(value => ({
  value,
  label: EQUIPMENT_LABELS[value],
}));

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

interface ExerciseEditFormProps {
  editedName: string;
  setEditedName: (v: string) => void;
  selectedEquipment: Equipment;
  setSelectedEquipment: (v: Equipment) => void;
  onCancel: () => void;
  onSave: () => void;
  placeholder: string;
  saveLabel: string;
  hint?: string;
  saving?: boolean;
}

// Custom-exercise name/equipment form with a live full-name + id preview; shared by add and edit flows.
function ExerciseEditForm({
  editedName, setEditedName, selectedEquipment, setSelectedEquipment,
  onCancel, onSave, placeholder, saveLabel, hint, saving = false,
}: ExerciseEditFormProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const fullNamePreview = editedName.trim()
    ? generateFullExerciseName(editedName, selectedEquipment)
    : '';
  const previewId = fullNamePreview ? generateExerciseId(fullNamePreview) : 'exercise-id';

  return (
    <View style={styles.editForm}>
      <Text variant="meta" tone="secondary" weight="medium" style={styles.editLabel}>
        Exercise Name (without equipment)
      </Text>
      <TextInput
        style={[
          styles.editInput,
          {
            backgroundColor: currentTheme.colors.background,
            color: currentTheme.colors.text,
            borderColor: currentTheme.colors.border,
          }
        ]}
        value={editedName}
        onChangeText={setEditedName}
        placeholder={placeholder}
        placeholderTextColor={ink.faint}
        autoFocus
      />

      <Text variant="meta" tone="secondary" weight="medium" style={[styles.editLabel, { marginTop: space.md }]}>
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
            <Text
              variant="meta"
              style={[
                styles.equipmentChipText,
                {
                  color: selectedEquipment === eq.value ? '#FFFFFF' : currentTheme.colors.text,
                }
              ]}
            >
              {eq.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {fullNamePreview && (
        <View style={[styles.previewBox, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]}>
          <Text variant="meta" tone="faint" weight="regular" style={styles.previewLabel}>
            Full Name:
          </Text>
          <Text variant="meta" tone="primary" weight="semiBold" style={styles.previewValue}>
            {fullNamePreview}
          </Text>
          <Text variant="meta" tone="faint" weight="regular" style={[styles.previewLabel, { marginTop: space.xs }]}>
            ID:
          </Text>
          <Text variant="meta" tone="secondary" weight="regular" style={styles.previewValue}>
            {previewId}
          </Text>
        </View>
      )}

      {hint && (
        <Text variant="meta" tone="faint" weight="regular" style={styles.hintText}>
          {hint}
        </Text>
      )}

      <View style={styles.editActions}>
        <TouchableOpacity
          style={[styles.editActionButton, { backgroundColor: currentTheme.colors.background }]}
          onPress={onCancel}
          disabled={saving}
        >
          <Text variant="meta" tone="primary" weight="semiBold" style={styles.editActionText}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.editActionButton,
            { backgroundColor: currentTheme.colors.primary },
            (!editedName.trim() || saving) && styles.disabledButton
          ]}
          onPress={onSave}
          disabled={!editedName.trim() || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text variant="meta" weight="semiBold" style={[styles.editActionText, { color: '#FFFFFF' }]}>
              {saveLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CustomExercisesSection({ onExercisesUpdate }: CustomExercisesSectionProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
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

  const handleStartEdit = (exercise: CustomExercise) => {
    playHapticFeedback('selection', false);
    setEditingExercise(exercise);
    setEditedName(extractBaseName(exercise.name));
    setSelectedEquipment(exercise.equipment?.[0] ?? 'machine');
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
          <ExerciseEditForm
            editedName={editedName}
            setEditedName={setEditedName}
            selectedEquipment={selectedEquipment}
            setSelectedEquipment={setSelectedEquipment}
            onCancel={handleCancelEditAdd}
            onSave={handleSaveEdit}
            placeholder="Enter exercise name"
            saveLabel="Save"
          />
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
          <Text variant="body" tone="primary" style={styles.exerciseName}>
            {exercise.name}
          </Text>

          <View style={styles.metadataRow}>
            {exercise.equipment && exercise.equipment.length > 0 && (
              <View style={[styles.metadataChip, { backgroundColor: tint(currentTheme.colors.primary) }]}>
                <Text variant="meta" weight="medium" style={styles.metadataChipText}>
                  {exercise.equipment[0]}
                </Text>
              </View>
            )}
            {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
              <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.text + '10' }]}>
                <Text variant="meta" tone="secondary" weight="medium" style={styles.metadataChipText}>
                  {exercise.primaryMuscles.join(', ')}
                </Text>
              </View>
            )}
            {exercise.category && (
              <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.text + '10' }]}>
                <Text variant="meta" tone="secondary" weight="medium" style={styles.metadataChipText}>
                  {exercise.category}
                </Text>
              </View>
            )}
          </View>

          <Text variant="meta" tone="faint" style={styles.exerciseId} numberOfLines={1}>
            ID: {exercise.id}
          </Text>
          <Text variant="meta" tone="faint" style={styles.exerciseDate}>
            Created {formatDate(exercise.createdAt)}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => handleStartEdit(exercise)}
            style={[styles.actionButton, { backgroundColor: tint(currentTheme.colors.primary) }]}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil" size={16} color={currentTheme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteExercise(exercise)}
            style={[styles.actionButton, { backgroundColor: danger + '15' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={18} color={danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAddForm = () => {
    if (!isAdding) return null;

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
        <ExerciseEditForm
          editedName={editedName}
          setEditedName={setEditedName}
          selectedEquipment={selectedEquipment}
          setSelectedEquipment={setSelectedEquipment}
          onCancel={handleCancelEditAdd}
          onSave={handleSaveAdd}
          placeholder="e.g., Super Horizontal Press"
          saveLabel="Add"
          hint="AI will generate muscle group metadata"
          saving={isGenerating}
        />
      </View>
    );
  };

  return (
    <>
      <Card style={styles.card}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={openModal}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderContent}>
            <View style={styles.titleRow}>
              <Text variant="title" weight="bold" tone="primary" style={styles.sectionTitle}>
                Custom Exercises
              </Text>
              {customExercises.length > 0 && (
                <View style={[styles.badge, { backgroundColor: tint(currentTheme.colors.primary) }]}>
                  <Text variant="meta" style={styles.badgeText}>
                    {customExercises.length}
                  </Text>
                </View>
              )}
            </View>
            <Text variant="meta" style={styles.subtitle}>
              {getCustomSummary()}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={ink.primary}
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
                <Text variant="emphasis" tone="primary" weight="semiBold" style={styles.modalHeaderTitle}>
                  Custom Exercises
                </Text>
                <TouchableOpacity
                  onPress={closeModal}
                  style={[styles.closeButton, { backgroundColor: currentTheme.colors.surface }]}
                >
                  <Ionicons name="close" size={20} color={ink.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.disclaimerBanner, { backgroundColor: tint(currentTheme.colors.primary), borderColor: currentTheme.colors.primary + '30' }]}>
                <Ionicons name="sparkles" size={16} color={currentTheme.colors.primary} />
                <Text variant="meta" tone="secondary" weight="regular" style={styles.disclaimerText}>
                  Custom exercises are auto-created when you log workouts with new exercises. You can also add them manually here.
                </Text>
              </View>

              <View style={styles.searchContainer}>
                <View style={[styles.searchBar, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                  <Ionicons name="search" size={18} color={ink.muted} />
                  <TextInput
                    style={[styles.searchInput, { color: currentTheme.colors.text, fontWeight: '400' }]}
                    placeholder="Search exercises..."
                    placeholderTextColor={ink.faint}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color={ink.muted} />
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
                  <Text
                    variant="meta"
                    style={[
                      styles.filterChipText,
                      {
                        color: equipmentFilter === 'all' ? '#FFFFFF' : currentTheme.colors.text,
                      }
                    ]}
                  >
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
                    <Text
                      variant="meta"
                      style={[
                        styles.filterChipText,
                        {
                          color: equipmentFilter === eq.value ? '#FFFFFF' : currentTheme.colors.text,
                        }
                      ]}
                    >
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
                    <Text variant="meta" weight="semiBold" style={styles.addButtonText}>
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
                      color={ink.faint}
                    />
                    <Text variant="body" tone="muted" weight="medium" style={styles.emptyText}>
                      {searchQuery ? 'No exercises found' : 'No custom exercises yet'}
                    </Text>
                    <Text variant="meta" tone="faint" weight="regular" style={styles.emptySubtext}>
                      {searchQuery
                        ? 'Try a different search term'
                        : 'Log workouts with new exercises and they\'ll appear here'}
                    </Text>
                  </View>
                ) : (
                  <>
                    {searchQuery && (
                      <Text variant="meta" tone="muted" weight="regular" style={styles.resultsCount}>
                        {filteredCustomExercises.length} result{filteredCustomExercises.length !== 1 ? 's' : ''}
                      </Text>
                    )}

                    {filteredCustomExercises.map((exercise) => renderCustomExerciseItem(exercise))}

                    {customExercises.length > 0 && !searchQuery && !isAdding && !editingExercise && (
                      <TouchableOpacity
                        style={[styles.clearAllButton, { backgroundColor: currentTheme.colors.surface, borderWidth: 1, borderColor: danger + '30' }]}
                        onPress={handleClearAll}
                        activeOpacity={0.7}
                      >
                        <Text variant="meta" weight="semiBold" style={styles.clearAllText}>
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
    gap: space.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sectionTitle: {
  },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  badgeText: {
  },
  subtitle: {
    opacity: 0.8,
    marginTop: space.xs,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
  },
  modalHeaderTitle: {
    lineHeight: 22,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    marginHorizontal: screenGutter,
    marginBottom: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  disclaimerText: {
    flex: 1,
    lineHeight: 18,
  },
  searchContainer: {
    paddingHorizontal: screenGutter,
    paddingBottom: space.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    gap: space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  addButtonContainer: {
    paddingHorizontal: screenGutter,
    paddingBottom: space.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    borderRadius: radius.control,
    gap: space.sm,
  },
  addButtonText: {
    color: '#FFFFFF',
  },
  filterContainer: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: space.md,
  },
  filterContent: {
    paddingHorizontal: screenGutter,
    gap: space.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  filterChipText: {
    lineHeight: 18,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesListContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: 40,
  },
  resultsCount: {
    marginBottom: space.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: radius.card,
    gap: space.sm,
    marginTop: space.xl,
  },
  emptyText: {
    marginTop: space.xs,
  },
  emptySubtext: {
    textAlign: 'center',
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: space.lg,
    marginBottom: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  editingItem: {
    borderWidth: 2,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: space.md,
  },
  exerciseName: {
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  metadataChip: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
  },
  metadataChipText: {
    textTransform: 'capitalize',
  },
  exerciseId: {
    marginTop: 2,
  },
  exerciseDate: {
    marginTop: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearAllButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.control,
    marginTop: space.md,
  },
  clearAllText: {
    color: danger,
  },
  editForm: {
    flex: 1,
  },
  editLabel: {
    marginBottom: space.sm,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: radius.control,
    padding: space.md,
    fontSize: 15,
  },
  equipmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  equipmentChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  equipmentChipText: {
  },
  previewBox: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  previewLabel: {
  },
  previewValue: {
  },
  hintText: {
    marginTop: space.sm,
    fontStyle: 'italic',
  },
  editActions: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.lg,
  },
  editActionButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActionText: {
  },
  disabledButton: {
    opacity: 0.5,
  },
});
