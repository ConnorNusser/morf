import React, { createContext, useContext, useCallback, useMemo, useRef } from 'react';
import { VideoPlayer } from 'expo-video';

interface VideoPlayerContextType {
  registerPlayer: (id: string, player: VideoPlayer) => void;
  unregisterPlayer: (id: string) => void;
  setActiveVideo: (id: string | null) => void;
  clearActiveIfMatches: (id: string) => void;
  pauseAll: () => void;
  resumeActive: () => void;
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

  // Clear active only if it still matches the given id (prevents race conditions).
  const clearActiveIfMatches = useCallback((id: string) => {
    if (activeVideoRef.current === id) {
      const player = playersRef.current.get(id);
      if (player) {
        try {
          player.pause();
        } catch {
          // Player may not be ready
        }
      }
      activeVideoRef.current = null;
    }
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

  const value = useMemo(() => ({
    registerPlayer,
    unregisterPlayer,
    setActiveVideo,
    clearActiveIfMatches,
    pauseAll,
    resumeActive,
  }), [registerPlayer, unregisterPlayer, setActiveVideo, clearActiveIfMatches, pauseAll, resumeActive]);

  return (
    <VideoPlayerContext.Provider value={value}>
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

export function useVideoControl() {
  const context = useContext(VideoPlayerContext);
  return {
    pauseAll: context?.pauseAll ?? (() => {}),
    resumeActive: context?.resumeActive ?? (() => {}),
  };
}

// Pauses videos while a modal is open, resumes on close.
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
