import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

// Circular icon action with a caption — the bottom bar's share-destination unit.
function MiniAction({
  icon,
  label,
  onPress,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const { currentTheme } = useTheme();
  return (
    <TouchableOpacity
      style={styles.miniAction}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <RNView
        style={[
          styles.miniCircle,
          accent && {
            backgroundColor: currentTheme.colors.primary,
            borderColor: currentTheme.colors.primary,
          },
        ]}
      >
        <Ionicons name={icon} size={22} color="#fff" />
      </RNView>
      <Text variant="meta" style={styles.miniLabel}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface ShareActionBarProps {
  paddingBottom: number;
  copied: boolean;
  saved: boolean;
  onInstagram: () => void;
  onPost: () => void;
  onCopy: () => void;
  onSave: () => void;
  onDone: () => void;
}

export default function ShareActionBar({
  paddingBottom,
  copied,
  saved,
  onInstagram,
  onPost,
  onCopy,
  onSave,
  onDone,
}: ShareActionBarProps) {
  return (
    <Animated.View
      entering={FadeIn.delay(700)}
      style={[styles.buttonContainer, { paddingBottom }]}
    >
      {/* Share destinations lead; Done sits on the right — the terminal
          action lives where thumbs expect to end the flow. */}
      <MiniAction icon="logo-instagram" label="Story" onPress={onInstagram} />
      <MiniAction icon="logo-twitter" label="Post" onPress={onPost} />
      <MiniAction
        icon={copied ? 'checkmark' : 'copy-outline'}
        label={copied ? 'Copied' : 'Copy'}
        onPress={onCopy}
      />
      <MiniAction
        icon={saved ? 'checkmark' : 'download-outline'}
        label={saved ? 'Saved' : 'Save'}
        onPress={onSave}
        accent
      />
      <RNView style={styles.actionSpacer} />
      <MiniAction icon="chevron-down" label="Done" onPress={onDone} />
    </Animated.View>
  );
}

// White-alpha palette is a named exception (screen is always dark).
const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
    paddingHorizontal: space.section,
    paddingTop: space.lg,
  },
  actionSpacer: {
    flex: 1,
  },
  miniAction: {
    alignItems: 'center',
    gap: space.xs,
  },
  // Rounded squares (radius.card), matching the app's tile shape language.
  miniCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  miniLabel: {
    color: 'rgba(255,255,255,0.5)',
  },
});
