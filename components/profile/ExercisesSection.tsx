import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { userService } from '@/lib/services/userService';
import { ALL_WORKOUTS } from '@/lib/workout/workouts';
import { Equipment, UserLift, Workout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'smith-machine', label: 'Smith Machine' },
  { value: 'cable', label: 'Cable' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

export default function ExercisesSection() {
  const { currentTheme } = useTheme();
  const [userLifts, setUserLifts] = useState<UserLift[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const profile = await userService.getRealUserProfile();
      if (profile) {
        const allLifts = [...(profile.lifts || []), ...(profile.secondaryLifts || [])];
        setUserLifts(allLifts);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

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
  };

  const getLiftRecordForExercise = useCallback((exerciseId: string): UserLift | null => {
    const liftsForExercise = userLifts.filter(lift => lift.id === exerciseId);
    if (liftsForExercise.length === 0) return null;

    return liftsForExercise.reduce((best, current) => {
      const bestOneRM = best.weight * (1 + best.reps / 30);
      const currentOneRM = current.weight * (1 + current.reps / 30);
      return currentOneRM > bestOneRM ? current : best;
    });
  }, [userLifts]);

  const filteredExercises = useMemo(() => {
    let result = ALL_WORKOUTS;

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
  }, [searchQuery, equipmentFilter]);

  const renderExerciseItem = (exercise: Workout) => {
    const liftRecord = getLiftRecordForExercise(exercise.id);

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
            }
          ]}>
            {exercise.name}
          </Text>

          <View style={styles.metadataRow}>
            {exercise.equipment && exercise.equipment.length > 0 && (
              <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.primary + '15' }]}>
                <Text style={[styles.metadataChipText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>
                  {exercise.equipment[0]}
                </Text>
              </View>
            )}
            {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
              <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.text + '10' }]}>
                <Text style={[styles.metadataChipText, { color: currentTheme.colors.text + '70', fontFamily: currentTheme.fonts.medium }]}>
                  {exercise.primaryMuscles.join(', ')}
                </Text>
              </View>
            )}
            {exercise.category && (
              <View style={[styles.metadataChip, { backgroundColor: currentTheme.colors.text + '10' }]}>
                <Text style={[styles.metadataChipText, { color: currentTheme.colors.text + '70', fontFamily: currentTheme.fonts.medium }]}>
                  {exercise.category}
                </Text>
              </View>
            )}
          </View>

          {liftRecord && (
            <View style={[styles.liftRecordRow, { backgroundColor: currentTheme.colors.accent + '15' }]}>
              <Ionicons name="trophy" size={12} color={currentTheme.colors.accent} />
              <Text style={[styles.liftRecordText, { color: currentTheme.colors.accent, fontFamily: currentTheme.fonts.semiBold }]}>
                PR: {liftRecord.weight} {liftRecord.unit} x {liftRecord.reps}
              </Text>
            </View>
          )}

          <Text style={[
            styles.exerciseId,
            {
              color: currentTheme.colors.text + '50',
            }
          ]} numberOfLines={1}>
            ID: {exercise.id}
          </Text>
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
                }
              ]}>
                Exercises
              </Text>
              <View style={[styles.badge, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                <Text style={[styles.badgeText, { color: currentTheme.colors.primary }]}>
                  {ALL_WORKOUTS.length}
                </Text>
              </View>
            </View>
            <Text style={[
              styles.subtitle,
              {
                color: currentTheme.colors.primary,
              }
            ]}>
              {ALL_WORKOUTS.length} built-in exercises
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
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
          <View style={styles.modalHeader}>
            <View style={{ width: 40 }} />
            <Text style={[styles.modalHeaderTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              Exercises
            </Text>
            <TouchableOpacity
              onPress={closeModal}
              style={[styles.closeButton, { backgroundColor: currentTheme.colors.surface }]}
            >
              <Ionicons name="close" size={20} color={currentTheme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={[styles.searchBar, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <Ionicons name="search" size={18} color={currentTheme.colors.text + '60'} />
              <TextInput
                style={[styles.searchInput, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.regular }]}
                placeholder="Search by name, muscle, equipment..."
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
                  }
                ]}>
                  {eq.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            style={styles.exercisesList}
            contentContainerStyle={styles.exercisesListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredExercises.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: currentTheme.colors.surface }]}>
                <Ionicons
                  name="search-outline"
                  size={32}
                  color={currentTheme.colors.text + '40'}
                />
                <Text style={[
                  styles.emptyText,
                  { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.medium }
                ]}>
                  No exercises found
                </Text>
                <Text style={[
                  styles.emptySubtext,
                  { color: currentTheme.colors.text + '40', fontFamily: currentTheme.fonts.regular }
                ]}>
                  Try a different search term
                </Text>
              </View>
            ) : (
              <>
                {searchQuery && (
                  <Text style={[styles.resultsCount, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                    {filteredExercises.length} result{filteredExercises.length !== 1 ? 's' : ''}
                  </Text>
                )}
                {filteredExercises.map((exercise) => renderExerciseItem(exercise))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
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
  liftRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  liftRecordText: {
    fontSize: 11,
  },
  exerciseId: {
    fontSize: 11,
    marginTop: 2,
  },
});
