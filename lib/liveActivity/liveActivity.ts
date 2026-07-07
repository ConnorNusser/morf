// JS bridge to the iOS-only `LiveActivity` Expo module; every call no-ops when
// the module is absent (Expo Go / pre-build), so callers stay unconditional.
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import type { LiveActivityContent, PendingAction, SnapshotSet } from './types';

interface LiveActivityNativeModule {
  isSupported(): boolean;
  start(content: LiveActivityContent): Promise<string | null>;
  update(content: LiveActivityContent): Promise<void>;
  end(): Promise<void>;
  saveWorkoutSnapshot(sets: SnapshotSet[]): Promise<void>;
  pullPendingActions(): Promise<PendingAction[]>;
}

const native = requireOptionalNativeModule<LiveActivityNativeModule>('LiveActivity');

export function isLiveActivitySupported(): boolean {
  return Platform.OS === 'ios' && !!native && native.isSupported();
}

// Degrade to `fallback` when the module is absent, and warn (not throw) on failure.
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

export const saveWorkoutSnapshot = (sets: SnapshotSet[]): Promise<void> =>
  call('saveWorkoutSnapshot', undefined, m => m.saveWorkoutSnapshot(sets));

export const pullPendingActions = (): Promise<PendingAction[]> =>
  call('pullPendingActions', [], m => m.pullPendingActions());
