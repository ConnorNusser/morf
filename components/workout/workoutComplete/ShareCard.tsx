// The shareable recap card (ViewShot target) plus its layout dots and the
// Card / Sticker capture-format toggle.
import { Text, View } from '@/components/Themed';
import ShareCardBody, {
  CARD_HAIRLINE,
  ShareCardBodyProps,
} from '@/components/workout/workoutComplete/ShareCardBody';
import { ShareMode, useShareCard } from '@/components/workout/workoutComplete/useShareCard';
import { CardVariant } from '@/lib/gamification/sessionShareCard';
import { radius, space, track } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';

const CARD_BACKDROP = require('@/assets/images/celebration/card-backdrop.jpg');

// Solid (non-alpha) card surface so ViewShot captures cleanly on the dark screen.
const CARD_BG = '#111116';
const CARD_BORDER = 'rgba(255,255,255,0.12)';

type ShareCardState = ReturnType<typeof useShareCard>;

interface ShareCardProps extends ShareCardBodyProps {
  shareRef: ShareCardState['shareRef'];
  shareMode: ShareMode;
  cardVariants: CardVariant[];
  cardIndex: number;
  flipStyle: ShareCardState['flipStyle'];
  onFlip: () => void;
  dateStr: string;
}

export default function ShareCard({
  shareRef,
  shareMode,
  cardVariants,
  cardIndex,
  flipStyle,
  onFlip,
  dateStr,
  ...body
}: ShareCardProps) {
  const cardContent = (
    <View style={styles.cardInner}>
      <View style={styles.cardBrandRow}>
        <Image
          source={require('@/assets/images/icon-original.png')}
          style={styles.cardLogo}
          resizeMode="contain"
        />
        <Text variant="meta" weight="semiBold" style={styles.cardBrand}>
          morf
        </Text>
        <View style={styles.flex} />
        <Text variant="meta" style={styles.cardDate}>
          {dateStr}
        </Text>
      </View>

      <View style={styles.cardBodyWrap}>
        <ShareCardBody {...body} />
      </View>

      <View style={[styles.cardTagline, { borderTopColor: CARD_HAIRLINE }]}>
        <Text variant="meta" style={styles.cardTaglineText}>
          morf · AI strength training
        </Text>
      </View>
    </View>
  );

  return (
    <Animated.View entering={FadeIn.delay(350)} style={styles.cardWrap}>
      <TouchableOpacity activeOpacity={0.92} onPress={onFlip} disabled={cardVariants.length < 2}>
        <Animated.View style={flipStyle}>
          <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
            {/* One stable wrapper — swapping wrapper types would remount the
                content and restart the PR counters on every mode toggle. */}
            <RNView style={[styles.card, shareMode === 'sticker' && styles.cardSticker]}>
              {shareMode === 'card' && (
                <Image source={CARD_BACKDROP} style={styles.cardBgAbs} resizeMode="cover" />
              )}
              {cardContent}
            </RNView>
          </ViewShot>
        </Animated.View>
      </TouchableOpacity>

      {cardVariants.length > 1 && (
        <RNView style={styles.dotsRow}>
          {cardVariants.map((v, i) => (
            <RNView
              key={v}
              style={[
                styles.dot,
                i === Math.min(cardIndex, cardVariants.length - 1) && styles.dotActive,
              ]}
            />
          ))}
          <Text variant="meta" style={styles.dotsHint}>
            tap card for more layouts
          </Text>
        </RNView>
      )}
    </Animated.View>
  );
}

// Card = the framed poster; Sticker = transparent stats to overlay on
// your own gym photo in an IG story (the Hevy-style share).
export function ShareModeToggle({
  shareMode,
  onChange,
}: {
  shareMode: ShareMode;
  onChange: (mode: ShareMode) => void;
}) {
  return (
    <Animated.View entering={FadeIn.delay(450)} style={styles.modeRow}>
      {(['card', 'sticker'] as const).map((m) => (
        <TouchableOpacity
          key={m}
          onPress={() => {
            playHapticFeedback('selection', false);
            onChange(m);
          }}
          style={[styles.modeChip, shareMode === m && styles.modeChipActive]}
        >
          <Text
            variant="meta"
            weight="semiBold"
            style={{ color: shareMode === m ? '#fff' : 'rgba(255,255,255,0.45)' }}
          >
            {m === 'card' ? 'Card' : 'Sticker'}
          </Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

// White-alpha palette is a named exception (screen is always dark); 28/32/36 rhythm is structural.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  cardWrap: {
    width: '100%',
    marginBottom: space.md,
  },
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  cardBgAbs: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  cardSticker: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  // Poster proportions: ~4:5 at full-width, so it drops into feeds cleanly.
  cardInner: {
    padding: space.xl,
    minHeight: 440,
  },
  cardBodyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  cardTagline: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.md,
    alignItems: 'center',
  },
  cardTaglineText: {
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: track.caps,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
    marginBottom: 28,
  },
  modeChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  modeChipActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cardBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.lg,
  },
  cardLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  cardBrand: {
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: track.caps,
  },
  cardDate: {
    color: 'rgba(255,255,255,0.4)',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  dotsHint: {
    color: 'rgba(255,255,255,0.35)',
    marginLeft: space.xs,
  },
});
