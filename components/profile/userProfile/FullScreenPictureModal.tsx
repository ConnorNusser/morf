import IconButton from '@/components/IconButton';
import { View } from '@/components/Themed';
import React from 'react';
import { Image, Modal, StyleSheet, TouchableOpacity } from 'react-native';

interface FullScreenPictureModalProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

/** Tap-anywhere-to-dismiss full-screen view of the profile picture. */
export default function FullScreenPictureModal({ visible, uri, onClose }: FullScreenPictureModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.fullScreenContainer}
        activeOpacity={1}
        onPress={onClose}
      >
        <Image
          source={{ uri }}
          style={styles.fullScreenImage}
          resizeMode="contain"
        />
        <View style={styles.fullScreenCloseButton}>
          <IconButton
            icon="close"
            onPress={onClose}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            iconColor="#FFFFFF"
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
});
