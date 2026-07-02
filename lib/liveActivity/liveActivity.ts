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

// Run a native call, degrading to `fallback` when the module is absent (Expo Go /
// pre-build) and warning (not throwing) on failure, so callers can stay one-liners.
async function call<T>(label: string, fallback: T, fn: (m: LiveActivityNativeModule) => Promise<T>): Promise<T> {
  if (!native) return fallback;
  try {
    return await fn(native);
  } catch (e) {
    console.warn(`[liveActivity] ${label} failed`, e);
    return fallback;
  }
}

export const startLiveActivity = (content: LiveActivityContent): Promise<string | null> =>
  call('start', null, m => m.start(content));

export const updateLiveActivity = (content: LiveActivityContent): Promise<void> =>
  call('update', undefined, m => m.update(content));

export const endLiveActivity = (): Promise<void> =>
  call('end', undefined, m => m.end());

/** Hand the native side the ordered sets so the Lock Screen can advance on tap. */
export const saveWorkoutSnapshot = (sets: SnapshotSet[]): Promise<void> =>
  call('saveWorkoutSnapshot', undefined, m => m.saveWorkoutSnapshot(sets));

/** Drain Lock-Screen actions so the workout draft can reconcile them. */
export const pullPendingActions = (): Promise<PendingAction[]> =>
  call('pullPendingActions', [], m => m.pullPendingActions());
