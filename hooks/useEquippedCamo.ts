import { CardCamo, CardCamoId, isCamoUnlocked, resolveEquippedCamo } from '@/lib/gamification/cardCamos';
import { storageService } from '@/lib/storage/storage';
import { useCallback, useEffect, useState } from 'react';

// Equipped rank-card camo + the camo on/off switch, shared app-wide. A tiny
// module store (hydrated once from storage) means equipping in the Career modal
// repaints Home's card immediately — no focus event needed, since the modal sits
// on top of Home without blurring it.
interface CamoPrefs {
  storedId: string | null;
  enabled: boolean;
  loaded: boolean;
}

let prefs: CamoPrefs = { storedId: null, enabled: true, loaded: false };
let hydrating: Promise<void> | null = null;
const listeners = new Set<(p: CamoPrefs) => void>();

function publish(next: CamoPrefs) {
  prefs = next;
  listeners.forEach(l => l(prefs));
}

function hydrate(): Promise<void> {
  if (!hydrating) {
    hydrating = Promise.all([storageService.getEquippedCardCamo(), storageService.getCardCamoEnabled()])
      .then(([storedId, enabled]) => publish({ storedId, enabled, loaded: true }))
      .catch(err => {
        console.error('useEquippedCamo: failed to load', err);
        publish({ ...prefs, loaded: true });
      });
  }
  return hydrating;
}

export interface UseEquippedCamo {
  camo: CardCamo; // what to render: standard when off, locked, unknown or loading
  equippedId: string | null; // raw stored pick (kept while camos are off)
  enabled: boolean;
  loaded: boolean;
  // Equips `id` if unlocked at `level`; returns whether it was equipped.
  equip: (id: CardCamoId, level: number) => boolean;
  setEnabled: (enabled: boolean) => void;
}

// `level` = current account level, or null while it loads.
export default function useEquippedCamo(level: number | null): UseEquippedCamo {
  const [state, setState] = useState<CamoPrefs>(prefs);

  useEffect(() => {
    listeners.add(setState);
    setState(prefs);
    hydrate();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const equip = useCallback((id: CardCamoId, lvl: number) => {
    if (!isCamoUnlocked(id, lvl)) return false;
    publish({ ...prefs, storedId: id });
    storageService.setEquippedCardCamo(id);
    return true;
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    publish({ ...prefs, enabled });
    storageService.setCardCamoEnabled(enabled);
  }, []);

  return {
    camo: resolveEquippedCamo(state.storedId, state.loaded ? level : null, state.enabled),
    equippedId: state.storedId,
    enabled: state.enabled,
    loaded: state.loaded,
    equip,
    setEnabled,
  };
}
