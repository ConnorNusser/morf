import { useAlert } from '@/components/CustomAlert';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { aiWorkoutGenerator } from '@/lib/ai/aiWorkoutGenerator';
import playHapticFeedback from '@/lib/utils/haptic';
import { extractBaseName, generateExerciseId, generateFullExerciseName } from '@/lib/workout/customExercises';
import { CustomExercise, Equipment } from '@/types';
import { useState } from 'react';
import { Keyboard } from 'react-native';

interface UseCustomExerciseFormParams {
  onExercisesUpdate?: () => Promise<void>;
  playSound: () => void;
}

// Add/edit form state for the custom-exercise manager, plus the save flows
// (edit = rename/re-equip in place; add = AI metadata lookup then insert).
export function useCustomExerciseForm({ onExercisesUpdate, playSound }: UseCustomExerciseFormParams) {
  const { showAlert } = useAlert();
  const { addExercise, updateExercise, getByName } = useCustomExercises();
  const [editingExercise, setEditingExercise] = useState<CustomExercise | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment>('machine');
  const [isGenerating, setIsGenerating] = useState(false);

  const resetForm = () => {
    setEditingExercise(null);
    setIsAdding(false);
    setEditedName('');
    setSelectedEquipment('machine');
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

  return {
    editingExercise,
    isAdding,
    editedName,
    setEditedName,
    selectedEquipment,
    setSelectedEquipment,
    isGenerating,
    resetForm,
    handleStartEdit,
    handleStartAdd,
    handleCancelEditAdd,
    handleSaveEdit,
    handleSaveAdd,
  };
}

export type CustomExerciseForm = ReturnType<typeof useCustomExerciseForm>;
