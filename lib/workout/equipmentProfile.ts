/**
 * Equipment classification
 * ------------------------------------------------------------------------------------
 * Decides whether the deterministic template library can build a good program for the
 * user's available equipment, or whether we should defer to the AI for an unusual /
 * limited setup (machines-only, cables-only, bodyweight-only, kettlebell-only).
 *
 * Standard setups (anything with a barbell or dumbbells) run the template library —
 * within it, missing gear substitutes automatically via each slot's priority order
 * (e.g. no barbell rack → smith → hack → leg press → goblet → bodyweight).
 */

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

  // The template library anchors on free-weight compounds. With neither a barbell nor
  // dumbbells the deterministic build gets thin/repetitive, so we hand those cases to AI.
  const tier: EquipmentProfile['tier'] = set.has('barbell') || set.has('dumbbell') ? 'standard' : 'limited';

  return { available, tier };
}
