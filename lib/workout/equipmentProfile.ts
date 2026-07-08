// Classifies equipment as 'standard' (template library can build it) or 'limited'
// (defer to AI). Standard = has a barbell or dumbbells; within the template library
// missing gear substitutes via each slot's priority order.
import { Equipment } from '@/types';
import { ALL_EQUIPMENT } from './equipment';

export interface EquipmentProfile {
  available: Equipment[];
  /** 'standard' → deterministic builder; 'limited' → AI generation. */
  tier: 'standard' | 'limited';
}

export function classifyEquipment(equipment?: Equipment[] | null): EquipmentProfile {
  const available = equipment && equipment.length > 0 ? equipment : [...ALL_EQUIPMENT];
  const set = new Set(available);

  // The template library anchors on free-weight compounds; without barbell or
  // dumbbells the build gets thin, so hand those cases to AI.
  const tier: EquipmentProfile['tier'] = set.has('barbell') || set.has('dumbbell') ? 'standard' : 'limited';

  return { available, tier };
}
