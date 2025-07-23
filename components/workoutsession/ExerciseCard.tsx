import { Text, View } from '@/components/Themed';
import { Theme } from '@/lib/theme';
import { getRecommendedWeight } from '@/lib/utils';
import { getWorkoutById } from '@/lib/workouts';
import { WeightUnit, WorkoutExerciseSession } from '@/types';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import SetRow from './SetRow';
import SetTableHeader from './SetTableHeader';

interface ExerciseCardProps {
  exercise: WorkoutExerciseSession;
  exerciseIndex: number;
  setInputs: {
    [setIndex: number]: {
      weight: { value: number; unit: 'lbs' | 'kg' };
      reps: number;
    };
  };
  onSetInputChange: (setIndex: number, field: 'weight' | 'reps', value: any) => void;
  onCompleteSet: (setIndex: number) => void;
  onDeleteSet: (setIndex: number) => void;
  onDeleteExercise: () => void;
  onAddSet: () => void;
  themeColors: Theme['colors'];
  displayUnit: WeightUnit;
}

export default function ExerciseCard({
  exercise,
  exerciseIndex,
  setInputs,
  onSetInputChange,
  onCompleteSet,
  onDeleteSet,
  onDeleteExercise,
  onAddSet,
  themeColors,
  displayUnit,
}: ExerciseCardProps) {
  const exerciseDetails = getWorkoutById(exercise.id);
  const isBodyweight = exerciseDetails?.equipment?.includes('bodyweight') || false;
  
  const [estimatedMaxWeight, setEstimatedMaxWeight] = useState<number>(0);

  // Get estimated max weight for this exercise using the same logic as WorkoutSessionModalV2
  useEffect(() => {
    const getEstimatedWeight = async () => {
      if (!isBodyweight) {
        const recommendedWeight = await getRecommendedWeight(exercise.id, exercise.reps);
        setEstimatedMaxWeight(recommendedWeight || 0);
      }
    };
    
    getEstimatedWeight();
  }, [exercise.id, exercise.reps, isBodyweight]);

  const handleDeleteExercise = () => {
    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to delete this exercise? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDeleteExercise,
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Exercise Header */}
      <View style={[styles.header, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.title, { 
          color: themeColors.text,
          fontFamily: 'Raleway_600SemiBold',
        }]}>
          {exerciseDetails?.name || 'Unknown Exercise'}
        </Text>
        <View style={[styles.headerRight, { backgroundColor: 'transparent' }]}>
          {/* Delete Exercise Button - More Subtle */}
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: 'transparent' }]}
            onPress={handleDeleteExercise}
          >
            <Text style={[styles.deleteButtonText, { 
              color: themeColors.primary,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              ×
            </Text>
          </TouchableOpacity>
          
        </View>
      </View>

      {/* Table Header */}
      <SetTableHeader 
        isBodyweight={isBodyweight} 
        displayUnit={displayUnit}
        themeColors={themeColors} 
      />

      {/* Sets */}
      {Array.from({ length: exercise.sets }, (_, setIndex) => {
        const completedSet = exercise.completedSets[setIndex];
        const inputs = setInputs[setIndex];
        const canDelete = exercise.sets > 1; // Can only delete if more than 1 set
        
        return (
          <SetRow
            key={setIndex}
            setNumber={setIndex + 1}
            completedSet={completedSet}
            targetReps={exercise.reps}
            isBodyweight={isBodyweight}
            weightValue={inputs?.weight || { value: 0, unit: 'lbs' }}
            repsValue={inputs?.reps || 0}
            displayUnit={displayUnit}
            estimatedMaxWeight={estimatedMaxWeight}
            onWeightChange={(value) => onSetInputChange(setIndex, 'weight', value)}
            onRepsChange={(value) => onSetInputChange(setIndex, 'reps', value)}
            onComplete={() => onCompleteSet(setIndex)}
            onDelete={canDelete ? () => onDeleteSet(setIndex) : undefined}
            canDelete={canDelete}
            themeColors={themeColors}
          />
        );
      })}

      {/* Add Set Button */}
      <TouchableOpacity
        style={[styles.addSetButton, { backgroundColor: themeColors.surface }]}
        onPress={onAddSet}
      >
        <Text style={[styles.addSetText, { 
          color: themeColors.primary,
          fontFamily: 'Raleway_600SemiBold',
        }]}>
          + Add Set
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addSetButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addSetText: {
    fontSize: 14,
  },
  deleteButton: {
    padding: 4,
    borderRadius: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
}); 