// Pure helpers for the custom-exercise manager: name/id derivation and list filtering.
import { ALL_EQUIPMENT, EQUIPMENT_LABELS, formatEquipmentLabel } from '@/lib/workout/equipment';
import { CustomExercise, Equipment } from '@/types';

export const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = ALL_EQUIPMENT.map(value => ({
  value,
  label: EQUIPMENT_LABELS[value],
}));

// "super horizontal press" + machine -> "Super Horizontal Press (Machine)"
export const generateFullExerciseName = (baseName: string, equipment: Equipment): string => {
  const trimmedName = baseName.trim();
  const titleCased = trimmedName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return `${titleCased} (${formatEquipmentLabel(equipment)})`;
};

// "Super Horizontal Press (Machine)" -> "super-horizontal-press-machine"
export const generateExerciseId = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

// "Super Horizontal Press (Machine)" -> "Super Horizontal Press"
export const extractBaseName = (fullName: string): string => {
  return fullName.replace(/\s*\([^)]+\)\s*$/, '').trim();
};

export const getCustomExercisesSummary = (count: number): string => {
  if (count === 0) return 'No custom exercises yet';
  return `${count} custom exercise${count === 1 ? '' : 's'}`;
};

export const filterCustomExercises = (
  customExercises: CustomExercise[],
  searchQuery: string,
  equipmentFilter: Equipment | 'all',
): CustomExercise[] => {
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
};
