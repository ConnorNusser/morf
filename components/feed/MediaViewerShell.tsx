import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface MediaViewerShellProps {
  visible: boolean;
  onClose: () => void;
  /** Optional center element in the floating header (e.g. an image counter). */
  headerCenter?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared chrome for the full-screen media lightboxes: a transparent fade Modal
 * over a black backdrop, a safe-area frame, and a floating header with the
 * standard round close button. Bodies (image paging vs video player) live in
 * the callers and render as `children`.
 */
export default function MediaViewerShell({
  visible,
  onClose,
  headerCenter,
  children,
}: MediaViewerShellProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {headerCenter ?? null}
            <View style={{ width: 44 }} />
          </View>
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
