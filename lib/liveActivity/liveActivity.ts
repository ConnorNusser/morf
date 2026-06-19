// JS service that drives the iOS Live Activity. It talks to the local Expo
// module `LiveActivity` (modules/live-activity). The module is iOS-only and only
// exists in a dev-client / production build — never in Expo Go — so every call
// degrades to a no-op when it's absent. This keeps the app (and `useRestTimer`)
// working unchanged before the native target is built.
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { LiveActivityContent, PendingAction, SnapshotSet } from './types';

interface LiveActivityNativeModule {
  isSupported(): boolean;
  // Returns the new activity id, or null if it couldn't start.
  start(content: LiveActivityContent): Promise<string | null>;
  update(content: LiveActivityContent): Promise<void>;
  end(): Promise<void>;
  // Stores the ordered working sets for Lock-Screen "complete set" advancement.
  saveWorkoutSnapshot(sets: SnapshotSet[]): Promise<void>;
  // Drains actions the user performed from the Lock Screen since last call.
  pullPendingActions(): Promise<PendingAction[]>;
}

const native = requireOptionalNativeModule<LiveActivityNativeModule>('LiveActivity');

/** True when Live Activities can actually run (iOS 16.2+, module present). */
export function isLiveActivitySupported(): boolean {
  return Platform.OS === 'ios' && !!native && native.isSupported();
}

export async function startLiveActivity(content: LiveActivityContent): Promise<string | null> {
  if (!native) return null;
  try {
    return await native.start(content);
  } catch (e) {
    console.warn('[liveActivity] start failed', e);
    return null;
  }
}

export async function updateLiveActivity(content: LiveActivityContent): Promise<void> {
  if (!native) return;
  try {
    await native.update(content);
  } catch (e) {
    console.warn('[liveActivity] update failed', e);
  }
}

export async function endLiveActivity(): Promise<void> {
  if (!native) return;
  try {
    await native.end();
  } catch (e) {
    console.warn('[liveActivity] end failed', e);
  }
}

/** Hand the native side the ordered sets so the Lock Screen can advance on tap. */
export async function saveWorkoutSnapshot(sets: SnapshotSet[]): Promise<void> {
  if (!native) return;
  try {
    await native.saveWorkoutSnapshot(sets);
  } catch (e) {
    console.warn('[liveActivity] saveWorkoutSnapshot failed', e);
  }
}

/** Drain Lock-Screen actions so the workout draft can reconcile them. */
export async function pullPendingActions(): Promise<PendingAction[]> {
  if (!native) return [];
  try {
    return await native.pullPendingActions();
  } catch (e) {
    console.warn('[liveActivity] pullPendingActions failed', e);
    return [];
  }
}
