// Re-export the typed JS service. App code should import from
// '@/lib/liveActivity/liveActivity' rather than reaching into the module so the
// no-op fallback (Expo Go / pre-build) is always in effect.
export * from '@/lib/liveActivity/liveActivity';
export * from '@/lib/liveActivity/types';
