import React, { useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { MuscleGroup } from '@/types';
import { Ionicons } from '@expo/vector-icons';

// All trackable muscle groups
const ALL_MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'];

export interface MuscleExerciseInfo {
  id: string;
  name: string;
  count: number; // number of times performed
}

export interface MuscleGroupData {
  muscle: MuscleGroup;
  count: number; // total exercise count for this muscle
  exercises: MuscleExerciseInfo[]; // exercises that contributed
}

interface MuscleFocusChipsProps {
  muscleData: MuscleGroupData[];
  showMissing?: boolean;
}

const getMuscleGroupLabel = (muscle: MuscleGroup): string => {
  switch (muscle) {
    case 'chest': return 'Chest';
    case 'back': return 'Back';
    case 'shoulders': return 'Shoulders';
    case 'arms': return 'Arms';
    case 'legs': return 'Legs';
    case 'glutes': return 'Glutes';
    case 'core': return 'Core';
    case 'full-body': return 'Full Body';
    default: return muscle;
  }
};

export default function MuscleFocusChips({ muscleData, showMissing = true }: MuscleFocusChipsProps) {
  const { currentTheme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroupData | null>(null);

  // Build trained/missed lists
  const trainedMuscles = muscleData.filter(m => m.count > 0);
  const trainedMuscleGroups = trainedMuscles.map(m => m.muscle);
  const missedMuscles = ALL_MUSCLE_GROUPS.filter(m => !trainedMuscleGroups.includes(m));

  const handleChipPress = (muscleGroup: MuscleGroup) => {
    const data = muscleData.find(m => m.muscle === muscleGroup);
    if (data && data.count > 0) {
      setSelectedMuscle(data);
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedMuscle(null);
  };

  return (
    <>
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.medium }]}>
          Muscle Focus
        </Text>
        <View style={styles.chipsContainer}>
          {ALL_MUSCLE_GROUPS.map(muscle => {
            const data = muscleData.find(m => m.muscle === muscle);
            const isTrained = data && data.count > 0;
            const count = data?.count || 0;

            return (
              <TouchableOpacity
                key={muscle}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isTrained
                      ? currentTheme.colors.primary + '1A'
                      : 'transparent',
                    borderColor: isTrained
                      ? currentTheme.colors.primary + '4D'
                      : currentTheme.colors.border,
                  },
                ]}
                onPress={() => handleChipPress(muscle)}
                activeOpacity={isTrained ? 0.7 : 1}
                disabled={!isTrained}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isTrained
                        ? currentTheme.colors.primary
                        : currentTheme.colors.text + '4D',
                      fontFamily: isTrained ? currentTheme.fonts.medium : currentTheme.fonts.regular,
                    },
                  ]}
                >
                  {getMuscleGroupLabel(muscle)}
                </Text>
                {isTrained && count > 1 && (
                  <View style={[styles.countBadge, { backgroundColor: currentTheme.colors.primary }]}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {showMissing && missedMuscles.length > 0 && trainedMuscles.length > 0 && (
          <Text style={[styles.missedHint, { color: currentTheme.colors.text + '4D', fontFamily: currentTheme.fonts.regular }]}>
            Missing: {missedMuscles.map(m => getMuscleGroupLabel(m)).join(', ')}
          </Text>
        )}
      </View>

      {/* Exercise Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              {selectedMuscle ? getMuscleGroupLabel(selectedMuscle.muscle) : ''}
            </Text>
            <View style={styles.closeButton} />
          </View>

          {/* Content */}
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            {selectedMuscle && (
              <>
                <Text style={[styles.exerciseCount, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                  {selectedMuscle.count} exercise{selectedMuscle.count !== 1 ? 's' : ''} this period
                </Text>

                <View style={styles.exerciseList}>
                  {selectedMuscle.exercises
                    .sort((a, b) => b.count - a.count)
                    .map((exercise, index) => (
                      <View
                        key={exercise.id + index}
                        style={[styles.exerciseRow, { borderBottomColor: currentTheme.colors.border }]}
                      >
                        <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                          {exercise.name}
                        </Text>
                        <View style={[styles.exerciseCountBadge, { backgroundColor: currentTheme.colors.primary + '15' }]}>
                          <Text style={[styles.exerciseCountText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>
                            {exercise.count}x
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {},
  sectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
  },
  countBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  missedHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 12,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
  },
  exerciseCount: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  exerciseList: {
    gap: 0,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseName: {
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
  },
  exerciseCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 12,
  },
  exerciseCountText: {
    fontSize: 13,
  },
});
