import Button from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { ParsedWorkout } from '@/lib/workoutNoteParser';
import { getWorkoutById } from '@/lib/workouts';
import { convertWeight, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface WorkoutConfirmationModalProps {
  visible: boolean;
  parsedWorkout: ParsedWorkout | null;
  duration: number; // in seconds
  weightUnit: WeightUnit;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
}

const WorkoutConfirmationModal: React.FC<WorkoutConfirmationModalProps> = ({
  visible,
  parsedWorkout,
  duration,
  weightUnit,
  onConfirm,
  onCancel,
  onEdit,
  isLoading = false,
}) => {
  const { currentTheme } = useTheme();

  // Calculate stats - convert all weights to user's preferred unit
  const stats = useMemo(() => {
    if (!parsedWorkout) {
      return { exercises: 0, sets: 0, volume: 0 };
    }

    const exercises = parsedWorkout.exercises.length;
    const sets = parsedWorkout.exercises.reduce((total, ex) => total + ex.sets.length, 0);
    const volume = parsedWorkout.exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => {
        // Convert weight to user's preferred unit before calculating volume
        const weightInPreferredUnit = convertWeight(set.weight, set.unit, weightUnit);
        return setTotal + (weightInPreferredUnit * set.reps);
      }, 0);
    }, 0);

    return { exercises, sets, volume: Math.round(volume) };
  }, [parsedWorkout, weightUnit]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (!parsedWorkout) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Ionicons name="close" size={28} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            Workout Summary
          </Text>
          <View style={styles.headerButton} />
        </View>

        {/* Stats Section */}
        <View style={[styles.statsContainer, { backgroundColor: currentTheme.colors.surface }]}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={24} color={currentTheme.colors.accent} />
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
              {formatDuration(duration)}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
              Duration
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
          <View style={styles.statItem}>
            <Ionicons name="barbell-outline" size={24} color={currentTheme.colors.accent} />
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
              {stats.exercises}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
              Exercises
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
          <View style={styles.statItem}>
            <Ionicons name="repeat-outline" size={24} color={currentTheme.colors.accent} />
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
              {stats.sets}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
              Sets
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
          <View style={styles.statItem}>
            <Ionicons name="trending-up-outline" size={24} color={currentTheme.colors.accent} />
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
              {stats.volume.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
              {weightUnit} Volume
            </Text>
          </View>
        </View>

        {/* Confidence indicator */}
        <View style={[styles.confidenceContainer, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.confidenceLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
            Parsing confidence: {Math.round(parsedWorkout.confidence * 100)}%
          </Text>
        </View>

        {/* Exercises List */}
        <ScrollView style={styles.exercisesList} contentContainerStyle={styles.exercisesContent}>
          {parsedWorkout.exercises.map((exercise, index) => {
            const exerciseInfo = exercise.matchedExerciseId
              ? getWorkoutById(exercise.matchedExerciseId)
              : null;

            return (
              <View
                key={index}
                style={[styles.exerciseCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
              >
                <View style={[styles.exerciseHeader, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    {exerciseInfo?.name || exercise.name}
                  </Text>
                  {exercise.isCustom && (
                    <View style={[styles.customBadge, { backgroundColor: currentTheme.colors.accent + '20' }]}>
                      <Text style={[styles.customBadgeText, { color: currentTheme.colors.accent, fontFamily: 'Raleway_500Medium' }]}>
                        Custom
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.setsContainer, { backgroundColor: 'transparent' }]}>
                  {/* Target Sets (Template) */}
                  {exercise.recommendedSets && exercise.recommendedSets.length > 0 && (
                    <View style={[styles.setsSection, { backgroundColor: 'transparent' }]}>
                      <Text style={[styles.sectionLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_600SemiBold' }]}>
                        Target
                      </Text>
                      {exercise.recommendedSets.map((set, setIndex) => (
                        <View key={setIndex} style={[styles.setRow, { backgroundColor: 'transparent' }]}>
                          <Text style={[styles.setNumber, { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }]}>
                            Set {setIndex + 1}
                          </Text>
                          <Text style={[styles.setDetails, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                            {set.weight > 0 ? `${set.weight} ${set.unit} × ${set.reps}` : `${set.reps} reps`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Actual Sets */}
                  <View style={[styles.setsSection, { backgroundColor: 'transparent' }]}>
                    {exercise.recommendedSets && exercise.recommendedSets.length > 0 && (
                      <Text style={[styles.sectionLabel, { color: currentTheme.colors.accent, fontFamily: 'Raleway_600SemiBold' }]}>
                        Actual
                      </Text>
                    )}
                    {exercise.sets.map((set, setIndex) => (
                      <View key={setIndex} style={[styles.setRow, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.setNumber, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
                          Set {setIndex + 1}
                        </Text>
                        <Text style={[styles.setDetails, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                          {set.weight > 0 ? `${set.weight} ${set.unit} × ${set.reps}` : `${set.reps} reps (bodyweight)`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.actionsContainer, { backgroundColor: currentTheme.colors.background, borderTopColor: currentTheme.colors.border }]}>
          {onEdit && (
            <Button
              title="Edit"
              onPress={onEdit}
              variant="secondary"
              size="large"
              style={styles.editButton}
            />
          )}
          <Button
            title={isLoading ? "Saving..." : "Save Workout"}
            onPress={onConfirm}
            variant="primary"
            size="large"
            style={styles.confirmButton}
            disabled={isLoading}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  confidenceContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  confidenceLabel: {
    fontSize: 12,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  exerciseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 16,
    flex: 1,
  },
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  customBadgeText: {
    fontSize: 11,
  },
  setsContainer: {
    gap: 12,
  },
  setsSection: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setNumber: {
    width: 50,
    fontSize: 13,
  },
  setDetails: {
    fontSize: 14,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    gap: 12,
  },
  editButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 2,
  },
});

export default WorkoutConfirmationModal;
