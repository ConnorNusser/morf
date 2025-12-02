import { getSound, type SoundName } from '@/lib/sounds';
import { useAudioPlayer } from 'expo-audio';

/**
 * Custom hook for playing sounds with a clean API
 * 
 * @param soundName - The name of the sound to load
 * @returns Object with play function and audio player controls
 * 
 * @example
 * ```tsx
 * const { play, player } = useSound('success');
 * 
 * const handleSuccess = () => {
 *   play(); // Plays the sound from the beginning
 * };
 * ```
 */
export function useSound(soundName: SoundName) {
  const soundFile = getSound(soundName);
  const player = useAudioPlayer(soundFile);

  const play = () => {
    try {
      if (player) {
        player.seekTo(0);
        player.play();
      }
    } catch (error) {
      console.warn(`Failed to play sound "${soundName}":`, error);
    }
  };

  const pause = () => {
    try {
      if (player) {
        player.pause();
      }
    } catch (error) {
      console.warn(`Failed to pause sound "${soundName}":`, error);
    }
  };

  const stop = () => {
    try {
      if (player) {
        player.pause();
        player.seekTo(0);
      }
    } catch (error) {
      console.warn(`Failed to stop sound "${soundName}":`, error);
    }
  };

  return {
    play,
    pause,
    stop,
    player,
  };
}