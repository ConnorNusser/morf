import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import { useAlert } from '@/components/CustomAlert';
import CustomExercisesList from '@/components/profile/customExercises/CustomExercisesList';
import ExerciseSearchFilters from '@/components/profile/customExercises/ExerciseSearchFilters';
import { useCustomExerciseForm } from '@/components/profile/customExercises/useCustomExerciseForm';
import { Text, View, useInk } from '@/components/Themed';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { filterCustomExercises, getCustomExercisesSummary } from '@/lib/workout/customExercises';
import playHapticFeedback from '@/lib/utils/haptic';
import { CustomExercise, Equipment } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

interface CustomExercisesSectionProps {
  onExercisesUpdate?: () => Promise<void>;
}

export default function CustomExercisesSection({ onExercisesUpdate }: CustomExercisesSectionProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { showAlert } = useAlert();
  const { play: playSound } = useSound('pop');
  const {
    customExercises,
    deleteExercise,
    clearAll,
  } = useCustomExercises();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | 'all'>('all');
  const form = useCustomExerciseForm({ onExercisesUpdate, playSound });
  const { editingExercise, isAdding } = form;

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
    form.resetForm();
  };

  const filteredCustomExercises = useMemo(
    () => filterCustomExercises(customExercises, searchQuery, equipmentFilter),
    [customExercises, searchQuery, equipmentFilter],
  );

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
              {getCustomExercisesSummary(customExercises.length)}
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
                <IconButton icon="close" onPress={closeModal} />
              </View>

              <View style={[styles.disclaimerBanner, { backgroundColor: tint(currentTheme.colors.primary), borderColor: currentTheme.colors.primary + '30' }]}>
                <Ionicons name="sparkles" size={16} color={currentTheme.colors.primary} />
                <Text variant="meta" tone="secondary" weight="regular" style={styles.disclaimerText}>
                  Custom exercises are auto-created when you log workouts with new exercises. You can also add them manually here.
                </Text>
              </View>

              <ExerciseSearchFilters
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                equipmentFilter={equipmentFilter}
                setEquipmentFilter={setEquipmentFilter}
              />

              {!isAdding && !editingExercise && (
                <View style={styles.addButtonContainer}>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: currentTheme.colors.primary }]}
                    onPress={form.handleStartAdd}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text variant="meta" weight="semiBold" style={styles.addButtonText}>
                      Add Custom Exercise
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <CustomExercisesList
                exercises={filteredCustomExercises}
                totalCount={customExercises.length}
                searchQuery={searchQuery}
                form={form}
                onDelete={handleDeleteExercise}
                onClearAll={handleClearAll}
              />
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
});
