import Card from '@/components/Card';
import IconButton from '@/components/IconButton';
import { Text, View, useInk } from '@/components/Themed';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { storageService } from '@/lib/storage/storage';
import { EXERCISE_CATALOG } from '@/lib/workout/exerciseCatalog';
import { Equipment, UserLift, Exercise } from '@/types';
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
  const ink = useInk();
  const [userLifts, setUserLifts] = useState<UserLift[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Per-exercise record (last real working set) is the source of the shown record.
      const records = await storageService.getExerciseRecords();
      setUserLifts(
        Object.values(records).map(r => ({
          parentId: '',
          id: r.exerciseId,
          weight: r.weight,
          reps: r.reps,
          unit: r.unit,
          dateRecorded: r.updatedAt,
        }))
      );
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const openModal = () => {
    playHapticFeedback('selection', false);
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
    let result = EXERCISE_CATALOG;

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

  const renderExerciseItem = (exercise: Exercise) => {
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

          {liftRecord && (
            <View style={[styles.liftRecordRow, { backgroundColor: tint(currentTheme.colors.accent) }]}>
              <Ionicons name="trophy" size={12} color={currentTheme.colors.accent} />
              <Text variant="meta" weight="semiBold" style={[styles.liftRecordText, { color: currentTheme.colors.accent }]}>
                PR: {liftRecord.weight} {liftRecord.unit} x {liftRecord.reps}
              </Text>
            </View>
          )}

          <Text variant="meta" tone="faint" style={styles.exerciseId} numberOfLines={1}>
            ID: {exercise.id}
          </Text>
        </View>
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
                Exercises
              </Text>
              <View style={[styles.badge, { backgroundColor: tint(currentTheme.colors.primary) }]}>
                <Text variant="meta" style={styles.badgeText}>
                  {EXERCISE_CATALOG.length}
                </Text>
              </View>
            </View>
            <Text variant="meta" style={styles.subtitle}>
              {EXERCISE_CATALOG.length} built-in exercises
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
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
          <View style={styles.modalHeader}>
            <View style={{ width: 40 }} />
            <Text variant="emphasis" tone="primary" weight="semiBold" style={styles.modalHeaderTitle}>
              Exercises
            </Text>
            <IconButton icon="close" onPress={closeModal} />
          </View>

          <View style={styles.searchContainer}>
            <View style={[styles.searchBar, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <Ionicons name="search" size={18} color={ink.muted} />
              <TextInput
                style={[styles.searchInput, { color: currentTheme.colors.text, fontWeight: '400' }]}
                placeholder="Search by name, muscle, equipment..."
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
                  color={ink.faint}
                />
                <Text variant="body" tone="muted" weight="medium" style={styles.emptyText}>
                  No exercises found
                </Text>
                <Text variant="meta" tone="faint" weight="regular" style={styles.emptySubtext}>
                  Try a different search term
                </Text>
              </View>
            ) : (
              <>
                {searchQuery && (
                  <Text variant="meta" tone="muted" weight="regular" style={styles.resultsCount}>
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
  liftRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
    alignSelf: 'flex-start',
    marginBottom: space.sm,
  },
  liftRecordText: {
  },
  exerciseId: {
    marginTop: 2,
  },
});
