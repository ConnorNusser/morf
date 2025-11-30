import { useCallback, useEffect, useRef, useState } from 'react';

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
  onVolumeChange?: (volume: number) => void;
  language?: string;
  continuous?: boolean;
}

interface UseVoiceRecognitionReturn {
  isListening: boolean;
  isAvailable: boolean;
  transcript: string;
  partialTranscript: string;
  error: string | null;
  volume: number;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
}

// Comprehensive fitness-specific contextual phrases to improve recognition accuracy
const FITNESS_CONTEXTUAL_PHRASES = [
  // Main compound lifts
  'bench press', 'squat', 'squats', 'deadlift', 'deadlifts', 'overhead press',
  'barbell row', 'bent over row', 'pull up', 'pullup', 'chin up', 'dip', 'dips',

  // Chest exercises
  'incline bench', 'decline bench', 'dumbbell press', 'dumbbell bench',
  'cable fly', 'cable flies', 'pec deck', 'chest press', 'push up', 'pushup',

  // Back exercises
  'lat pulldown', 'pulldown', 'seated row', 'cable row', 't bar row',
  'dumbbell row', 'single arm row', 'face pull', 'face pulls', 'shrug', 'shrugs',

  // Shoulder exercises
  'lateral raise', 'side raise', 'front raise', 'rear delt fly',
  'military press', 'shoulder press', 'arnold press', 'upright row',

  // Arm exercises
  'bicep curl', 'dumbbell curl', 'barbell curl', 'hammer curl', 'preacher curl',
  'tricep pushdown', 'tricep extension', 'skull crusher', 'close grip bench',
  'cable curl', 'concentration curl', 'overhead extension',

  // Leg exercises
  'leg press', 'leg extension', 'leg curl', 'hamstring curl',
  'romanian deadlift', 'rdl', 'stiff leg deadlift', 'hip thrust',
  'glute bridge', 'lunge', 'lunges', 'step up', 'calf raise', 'calf raises',
  'hack squat', 'goblet squat', 'front squat', 'bulgarian split squat',

  // Core exercises
  'crunch', 'crunches', 'plank', 'sit up', 'leg raise', 'ab wheel',
  'cable crunch', 'russian twist', 'hanging leg raise',

  // Weight terminology and numbers
  'reps', 'sets', 'pounds', 'lbs', 'kilograms', 'kg', 'plates',
  'for', 'at', 'times', 'by', 'x', 'and', 'then', 'next',
  'bodyweight', 'body weight', 'bw',

  // Common weight numbers (spoken form)
  'five', 'ten', 'fifteen', 'twenty', 'twenty five', 'thirty', 'thirty five',
  'forty', 'forty five', 'fifty', 'fifty five', 'sixty', 'sixty five',
  'seventy', 'seventy five', 'eighty', 'eighty five', 'ninety', 'ninety five',
  'one hundred', 'one oh five', 'one ten', 'one fifteen', 'one twenty', 'one twenty five',
  'one thirty', 'one thirty five', 'one forty', 'one forty five',
  'one fifty', 'one fifty five', 'one sixty', 'one sixty five',
  'one seventy', 'one seventy five', 'one eighty', 'one eighty five',
  'one ninety', 'one ninety five', 'two hundred', 'two oh five', 'two ten',
  'two twenty five', 'two fifty', 'two seventy five', 'three hundred',
  'three fifteen', 'three fifty', 'four hundred', 'four oh five', 'four fifty',
  'five hundred',
];

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}): UseVoiceRecognitionReturn {
  const {
    onResult,
    onPartialResult,
    onError,
    onVolumeChange,
    language = 'en-US',
    continuous = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  // Use refs to track state for event handlers (they capture stale state otherwise)
  const isListeningRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  // Internal function to start recognition (used for initial start and restarts)
  const startRecognitionInternal = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) return;

    try {
      await ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        continuous: continuous, // Keep listening until manually stopped
        maxAlternatives: 3, // Get multiple alternatives for better accuracy
        contextualStrings: FITNESS_CONTEXTUAL_PHRASES,
        requiresOnDeviceRecognition: false, // Use cloud for better accuracy
        addsPunctuation: false, // We don't need punctuation for workout notes
        iosTaskHint: 'dictation', // Optimized for dictation on iOS
        androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'free_form',
          // Extend silence detection timeout (in milliseconds)
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
        },
        volumeChangeEventOptions: {
          enabled: true,
          intervalMillis: 100,
        },
      });
    } catch (e) {
      console.error('Error starting speech recognition:', e);
      throw e;
    }
  }, [language, continuous]);

  // Handle speech recognition results
  useSpeechRecognitionEvent('result', (event: any) => {
    // Get the best result (first one with highest confidence)
    const results = event.results;
    if (results && results.length > 0) {
      // Try to get the best alternative based on confidence
      let bestTranscript = results[0]?.transcript || '';

      // If we have alternatives, pick the one most likely to be fitness-related
      if (results.length > 1) {
        for (const result of results) {
          const transcript = result?.transcript?.toLowerCase() || '';
          // Check if this alternative contains fitness terminology
          const hasFitnessTerms = FITNESS_CONTEXTUAL_PHRASES.some(phrase =>
            transcript.includes(phrase.toLowerCase())
          );
          if (hasFitnessTerms) {
            bestTranscript = result.transcript;
            break;
          }
        }
      }

      if (event.isFinal) {
        setTranscript(prev => prev ? `${prev}\n${bestTranscript}` : bestTranscript);
        setPartialTranscript('');
        onResult?.(bestTranscript);
      } else {
        setPartialTranscript(bestTranscript);
        onPartialResult?.(bestTranscript);
      }
    }
  });

  // Handle volume changes for visual feedback
  useSpeechRecognitionEvent('volumechange', (event: any) => {
    const vol = event.value ?? 0;
    setVolume(vol);
    onVolumeChange?.(vol);
  });

  // Handle errors
  useSpeechRecognitionEvent('error', (event: any) => {
    const errorCode = event.error || '';
    const errorMessage = event.message || 'Speech recognition error';

    // Don't treat "no-speech" as a fatal error in continuous mode
    // Just restart recognition
    if (errorCode === 'no-speech' && shouldRestartRef.current) {
      console.log('No speech detected, restarting...');
      restartTimeoutRef.current = setTimeout(() => {
        if (shouldRestartRef.current) {
          startRecognitionInternal().catch(console.error);
        }
      }, 300);
      return;
    }

    // Don't treat "aborted" as an error when user manually stopped
    if (errorCode === 'aborted' && !shouldRestartRef.current) {
      return;
    }

    setError(errorMessage);
    setIsListening(false);
    isListeningRef.current = false;
    shouldRestartRef.current = false;
    onError?.(errorMessage);
  });

  // Handle end of recognition
  useSpeechRecognitionEvent('end', () => {
    setPartialTranscript('');
    setVolume(0);

    // In continuous mode, restart if we haven't been explicitly stopped
    if (shouldRestartRef.current && continuous) {
      console.log('Recognition ended, restarting for continuous mode...');
      restartTimeoutRef.current = setTimeout(() => {
        if (shouldRestartRef.current) {
          startRecognitionInternal().catch((e) => {
            console.error('Failed to restart recognition:', e);
            setIsListening(false);
            isListeningRef.current = false;
            shouldRestartRef.current = false;
          });
        }
      }, 300);
    } else {
      setIsListening(false);
      isListeningRef.current = false;
    }
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

    // Prevent double-start
    if (isListeningRef.current) {
      console.log('Already listening, ignoring start request');
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

      // Set flags before starting
      shouldRestartRef.current = continuous;
      isListeningRef.current = true;
      setIsListening(true);

      await startRecognitionInternal();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start speech recognition';
      setError(message);
      setIsListening(false);
      isListeningRef.current = false;
      shouldRestartRef.current = false;
      onError?.(message);
    }
  }, [requestPermissions, onError, continuous, startRecognitionInternal]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      return;
    }

    // Clear restart flag first to prevent auto-restart
    shouldRestartRef.current = false;

    // Clear any pending restart timeout
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.error('Error stopping speech recognition:', e);
    }

    setIsListening(false);
    isListeningRef.current = false;
    setPartialTranscript('');
    setVolume(0);
  }, []);

  return {
    isListening,
    isAvailable,
    transcript,
    partialTranscript,
    error,
    volume,
    startListening,
    stopListening,
    requestPermissions,
  };
}
