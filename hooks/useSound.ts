import { getSound, type SoundName } from '@/lib/utils/sounds';
import { useAudioPlayer } from 'expo-audio';

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

  return { play };
}