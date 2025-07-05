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
        console.log('playing sound', soundName);
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

/**
 * Hook for playing multiple sounds with individual controls
 * 
 * @param soundNames - Array of sound names to load
 * @returns Object with sound controls for each sound
 * 
 * @example
 * ```tsx
 * const sounds = useSounds(['success', 'beep', 'pop']);
 * 
 * const handleSuccess = () => {
 *   sounds.success.play();
 * };
 * 
 * const handleSelect = () => {
 *   sounds.beep.play();
 * };
 * ```
 */
export function useSounds<T extends readonly SoundName[]>(soundNames: T) {
  const sounds = {} as Record<T[number], ReturnType<typeof useSound>>;

  soundNames.forEach((soundName) => {
    sounds[soundName] = useSound(soundName);
  });

  return sounds;
} 