import { useEffect, useState } from 'react';
import playHapticFeedback from '@/lib/utils/haptic';

/** Mute state for an expo-video player: owns isMuted, syncs player.muted, and toggles with haptic. */
export function useMute(player: { muted: boolean } | null | undefined) {
  const [isMuted, setIsMuted] = useState(false);
  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [player, isMuted]);
  const toggleMute = () => {
    setIsMuted(!isMuted);
    playHapticFeedback('light', false);
  };
  return { isMuted, toggleMute, setIsMuted };
}
