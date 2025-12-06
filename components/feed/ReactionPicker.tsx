import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/haptic';
import { ReactionType } from '@/lib/userSyncService';
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'kudos', emoji: '❤️', label: 'Love' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'strong', emoji: '💪', label: 'Strong' },
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
];

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: ReactionType) => void;
  currentReaction?: ReactionType;
}

export default function ReactionPicker({ visible, onClose, onSelect, currentReaction }: ReactionPickerProps) {
  const { currentTheme } = useTheme();

  const handleSelect = (type: ReactionType) => {
    playHapticFeedback('light', false);
    onSelect(type);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.backdrop} />
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={[styles.container, { backgroundColor: currentTheme.colors.surface }]}
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_600SemiBold' }]}>
            React
          </Text>
          <View style={styles.reactionsRow}>
            {REACTIONS.map(({ type, emoji, label }) => (
              <Pressable
                key={type}
                style={[
                  styles.reactionButton,
                  currentReaction === type && { backgroundColor: currentTheme.colors.primary + '20' }
                ]}
                onPress={() => handleSelect(type)}
              >
                <Text style={styles.emoji}>{emoji}</Text>
                <Text style={[
                  styles.label,
                  { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }
                ]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// Helper to get emoji for a reaction type
export function getReactionEmoji(type: ReactionType): string {
  return REACTIONS.find(r => r.type === type)?.emoji || '❤️';
}

// Helper to get all reaction info
export { REACTIONS };

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  reactionButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    minWidth: 72,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
  },
});
