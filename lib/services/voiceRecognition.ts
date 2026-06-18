// Crash-safe access to the optional native speech-recognition module.
//
// expo-speech-recognition's entrypoint resolves its native side at module-eval
// time with requireNativeModule(), which THROWS if the dev client hasn't been
// rebuilt to include the native module. In dev that throw escapes a plain
// try/catch around require() (it surfaces as a render-time error), so instead
// we first probe with requireOptionalNativeModule() — which returns null rather
// than throwing — and only require the package when the native module is really
// present. If voice isn't available, every call is a no-op and
// isVoiceAvailable() returns false, so the UI simply hides the mic.
//
// Requires `npx expo prebuild` + a dev-client rebuild before voice works.
import { requireOptionalNativeModule } from 'expo';

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
    // Probe without throwing; the native module only exists in a rebuilt binary.
    if (!requireOptionalNativeModule('ExpoSpeechRecognition')) {
      cached = null;
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cached = require('expo-speech-recognition').ExpoSpeechRecognitionModule ?? null;
      } catch {
        cached = null;
      }
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
