import IconButton from '@/components/IconButton';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { screenGutter, space } from '@/lib/ui/tokens';
import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  presentation?: 'fullScreen' | 'pageSheet';
  animationType?: 'slide' | 'fade';
  /** Optional left-header element; defaults to a spacer that balances the close button. */
  leftAction?: React.ReactNode;
  /** Optional extra right-header actions, rendered just before the close button. */
  rightActions?: React.ReactNode;
  /** Defaults to onClose. */
  onRequestClose?: () => void;
  children: React.ReactNode;
}

/**
 * The app's standard full-screen modal shell: a safe-area frame plus the
 * canonical three-slot header — a balancing spacer (or leftAction), a centered
 * title, and a right-aligned `IconButton` close. Encodes the "one close
 * grammar" so callers don't hand-roll it.
 */
export default function ScreenModal({
  visible,
  onClose,
  title,
  presentation = 'fullScreen',
  animationType = 'slide',
  leftAction,
  rightActions,
  onRequestClose,
  children,
}: ScreenModalProps) {
  const { currentTheme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType={animationType}
      presentationStyle={presentation}
      onRequestClose={onRequestClose ?? onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          {leftAction ?? <View style={styles.side} />}
          {title ? (
            <Text variant="title" tone="primary" weight="semiBold" numberOfLines={1} style={styles.title}>
              {title}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          <View style={styles.rightGroup}>
            {rightActions}
            <IconButton icon="close" onPress={onClose} />
          </View>
        </View>
        {children}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { width: 40 },
  flex: { flex: 1 },
  title: { flex: 1, textAlign: 'center' },
  rightGroup: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
