import { useAlert } from '@/components/CustomAlert';
import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { usePauseVideosWhileOpen } from '@/contexts/VideoPlayerContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { feedService } from '@/lib/services/feedService';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_VIDEO_DURATION = 30; // seconds
const MAX_VIDEO_SIZE_MB = 50; // megabytes
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const MAX_IMAGES = 10;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_PREVIEW_SIZE = (SCREEN_WIDTH - 60) / 3;

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

interface MediaItem {
  uri: string;
  type: 'video' | 'image';
}

export default function CreatePostModal({
  visible,
  onClose,
  onPostCreated,
}: CreatePostModalProps) {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  usePauseVideosWhileOpen(visible);
  const [text, setText] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isPickingMedia, setIsPickingMedia] = useState(false);
  const inputAccessoryViewID = 'createPostAccessory';

  // Get first video for player (if any)
  const firstVideo = mediaItems.find(m => m.type === 'video');
  const player = useVideoPlayer(firstVideo?.uri || null, player => {
    player.loop = false;
  });

  const hasVideo = mediaItems.some(m => m.type === 'video');
  const imageCount = mediaItems.filter(m => m.type === 'image').length;

  const resetForm = () => {
    setText('');
    setMediaItems([]);
  };

  const handleClose = () => {
    if (text.trim() || mediaItems.length > 0) {
      showAlert({
        title: 'Discard Post?',
        message: 'You have unsaved changes. Are you sure you want to discard this post?',
        type: 'warning',
        buttons: [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              resetForm();
              onClose();
            },
          },
        ],
      });
    } else {
      onClose();
    }
  };

  const pickImages = async () => {
    if (hasVideo) {
      showAlert({ title: 'Cannot Mix Media', message: 'Please remove the video first to add images.', type: 'warning' });
      return;
    }

    if (imageCount >= MAX_IMAGES) {
      showAlert({ title: 'Maximum Reached', message: `You can only add up to ${MAX_IMAGES} images.`, type: 'info' });
      return;
    }

    setIsPickingMedia(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ title: 'Permission Required', message: 'Please allow access to your media library to attach files.', type: 'warning' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - imageCount,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newItems: MediaItem[] = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'image' as const,
        }));
        setMediaItems(prev => [...prev, ...newItems]);
        playHapticFeedback('light', false);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      showAlert({ title: 'Error', message: 'Failed to select images. Please try again.', type: 'error' });
    } finally {
      setIsPickingMedia(false);
    }
  };

  const pickVideo = async () => {
    if (mediaItems.length > 0) {
      showAlert({ title: 'Cannot Mix Media', message: 'Please remove existing media first to add a video.', type: 'warning' });
      return;
    }

    setIsPickingMedia(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ title: 'Permission Required', message: 'Please allow access to your media library to attach files.', type: 'warning' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: MAX_VIDEO_DURATION,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Check duration
        if (asset.duration && asset.duration > MAX_VIDEO_DURATION * 1000) {
          showAlert({ title: 'Video Too Long', message: `Please select a video under ${MAX_VIDEO_DURATION} seconds.`, type: 'warning' });
          return;
        }

        // Check file size
        if (asset.fileSize && asset.fileSize > MAX_VIDEO_SIZE_BYTES) {
          const sizeMB = (asset.fileSize / (1024 * 1024)).toFixed(1);
          showAlert({ title: 'Video Too Large', message: `Your video is ${sizeMB}MB. Please select a video under ${MAX_VIDEO_SIZE_MB}MB.`, type: 'warning' });
          return;
        }

        setMediaItems([{ uri: asset.uri, type: 'video' }]);
        playHapticFeedback('light', false);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      showAlert({ title: 'Error', message: 'Failed to select video. Please try again.', type: 'error' });
    } finally {
      setIsPickingMedia(false);
    }
  };

  const removeMedia = (index: number) => {
    playHapticFeedback('light', false);
    setMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!text.trim() && mediaItems.length === 0) {
      showAlert({ title: 'Empty Post', message: 'Please add some text or media to your post.', type: 'info' });
      return;
    }

    Keyboard.dismiss();

    // Show immediate feedback and close
    playHapticFeedback('success', false);
    showAlert({ title: 'Uploaded!', message: 'Your post is being shared.', type: 'success' });

    const postText = text.trim();
    const postMedia = mediaItems.length > 0 ? [...mediaItems] : undefined;

    resetForm();
    onClose();

    // Upload in background
    feedService.createPost({
      text: postText,
      media: postMedia,
    }).then(success => {
      if (success) {
        onPostCreated?.();
      } else {
        console.error('Failed to create post in background');
      }
    }).catch(error => {
      console.error('Error creating post:', error);
    });
  };

  const canPost = text.trim().length > 0 || mediaItems.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
                backgroundColor: canPost
                  ? currentTheme.colors.primary
                  : currentTheme.colors.border,
              },
            ]}
            onPress={handleSubmit}
            disabled={!canPost}
          >
            <Text style={[styles.postButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
              Post
            </Text>
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

            {/* Media Preview Grid */}
            {mediaItems.length > 0 && (
              <View style={styles.mediaGrid}>
                {mediaItems.map((item, index) => (
                  <View
                    key={index}
                    style={[
                      styles.mediaPreviewWrapper,
                      hasVideo && styles.videoPreviewWrapper,
                    ]}
                  >
                    <TouchableOpacity
                      style={[styles.removeMediaButton, { backgroundColor: currentTheme.colors.background }]}
                      onPress={() => removeMedia(index)}
                    >
                      <Ionicons name="close" size={16} color={currentTheme.colors.text} />
                    </TouchableOpacity>

                    {item.type === 'video' ? (
                      <VideoView
                        player={player}
                        style={styles.videoPreview}
                        contentFit="cover"
                        nativeControls
                      />
                    ) : (
                      <Image
                        source={{ uri: item.uri }}
                        style={[
                          styles.imagePreview,
                          mediaItems.length === 1 && styles.singleImagePreview,
                        ]}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                ))}

                {/* Add more images button */}
                {!hasVideo && imageCount < MAX_IMAGES && (
                  <TouchableOpacity
                    style={[styles.addMoreButton, { backgroundColor: currentTheme.colors.surface }]}
                    onPress={pickImages}
                    disabled={isPickingMedia}
                  >
                    {isPickingMedia ? (
                      <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="add" size={32} color={currentTheme.colors.primary} />
                        <Text style={[styles.addMoreText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                          {MAX_IMAGES - imageCount} left
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Media Picker Buttons */}
            {mediaItems.length === 0 && (
              <View style={styles.mediaButtons}>
                <TouchableOpacity
                  style={[styles.mediaButton, { backgroundColor: currentTheme.colors.surface }]}
                  onPress={pickVideo}
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
                  onPress={pickImages}
                  disabled={isPickingMedia}
                >
                  <Ionicons name="images" size={24} color={currentTheme.colors.primary} />
                  <Text style={[styles.mediaButtonText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                    Photos
                  </Text>
                  <Text style={[styles.mediaButtonSubtext, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                    Up to {MAX_IMAGES}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          
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
      </View>
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mediaPreviewWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoPreviewWrapper: {
    width: '100%',
  },
  imagePreview: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 12,
  },
  singleImagePreview: {
    width: SCREEN_WIDTH - 40,
    height: 250,
  },
  videoPreview: {
    width: '100%',
    height: 250,
    borderRadius: 12,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addMoreButton: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(128,128,128,0.3)',
  },
  addMoreText: {
    fontSize: 12,
    marginTop: 4,
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
