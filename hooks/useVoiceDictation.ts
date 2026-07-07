// Hands-free set dictation; final transcript handed back to append to the note.
// Backed by the crash-safe lazy voiceRecognition service, so an un-rebuilt
// binary simply reports unavailable.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addVoiceListener,
  isVoiceAvailable,
  requestVoicePermission,
  startVoice,
  stopVoice,
} from '@/lib/services/voiceRecognition';

export interface UseVoiceDictation {
  available: boolean;
  isListening: boolean;
  error: string | null;
  toggle: () => void;
  stop: () => void;
}

export function useVoiceDictation(onFinalTranscript: (text: string) => void): UseVoiceDictation {
  const [available] = useState(isVoiceAvailable);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the callback fresh without re-subscribing the native listeners.
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  useEffect(() => {
    if (!available) return;
    const subs = [
      addVoiceListener('start', () => setIsListening(true)),
      addVoiceListener('end', () => setIsListening(false)),
      addVoiceListener('result', (event: any) => {
        if (event?.isFinal && event.results?.length) {
          const transcript = String(event.results[0]?.transcript ?? '').trim();
          if (transcript) onFinalRef.current(transcript);
        }
      }),
      addVoiceListener('error', (event: any) => {
        setError(event?.message ?? event?.error ?? 'Dictation error');
        setIsListening(false);
      }),
    ];
    return () => subs.forEach(s => s?.remove());
  }, [available]);

  const start = useCallback(async () => {
    setError(null);
    const granted = await requestVoicePermission();
    if (!granted) {
      setError('Microphone permission needed for voice logging');
      return;
    }
    // Single utterance; interimResults off so we only append clean, final text.
    startVoice({ lang: 'en-US', interimResults: false, continuous: false });
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    stopVoice();
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  return { available, isListening, error, toggle, stop };
}
