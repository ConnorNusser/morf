import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/haptic';
import { feedService } from '@/lib/feedService';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';

const MAX_VIDEO_DURATION = 30; // seconds

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

type MediaType = 'video' | 'image' | null;

export default function CreatePostModal({
  visible,
  onClose,
  onPostCreated,
}: CreatePostModalProps) {
  const { currentTheme } = useTheme();
  const [text, setText] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickingMedia, setIsPickingMedia] = useState(false);
  const inputAccessoryViewID = 'createPostAccessory';

  const player = useVideoPlayer(mediaUri && mediaType === 'video' ? mediaUri : null, player => {
    player.loop = false;
  });

  const resetForm = () => {
    setText('');
    setMediaUri(null);
    setMediaType(null);
  };

  const handleClose = () => {
    if (text.trim() || mediaUri) {
      Alert.alert(
        'Discard Post?',
        'You have unsaved changes. Are you sure you want to discard this post?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              resetForm();
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  const pickMedia = async (type: 'video' | 'image') => {
    setIsPickingMedia(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your media library to attach files.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'video' ? ['videos'] : ['images'],
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: MAX_VIDEO_DURATION,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Check video duration
        if (type === 'video' && asset.duration && asset.duration > MAX_VIDEO_DURATION * 1000) {
          Alert.alert('Video Too Long', `Please select a video under ${MAX_VIDEO_DURATION} seconds.`);
          return;
        }

        setMediaUri(asset.uri);
        setMediaType(type);
        playHapticFeedback('light', false);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to select media. Please try again.');
    } finally {
      setIsPickingMedia(false);
    }
  };

  const removeMedia = () => {
    playHapticFeedback('light', false);
    setMediaUri(null);
    setMediaType(null);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !mediaUri) {
      Alert.alert('Empty Post', 'Please add some text or media to your post.');
      return;
    }

    Keyboard.dismiss();
    setIsSubmitting(true);

    try {
      const success = await feedService.createPost({
        text: text.trim(),
        media: mediaUri && mediaType ? [{ uri: mediaUri, type: mediaType }] : undefined,
      });

      if (success) {
        playHapticFeedback('success', false);
        resetForm();
        onPostCreated?.();
        onClose();
      } else {
        Alert.alert('Error', 'Failed to create post. Please try again.');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPost = text.trim().length > 0 || mediaUri;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <IconButton icon="close" onPress={handleClose} />
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            New Post
          </Text>
          <TouchableOpacity
            style={[
              styles.postButton,
              {
                backgroundColor: canPost && !isSubmitting
                  ? currentTheme.colors.primary
                  : currentTheme.colors.border,
              },
            ]}
            onPress={handleSubmit}
            disabled={!canPost || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.postButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Text Input */}
            <TextInput
              style={[
                styles.textInput,
                {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                },
              ]}
              placeholder="What's on your mind?"
              placeholderTextColor={currentTheme.colors.text + '50'}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
              autoFocus
              inputAccessoryViewID={inputAccessoryViewID}
            />

            {/* Media Preview */}
            {mediaUri && (
              <View style={styles.mediaPreviewContainer}>
                <TouchableOpacity
                  style={[styles.removeMediaButton, { backgroundColor: currentTheme.colors.background }]}
                  onPress={removeMedia}
                >
                  <Ionicons name="close" size={18} color={currentTheme.colors.text} />
                </TouchableOpacity>

                {mediaType === 'video' ? (
                  <VideoView
                    player={player}
                    style={styles.mediaPreview}
                    contentFit="cover"
                    nativeControls
                  />
                ) : (
                  <Image
                    source={{ uri: mediaUri }}
                    style={styles.mediaPreview}
                    resizeMode="cover"
                  />
                )}
              </View>
            )}

            {/* Media Picker Buttons */}
            {!mediaUri && (
              <View style={styles.mediaButtons}>
                <TouchableOpacity
                  style={[styles.mediaButton, { backgroundColor: currentTheme.colors.surface }]}
                  onPress={() => pickMedia('video')}
                  disabled={isPickingMedia}
                >
                  {isPickingMedia ? (
                    <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="videocam" size={24} color={currentTheme.colors.primary} />
                      <Text style={[styles.mediaButtonText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                        Video
                      </Text>
                      <Text style={[styles.mediaButtonSubtext, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                        Max {MAX_VIDEO_DURATION}s
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.mediaButton, { backgroundColor: currentTheme.colors.surface }]}
                  onPress={() => pickMedia('image')}
                  disabled={isPickingMedia}
                >
                  <Ionicons name="image" size={24} color={currentTheme.colors.primary} />
                  <Text style={[styles.mediaButtonText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                    Photo
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Character count */}
          <View style={[styles.footer, { borderTopColor: currentTheme.colors.border }]}>
            <Text style={[styles.charCount, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
              {text.length}/500
            </Text>
          </View>

          {/* Keyboard accessory with Done button */}
          {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID={inputAccessoryViewID}>
              <RNView style={[styles.accessoryContainer, { backgroundColor: currentTheme.colors.surface, borderTopColor: currentTheme.colors.border }]}>
                <RNView style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => Keyboard.dismiss()}
                  style={styles.doneButton}
                >
                  <Text style={[styles.doneButtonText, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </RNView>
            </InputAccessoryView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonText: {
    fontSize: 15,
    color: '#fff',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    gap: 20,
  },
  textInput: {
    fontSize: 18,
    lineHeight: 26,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  mediaPreviewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: 300,
    borderRadius: 16,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 16,
    gap: 8,
  },
  mediaButtonText: {
    fontSize: 15,
  },
  mediaButtonSubtext: {
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end',
  },
  charCount: {
    fontSize: 13,
  },
  accessoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneButtonText: {
    fontSize: 16,
  },
});
