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

const ALL_EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'smith-machine', 'cable', 'kettlebell', 'bodyweight'];

export interface EquipmentProfile {
  available: Equipment[];
  /** 'standard' → deterministic builder; 'limited' → AI generation. */
  tier: 'standard' | 'limited';
  flags: {
    hasBarbell: boolean;
    hasDumbbell: boolean;
    hasMachines: boolean;     // machine, cable, or smith
    machinesOnly: boolean;    // machines/cables but no free weights
    bodyweightOnly: boolean;
  };
}

export function classifyEquipment(equipment?: Equipment[] | null): EquipmentProfile {
  const available = equipment && equipment.length > 0 ? equipment : [...ALL_EQUIPMENT];
  const set = new Set(available);

  const hasBarbell = set.has('barbell');
  const hasDumbbell = set.has('dumbbell');
  const hasMachines = set.has('machine') || set.has('cable') || set.has('smith-machine');
  const bodyweightOnly = available.every(e => e === 'bodyweight');
  const machinesOnly = !hasBarbell && !hasDumbbell && hasMachines;

  // The template library anchors on free-weight compounds. With neither a barbell nor
  // dumbbells the deterministic build gets thin/repetitive, so we hand those cases to AI.
  const tier: EquipmentProfile['tier'] = hasBarbell || hasDumbbell ? 'standard' : 'limited';

  return {
    available,
    tier,
    flags: { hasBarbell, hasDumbbell, hasMachines, machinesOnly, bodyweightOnly },
  };
}
