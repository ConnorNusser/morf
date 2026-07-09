import { useTheme } from '@/contexts/ThemeContext';
import { space } from '@/lib/ui/tokens';
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Show the drag grabber at the top of the sheet (default true). */
  showGrabber?: boolean;
  /** Fraction of screen height the sheet may grow to (default 0.85). */
  maxHeightRatio?: number;
}

/**
 * Dim-backdrop bottom sheet: a tap-scrim to dismiss, a rounded top, and
 * safe-area bottom padding. The shared shell for the app's flex-end
 * transparent sheets. Content padding is left to the caller so it composes.
 */
export default function BottomSheet({
  visible,
  onClose,
  children,
  showGrabber = true,
  maxHeightRatio = 0.85,
}: BottomSheetProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: currentTheme.colors.background,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
              paddingBottom: insets.bottom + space.md,
            },
          ]}
        >
          {showGrabber && <View style={[styles.grabber, { backgroundColor: currentTheme.colors.border }]} />}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    // Sheets use a 20pt top radius (larger than radius.card) — matches the
    // app's existing bottom-sheet corners.
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: space.sm,
    marginBottom: space.sm,
  },
});
