import { useCallback, useEffect, useState } from 'react';

// Conditionally import expo-speech-recognition (requires native build)
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = () => {};

try {
  const speechRecognition = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechRecognition.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speechRecognition.useSpeechRecognitionEvent;
} catch (e) {
  console.log('expo-speech-recognition not available (requires native build)');
}

interface UseVoiceRecognitionOptions {
  onResult?: (text: string) => void;
  onPartialResult?: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

interface UseVoiceRecognitionReturn {
  isListening: boolean;
  isAvailable: boolean;
  transcript: string;
  partialTranscript: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

// Fitness-specific contextual phrases to improve recognition accuracy
const FITNESS_CONTEXTUAL_PHRASES = [
  // Main lifts
  'bench press', 'squat', 'deadlift', 'overhead press',
  // Common exercises
  'dumbbell curl', 'barbell curl', 'lat pulldown', 'pull up', 'push up',
  'incline bench', 'decline bench', 'cable fly', 'leg press', 'leg extension',
  'leg curl', 'calf raise', 'lateral raise', 'front raise', 'face pull',
  'tricep pushdown', 'tricep extension', 'skull crusher', 'dip',
  'romanian deadlift', 'hip thrust', 'glute bridge', 'lunge', 'step up',
  // Weight terminology
  'reps', 'sets', 'pounds', 'lbs', 'kilograms', 'kg', 'plates',
  'for', 'at', 'times', 'by', 'x',
  // Numbers (common weights)
  'forty five', 'ninety', 'one thirty five', 'one eighty five',
  'two twenty five', 'three fifteen', 'four oh five',
];

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}): UseVoiceRecognitionReturn {
  const { onResult, onPartialResult, onError, language = 'en-US' } = options;

  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Check if speech recognition is available
  useEffect(() => {
    const checkAvailability = async () => {
      if (!ExpoSpeechRecognitionModule) {
        setIsAvailable(false);
        return;
      }
      try {
        const status = await ExpoSpeechRecognitionModule.getStateAsync();
        setIsAvailable(status !== 'inactive');
      } catch (e) {
        setIsAvailable(false);
      }
    };
    checkAvailability();
  }, []);

  // Handle speech recognition results
  useSpeechRecognitionEvent('result', (event: any) => {
    // Get the best result (first one with highest confidence)
    const results = event.results;
    if (results && results.length > 0) {
      const text = results[0]?.transcript || '';

      if (event.isFinal) {
        setTranscript(prev => prev ? `${prev}\n${text}` : text);
        setPartialTranscript('');
        onResult?.(text);
      } else {
        setPartialTranscript(text);
        onPartialResult?.(text);
      }
    }
  });

  // Handle errors
  useSpeechRecognitionEvent('error', (event: any) => {
    const errorMessage = event.error || 'Speech recognition error';
    setError(errorMessage);
    setIsListening(false);
    onError?.(errorMessage);
  });

  // Handle end of recognition
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setPartialTranscript('');
  });

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!ExpoSpeechRecognitionModule) {
      return false;
    }
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      return result.granted;
    } catch (e) {
      console.error('Error requesting permissions:', e);
      return false;
    }
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      setError('Voice recognition not available (requires native build)');
      return;
    }

    try {
      setError(null);

      // Check permissions first
      const permissions = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!permissions.granted) {
        const result = await requestPermissions();
        if (!result) {
          setError('Microphone permission denied');
          return;
        }
      }

      // Start recognition with fitness-optimized settings
      await ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        contextualStrings: FITNESS_CONTEXTUAL_PHRASES,
        requiresOnDeviceRecognition: false, // Use cloud for better accuracy
        addsPunctuation: false, // We don't need punctuation for workout notes
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'free_form',
        },
      });

      setIsListening(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start speech recognition';
      setError(message);
      onError?.(message);
    }
  }, [language, requestPermissions, onError]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      return;
    }
    try {
      await ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    } catch (e) {
      console.error('Error stopping speech recognition:', e);
    }
  }, []);

  return {
    isListening,
    isAvailable,
    transcript,
    partialTranscript,
    error,
    startListening,
    stopListening,
    requestPermissions,
  };
}
