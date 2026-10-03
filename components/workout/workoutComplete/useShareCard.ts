// Share-card state: capture format, which layout is showing (and the flip
// between them), and the per-destination share handlers.
import { StrengthTier } from '@/lib/data/strengthStandards';
import { buildSharePostText, CardVariant, LiftSpotlight } from '@/lib/gamification/sessionShareCard';
import { captureAndShare } from '@/lib/ui/shareUtils';
import playHapticFeedback from '@/lib/utils/haptic';
import { WeightUnit } from '@/types';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import React, { useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import ViewShot, { captureRef } from 'react-native-view-shot';

export type ShareMode = 'card' | 'sticker';

export function useShareCard({
  cardVariants,
  liftSpotlight,
  overallTier,
  overallAfter,
  volumeDisplay,
  weightUnit,
}: {
  cardVariants: CardVariant[];
  liftSpotlight: LiftSpotlight | null;
  overallTier: StrengthTier | null;
  overallAfter: number;
  volumeDisplay: string | null;
  weightUnit: WeightUnit;
}) {
  // card = framed poster on the generated backdrop; sticker = transparent
  // stats-only PNG to overlay on your own photo (IG-story style).
  const [shareMode, setShareMode] = useState<ShareMode>('card');
  // Which card layout is showing — tap the card to flip to the next one.
  const [cardIndex, setCardIndex] = useState(0);
  const cardRotY = useSharedValue(0);
  const shareRef = useRef<ViewShot>(null);

  // ---- Tailored shares: each platform gets the format it's actually used with ----
  const [copied, setCopied] = useState(false);

  // Switch the capture format first (sticker for IG overlays, card for feeds),
  // let it paint, then hand off.
  const captureAs = (mode: ShareMode, then: () => void) => {
    playHapticFeedback('light', false);
    setShareMode(mode);
    setTimeout(then, 150);
  };

  // Instagram lives on story overlays → transparent sticker into the sheet.
  const handleInstagram = () =>
    captureAs('sticker', () => captureAndShare(shareRef as React.RefObject<ViewShot>));

  // X is text-first → a pre-written brag, no image required.
  const handlePost = () => {
    playHapticFeedback('light', false);
    const text = buildSharePostText({ liftSpotlight, overallTier, overallAfter, volumeDisplay, weightUnit });
    Linking.openURL(`https://x.com/intent/post?text=${encodeURIComponent(text)}`).catch(() => {});
  };

  // Copy puts the current card on the clipboard for anywhere else (Discord, group chats).
  const handleCopy = async () => {
    playHapticFeedback('light', false);
    try {
      const base64 = await captureRef(shareRef, { format: 'png', quality: 1, result: 'base64' });
      await Clipboard.setImageAsync(base64);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy card failed:', err);
    }
  };

  // Save drops the framed card straight into the photo library — ready for
  // lifting profiles, grid posts, or anywhere the share sheet doesn't reach.
  const [saved, setSaved] = useState(false);
  const handleSave = () =>
    captureAs('card', async () => {
      try {
        const uri = await captureRef(shareRef, { format: 'png', quality: 1 });
        const { granted } = await MediaLibrary.requestPermissionsAsync(true);
        if (!granted) return;
        await MediaLibrary.saveToLibraryAsync(uri);
        playHapticFeedback('success', false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error('Save card failed:', err);
      }
    });

  const activeVariant = cardVariants[Math.min(cardIndex, cardVariants.length - 1)];

  const flipCard = () => {
    if (cardVariants.length < 2) return;
    playHapticFeedback('light', false);
    const next = (cardIndex + 1) % cardVariants.length;
    cardRotY.value = withTiming(
      90,
      { duration: 150, easing: Easing.in(Easing.quad) },
      (finished) => {
        'worklet';
        if (finished) {
          runOnJS(setCardIndex)(next);
          cardRotY.value = -90;
          cardRotY.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) });
        }
      },
    );
  };
  const flipStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${cardRotY.value}deg` }],
  }));

  return {
    shareRef,
    shareMode,
    setShareMode,
    cardIndex,
    activeVariant,
    flipCard,
    flipStyle,
    copied,
    saved,
    handleInstagram,
    handlePost,
    handleCopy,
    handleSave,
  };
}
