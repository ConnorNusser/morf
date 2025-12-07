import React, { createContext, useContext, useCallback, useRef } from 'react';
import { VideoPlayer } from 'expo-video';

interface VideoPlayerContextType {
  registerPlayer: (id: string, player: VideoPlayer) => void;
  unregisterPlayer: (id: string) => void;
  setActiveVideo: (id: string | null) => void;
  pauseAll: () => void;
  resumeActive: () => void;
  muteAll: () => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextType | null>(null);

export function VideoPlayerProvider({ children }: { children: React.ReactNode }) {
  const playersRef = useRef<Map<string, VideoPlayer>>(new Map());
  const activeVideoRef = useRef<string | null>(null);

  const registerPlayer = useCallback((id: string, player: VideoPlayer) => {
    playersRef.current.set(id, player);
  }, []);

  const unregisterPlayer = useCallback((id: string) => {
    playersRef.current.delete(id);
    if (activeVideoRef.current === id) {
      activeVideoRef.current = null;
    }
  }, []);

  const setActiveVideo = useCallback((id: string | null) => {
    // Pause all other videos when a new one becomes active
    playersRef.current.forEach((player, playerId) => {
      try {
        if (playerId !== id) {
          player.pause();
        } else if (id !== null) {
          player.play();
        }
      } catch {
        // Player may not be ready
      }
    });
    activeVideoRef.current = id;
  }, []);

  const pauseAll = useCallback(() => {
    playersRef.current.forEach((player) => {
      try {
        player.pause();
      } catch {
        // Player may not be ready
      }
    });
    // Keep activeVideoRef so we know which to resume
  }, []);

  const resumeActive = useCallback(() => {
    const activeId = activeVideoRef.current;
    if (activeId) {
      const player = playersRef.current.get(activeId);
      if (player) {
        try {
          player.play();
        } catch {
          // Player may not be ready
        }
      }
    }
  }, []);

  const muteAll = useCallback(() => {
    playersRef.current.forEach((player) => {
      try {
        player.muted = true;
      } catch {
        // Player may not be ready
      }
    });
  }, []);

  return (
    <VideoPlayerContext.Provider
      value={{
        registerPlayer,
        unregisterPlayer,
        setActiveVideo,
        pauseAll,
        resumeActive,
        muteAll,
      }}
    >
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayerContext() {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error('useVideoPlayerContext must be used within a VideoPlayerProvider');
  }
  return context;
}

// Hook for components that need to pause/resume videos (modals, navigation, etc.)
export function useVideoControl() {
  const context = useContext(VideoPlayerContext);
  return {
    pauseAll: context?.pauseAll ?? (() => {}),
    resumeActive: context?.resumeActive ?? (() => {}),
  };
}

// Hook for modals - automatically pauses videos when modal mounts, resumes when it unmounts
// Just add `usePauseVideosWhileOpen(visible)` to any modal
export function usePauseVideosWhileOpen(visible: boolean) {
  const { pauseAll, resumeActive } = useVideoControl();

  React.useEffect(() => {
    if (visible) {
      pauseAll();
    } else {
      resumeActive();
    }
  }, [visible, pauseAll, resumeActive]);
}
