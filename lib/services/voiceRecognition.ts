// Crash-safe access to the optional native speech-recognition module.
//
// expo-speech-recognition resolves its native side with requireNativeModule(),
// which THROWS if the dev client hasn't been rebuilt to include the native
// module. A static import would therefore crash the whole Workout screen on an
// un-rebuilt binary. To avoid that, we load the module lazily behind try/catch
// and expose a null-safe surface: if voice isn't available, every call is a
// no-op and isVoiceAvailable() returns false (so the UI just hides the mic).
//
// Requires `npx expo prebuild` + a dev-client rebuild before voice works.

type VoiceSubscription = { remove: () => void };

interface VoiceStartOptions {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
}

// undefined = not yet attempted; null = unavailable; object = the native module
let cached: any;

function getModule(): any | null {
  if (cached === undefined) {
    try {
      // Lazy require (not a static import) so requireNativeModule throwing on an
      // un-rebuilt binary is caught here instead of crashing app startup.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-speech-recognition').ExpoSpeechRecognitionModule ?? null;
    } catch {
      cached = null;
    }
  }
  return cached;
}

export function isVoiceAvailable(): boolean {
  const mod = getModule();
  if (!mod) return false;
  try {
    return mod.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function requestVoicePermission(): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  try {
    const result = await mod.requestPermissionsAsync();
    return !!result?.granted;
  } catch {
    return false;
  }
}

export function startVoice(options: VoiceStartOptions): void {
  try {
    getModule()?.start(options);
  } catch {
    // swallow — the caller surfaces failures via the 'error' event
  }
}

export function stopVoice(): void {
  try {
    getModule()?.stop();
  } catch {
    // no-op
  }
}

export function addVoiceListener(eventName: string, listener: (event: any) => void): VoiceSubscription | null {
  const mod = getModule();
  if (!mod?.addListener) return null;
  try {
    return mod.addListener(eventName, listener);
  } catch {
    return null;
  }
}
