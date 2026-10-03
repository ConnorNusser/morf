// Hands-free set logging for the workout tab: each finished phrase is parsed
// straight into the workout; the mic button toggles listening.
import { useAlert } from "@/components/CustomAlert";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import playHapticFeedback from "@/lib/utils/haptic";
import { useCallback, useEffect } from "react";

export function useVoiceLogging(
  commitText: (text: string) => Promise<boolean>,
  showAlert: ReturnType<typeof useAlert>["showAlert"],
) {
  // Voice: each finished phrase is parsed straight into the workout, hands-free.
  const handleVoiceTranscript = useCallback(
    (text: string) => {
      playHapticFeedback("light", false);
      commitText(text);
    },
    [commitText],
  );
  const voice = useVoiceDictation(handleVoiceTranscript);
  const handleMicPress = useCallback(() => {
    playHapticFeedback("medium", false);
    if (!voice.available) {
      showAlert({
        title: "Voice not available",
        message:
          "Voice logging needs a dev-client rebuild (npx expo prebuild) and microphone permission.",
        type: "info",
      });
      return;
    }
    voice.toggle();
  }, [voice, showAlert]);
  // Surface voice errors (permissions, recognizer failures) so they're not silent.
  useEffect(() => {
    if (voice.error)
      showAlert({ title: "Voice", message: voice.error, type: "info" });
  }, [voice.error, showAlert]);

  return { voice, handleMicPress };
}
