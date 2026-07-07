// Crash-safe access to the optional native speech-recognition module.
// expo-speech-recognition's entrypoint calls requireNativeModule() at module-eval
// time, which THROWS (as an uncatchable render-time error) when the dev client
// hasn't been rebuilt with the native module. So we probe with
// requireOptionalNativeModule() first — it returns null instead of throwing — and
// only require the package when the module is really present; otherwise every call
// is a no-op and the UI hides the mic. Needs prebuild + dev-client rebuild.
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
