// Single source of truth for equipment options and their display labels.
import { Equipment } from '@/types';

/** Every selectable equipment type, in canonical display order. */
export const ALL_EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'smith-machine',
  'cable',
  'kettlebell',
  'bodyweight',
];

/** Singular labels for chips / single-item display (e.g. "Dumbbell"). */
export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  'smith-machine': 'Smith Machine',
  cable: 'Cable',
  kettlebell: 'Kettlebell',
  bodyweight: 'Bodyweight',
};

export const formatEquipmentLabel = (equipment: Equipment): string =>
  EQUIPMENT_LABELS[equipment] ?? equipment;

/** Plural labels that read naturally in prose lists (e.g. AI prompts). */
const EQUIPMENT_DISPLAY_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  machine: 'Machines',
  'smith-machine': 'Smith Machine',
  cable: 'Cables',
  kettlebell: 'Kettlebell',
  bodyweight: 'Bodyweight',
};

/** Comma-joined plural labels, e.g. "Barbell, Dumbbells, Machines". */
export const formatEquipmentList = (equipment: Equipment[]): string =>
  equipment.map(e => EQUIPMENT_DISPLAY_LABELS[e]).join(', ');
