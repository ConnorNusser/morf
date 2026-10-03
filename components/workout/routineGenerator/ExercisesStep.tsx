import Button from '@/components/Button';
import Chip from '@/components/Chip';
import { Text } from '@/components/Themed';
import { GeneratorColors, stepStyles } from '@/components/workout/routineGenerator/routineGeneratorShared';
import { radius, screenGutter, space, tint, trend } from '@/lib/ui/tokens';
import { type } from '@/lib/ui/typography';
import { BrowseExercise } from '@/lib/workout/routineGeneratorOptions';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const MUSCLE_CATEGORIES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'];

interface ExercisesStepProps {
  colors: GeneratorColors;
  filteredExercises: BrowseExercise[];
  includedExercises: string[];
  excludedExercises: string[];
  exerciseSearchQuery: string;
  onSearchQueryChange: (query: string) => void;
  selectedMuscleFilter: string | null;
  onMuscleFilterChange: (muscle: string | null) => void;
  onExerciseCycle: (exerciseId: string) => void;
  onContinue: () => void;
}

const ExercisesStep: React.FC<ExercisesStepProps> = ({
  colors,
  filteredExercises,
  includedExercises,
  excludedExercises,
  exerciseSearchQuery,
  onSearchQueryChange,
  selectedMuscleFilter,
  onMuscleFilterChange,
  onExerciseCycle,
  onContinue,
}) => {
  const renderExerciseItem = ({ item }: { item: { id: string; name: string; muscleGroup: string } }) => {
    const isIncluded = includedExercises.includes(item.id);
    const isExcluded = excludedExercises.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.exerciseRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isIncluded && { backgroundColor: tint(colors.success), borderColor: colors.success },
          isExcluded && { backgroundColor: tint(trend.down), borderColor: trend.down },
        ]}
        onPress={() => onExerciseCycle(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseInfo}>
          <Text
            variant="body"
            tone="primary"
            weight="medium"
            style={[
              styles.exerciseName,
              isIncluded && { color: colors.success },
              isExcluded && { color: trend.down },
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text variant="meta" tone="faint">
            {item.muscleGroup}
          </Text>
        </View>
        <View style={styles.exerciseStatus}>
          {isIncluded && (
            <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          )}
          {isExcluded && (
            <View style={[styles.statusBadge, { backgroundColor: trend.down }]}>
              <Ionicons name="remove" size={14} color="#fff" />
            </View>
          )}
          {!isIncluded && !isExcluded && (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderExercisesHeader = () => (
    <Text variant="meta" tone="faint" style={styles.exercisesHint}>
      Optionally pick exercises — tap to cycle: include → exclude → reset
    </Text>
  );

  return (
    <View style={styles.exercisesContainer}>
      <View style={styles.exercisesHeader}>
        <View>
          <Text variant="meta" weight="semiBold" style={stepStyles.stepLabel}>STEP 6</Text>
          <Text variant="heading" tone="primary" weight="bold">Exercise preferences</Text>
        </View>
        {(includedExercises.length > 0 || excludedExercises.length > 0) && (
          <View style={[styles.selectionPill, { backgroundColor: colors.surface }]}>
            {includedExercises.length > 0 && (
              <Text variant="meta" weight="semiBold" style={{ color: colors.success }}>
                +{includedExercises.length}
              </Text>
            )}
            {includedExercises.length > 0 && excludedExercises.length > 0 && (
              <Text variant="meta" tone="faint">/</Text>
            )}
            {excludedExercises.length > 0 && (
              <Text variant="meta" weight="semiBold" style={{ color: trend.down }}>
                -{excludedExercises.length}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.searchFilterRow}>
        <View style={[styles.exerciseSearchContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.exerciseSearchInput, { color: colors.text }]}
            placeholder="Search..."
            placeholderTextColor={colors.textMuted}
            value={exerciseSearchQuery}
            onChangeText={onSearchQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {exerciseSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => onSearchQueryChange('')} hitSlop={12}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.muscleFilterContainer}
        contentContainerStyle={styles.muscleFilterContent}
      >
        <Chip
          label="All"
          selected={selectedMuscleFilter === null}
          onPress={() => onMuscleFilterChange(null)}
        />
        {MUSCLE_CATEGORIES.map((muscle) => (
          <Chip
            key={muscle}
            label={muscle.charAt(0).toUpperCase() + muscle.slice(1)}
            selected={selectedMuscleFilter === muscle}
            onPress={() => onMuscleFilterChange(selectedMuscleFilter === muscle ? null : muscle)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={filteredExercises}
        renderItem={renderExerciseItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderExercisesHeader}
        style={styles.exerciseList}
        contentContainerStyle={styles.exerciseListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        windowSize={7}
      />

      <View style={[styles.exercisesBottomBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <Button title="Generate Routine" onPress={onContinue} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  exercisesContainer: {
    flex: 1,
    paddingHorizontal: screenGutter,
    paddingTop: space.lg,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.md,
  },
  exercisesHint: {
    marginBottom: space.md,
  },
  selectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    gap: space.xs,
  },
  searchFilterRow: {
    marginBottom: space.sm,
  },
  muscleFilterContainer: {
    flexGrow: 0,
    marginBottom: space.md,
    marginHorizontal: -screenGutter,
  },
  muscleFilterContent: {
    paddingHorizontal: screenGutter,
    gap: space.sm,
  },
  exerciseSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.control,
    gap: space.sm,
  },
  exerciseSearchInput: {
    flex: 1,
    fontSize: type.meta,
    paddingVertical: 0,
  },
  exerciseList: {
    flex: 1,
    marginBottom: 0,
  },
  exerciseListContent: {
    gap: space.sm,
    paddingBottom: space.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  exerciseInfo: {
    flex: 1,
    marginRight: space.md,
  },
  exerciseName: {
    marginBottom: space.xs,
  },
  exerciseStatus: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisesBottomBar: {
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default ExercisesStep;
