import Button from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { Theme } from '@/lib/theme';
import { convertWeight, WeightUnit, WorkoutSetCompletion } from '@/types';
import React from 'react';
import { StyleSheet } from 'react-native';
import CompactRepsInput from './CompactRepsInput';
import CompactWeightInput from './CompactWeightInput';

interface SetRowProps {
  setNumber: number;
  completedSet?: WorkoutSetCompletion;
  targetReps: string;
  isBodyweight: boolean;
  weightValue: { value: number; unit: 'lbs' | 'kg' };
  repsValue: number;
  displayUnit: WeightUnit;
  estimatedMaxWeight: number;
  onWeightChange: (value: { value: number; unit: 'lbs' | 'kg' }) => void;
  onRepsChange: (value: number) => void;
  onComplete: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  themeColors: Theme['colors'];
}

export default function SetRow({
  setNumber,
  completedSet,
  targetReps,
  isBodyweight,
  weightValue,
  repsValue,
  displayUnit,
  estimatedMaxWeight,
  onWeightChange,
  onRepsChange,
  onComplete,
  onDelete,
  canDelete,
  themeColors,
}: SetRowProps) {

  // Get effective values (use placeholders if inputs are empty)
  const getEffectiveWeight = () => {
    if (!weightValue.value || weightValue.value === 0) {
      return estimatedMaxWeight;
    }
    return weightValue.value;
  };

  const getEffectiveReps = () => {
    if (!repsValue || repsValue === 0) {
      return parseInt(targetReps);
    }
    return repsValue;
  };

  const hasEffectiveValues = () => {
    const effectiveWeight = getEffectiveWeight();
    const effectiveReps = getEffectiveReps();
    
    if (isBodyweight) {
      return effectiveReps > 0;
    }
    return effectiveWeight > 0 && effectiveReps > 0;
  };

  const handleComplete = () => {
    if (hasEffectiveValues()) {
      onComplete();
    }
  };

  const isCompleted = completedSet?.completed || false;
  console.log(isCompleted == true);
  
  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* Set Number */}
      <View style={[styles.setNumber, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.setNumberText, { color: themeColors.text }]}>
          {setNumber}
        </Text>
      </View>

      {/* Weight Input (hidden for bodyweight) */}
      {!isBodyweight && (
        <View style={styles.weightCell}>
          <CompactWeightInput
            value={weightValue}
            displayUnit={displayUnit}
            placeholder={convertWeight(estimatedMaxWeight, 'lbs', displayUnit).toString()}
            onChange={onWeightChange}
            themeColors={themeColors}
          />
        </View>
      )}

      {/* Reps Input */}
      <View style={styles.repsCell}>
        <CompactRepsInput
          value={repsValue}
          onChange={onRepsChange}
          placeholder={targetReps}
          themeColors={themeColors}
        />
      </View>

      {/* Complete/Delete Actions */}
      <View style={styles.actionCell}>
        <View style={styles.actionButtons}>
          <Button
            title="✓"
            onPress={handleComplete}
            variant={isCompleted ? "primary" : "secondary"}
            size="small"
            disabled={!hasEffectiveValues()}
          />
          
          {canDelete && onDelete && (
            <Button
              title="×"
              onPress={() => onDelete()}
              variant="ghost"
              size="small"
              style={styles.deleteButton}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 44,
  },
  setNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  setNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  weightCell: {
    width: 80, // Match header increased spacing
    alignItems: 'center',
    marginHorizontal: 4,
  },
  repsCell: {
    width: 80, // Match header increased spacing
    alignItems: 'center',
    marginHorizontal: 4,
  },
  completedText: {
    fontSize: 16,
    textAlign: 'center',
  },
  actionCell: {
    flex: 1, // Take remaining space
    alignItems: 'flex-end', // Align to right
    paddingRight: 2, // Match header's increased padding
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    minWidth: 30,
  },
}); 