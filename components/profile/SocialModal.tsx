import Button from '@/components/Button';
import { useAlert } from '@/components/CustomAlert';
import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import { Text, View, useInk } from '@/components/Themed';
import UserAvatar from '@/components/ui/UserAvatar';
import { useTheme } from '@/contexts/ThemeContext';
import { analyticsService } from '@/lib/services/analytics';
import { layout } from '@/lib/ui/styles';
import { danger, radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { supabase } from '@/lib/services/supabase';
import { userSyncService } from '@/lib/services/userSyncService';
import { Friend, RemoteUser } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system/next';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import UserProfileModal from './UserProfileModal';

interface SocialModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SocialModal({ visible, onClose }: SocialModalProps) {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
  const ink = useInk();

  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

  const [username, setUsername] = useState<string>('');
  const [editedUsername, setEditedUsername] = useState<string>('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RemoteUser[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const [instagramUsername, setInstagramUsername] = useState('');
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [isSavingSocials, setIsSavingSocials] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      let storedUsername = await analyticsService.getUsername();
      if (!storedUsername) {
        storedUsername = await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(storedUsername);
      }
      setUsername(storedUsername);
      setEditedUsername(storedUsername);

      const friendsList = await userSyncService.getFriends();
      setFriends(friendsList);

      const user = await userSyncService.getCurrentUser();
      if (user && supabase) {
        const { data: userData } = await supabase
          .from('users')
          .select('profile_picture_url, user_data')
          .eq('id', user.id)
          .single();
        if (userData?.profile_picture_url) {
          setProfilePictureUrl(userData.profile_picture_url);
        }
        if (userData?.user_data) {
          const data = userData.user_data as { instagram_username?: string; tiktok_username?: string; discord_username?: string };
          setInstagramUsername(data.instagram_username || '');
          setTiktokUsername(data.tiktok_username || '');
          setDiscordUsername(data.discord_username || '');
        }
      }

      userSyncService.syncUserCountry().catch(_err => {
        // Silently ignore country sync errors
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  const handlePickProfilePicture = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Please allow access to your photo library to upload a profile picture.',
          type: 'warning',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const imageUri = result.assets[0].uri;
      setIsUploadingPicture(true);

      const user = await userSyncService.getCurrentUser();
      if (!user || !supabase) {
        showAlert({ title: 'Error', message: 'Could not get user information', type: 'error' });
        setIsUploadingPicture(false);
        return;
      }

      const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}.${ext}`;

      const file = new File(imageUri);
      const base64 = await file.base64();

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, bytes.buffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        showAlert({ title: 'Upload Failed', message: 'Could not upload profile picture. Please try again.', type: 'error' });
        setIsUploadingPicture(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`; // Cache bust

      await supabase
        .from('users')
        .update({ profile_picture_url: publicUrl })
        .eq('id', user.id);

      setProfilePictureUrl(publicUrl);
      showAlert({ title: 'Success', message: 'Profile picture updated!', type: 'success' });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      showAlert({ title: 'Error', message: 'Failed to upload profile picture', type: 'error' });
    } finally {
      setIsUploadingPicture(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
      setSearchQuery('');
      setSearchResults([]);
      setIsEditingUsername(false);
    }
  }, [visible, loadData]);

  const checkUsernameAvailability = useCallback(async (name: string) => {
    if (name === username) {
      setUsernameAvailable(true);
      setUsernameError(null);
      return;
    }
    setIsCheckingUsername(true);
    try {
      const error = await userSyncService.validateUsername(name);
      setUsernameAvailable(error === null);
      setUsernameError(error);
    } catch {
      setUsernameAvailable(null);
      setUsernameError('Error checking username');
    } finally {
      setIsCheckingUsername(false);
    }
  }, [username]);

  useEffect(() => {
    if (!isEditingUsername) return;
    const timeoutId = setTimeout(() => {
      if (editedUsername.trim()) {
        checkUsernameAvailability(editedUsername.trim());
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [editedUsername, checkUsernameAvailability, isEditingUsername]);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await userSyncService.searchUsers(query);
      const friendIds = new Set(friends.map(f => f.user.id));
      const filteredResults = results.filter(user => !friendIds.has(user.id));
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  }, [friends]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery.trim());
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers]);

  const handleSaveUsername = async () => {
    const trimmedUsername = editedUsername.trim();
    if (trimmedUsername === username) {
      setIsEditingUsername(false);
      return;
    }
    const validationError = await userSyncService.validateUsername(trimmedUsername);
    if (validationError) {
      showAlert({ title: 'Invalid Username', message: validationError, type: 'warning' });
      return;
    }
    setIsSavingUsername(true);
    try {
      await analyticsService.setUsername(trimmedUsername);
      const user = await userSyncService.syncUser(trimmedUsername);
      if (user) {
        setUsername(trimmedUsername);
        setIsEditingUsername(false);
        setUsernameError(null);
      } else {
        showAlert({ title: 'Error', message: 'Failed to sync username.', type: 'error' });
      }
    } catch (error) {
      console.error('Error saving username:', error);
      showAlert({ title: 'Error', message: 'Failed to save username.', type: 'error' });
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSaveSocialLinks = async () => {
    setIsSavingSocials(true);
    try {
      const user = await userSyncService.getCurrentUser();
      if (!user || !supabase) {
        showAlert({ title: 'Error', message: 'Could not save social links', type: 'error' });
        return;
      }

      const { data: currentData } = await supabase
        .from('users')
        .select('user_data')
        .eq('id', user.id)
        .single();

      const existingData = (currentData?.user_data || {}) as Record<string, unknown>;

      const updatedData = {
        ...existingData,
        instagram_username: instagramUsername.trim() || null,
        tiktok_username: tiktokUsername.trim() || null,
        discord_username: discordUsername.trim() || null,
      };

      await supabase
        .from('users')
        .update({ user_data: updatedData })
        .eq('id', user.id);

      showAlert({ title: 'Success', message: 'Social links updated!', type: 'success' });
    } catch (error) {
      console.error('Error saving social links:', error);
      showAlert({ title: 'Error', message: 'Failed to save social links', type: 'error' });
    } finally {
      setIsSavingSocials(false);
    }
  };

  const handleAddFriend = async (user: RemoteUser) => {
    setAddingFriendId(user.id);
    try {
      const success = await userSyncService.addFriend(user.id);
      if (success) {
        setFriends(prev => [...prev, {
          id: `temp_${Date.now()}`,
          user,
          created_at: new Date(),
        }]);
        setSearchResults(prev => prev.filter(u => u.id !== user.id));
        setSearchQuery('');
      } else {
        showAlert({ title: 'Error', message: 'Failed to add friend.', type: 'error' });
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      showAlert({ title: 'Error', message: 'Failed to add friend.', type: 'error' });
    } finally {
      setAddingFriendId(null);
    }
  };

  const handleViewUserProfile = (user: RemoteUser) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const handleRemoveFriend = (friend: Friend) => {
    showAlert({
      title: 'Remove Friend',
      message: `Remove @${friend.user.username} from your friends?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingFriendId(friend.user.id);
            try {
              const success = await userSyncService.removeFriend(friend.user.id);
              if (success) {
                setFriends(prev => prev.filter(f => f.user.id !== friend.user.id));
              }
            } catch (error) {
              console.error('Error removing friend:', error);
            } finally {
              setRemovingFriendId(null);
            }
          },
        },
      ],
    });
  };

  const renderSearchResult = ({ item }: { item: RemoteUser }) => (
    <View style={[styles.userRow, { backgroundColor: currentTheme.colors.surface }]}>
      <View style={styles.userInfo}>
        <UserAvatar uri={item.profile_picture_url} username={item.username} size={36} />
        <Text variant="body" weight="medium" tone="primary" style={styles.username}>
          @{item.username}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: currentTheme.colors.primary }]}
        onPress={() => handleAddFriend(item)}
        disabled={addingFriendId === item.id}
      >
        {addingFriendId === item.id ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="add" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={[styles.userRow, { backgroundColor: currentTheme.colors.surface }]}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => handleViewUserProfile(item.user)}
        activeOpacity={0.7}
      >
        <UserAvatar uri={item.user.profile_picture_url} username={item.user.username} size={36} />
        <Text variant="body" weight="medium" tone="primary" style={styles.username}>
          @{item.user.username}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={ink.faint} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.removeButton, { backgroundColor: tint(danger) }]}
        onPress={() => handleRemoveFriend(item)}
        disabled={removingFriendId === item.user.id}
      >
        {removingFriendId === item.user.id ? (
          <ActivityIndicator size="small" color={danger} />
        ) : (
          <Ionicons name="close" size={18} color={danger} />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
        <KeyboardAvoidingView
          style={layout.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
            <View style={styles.headerSpacer} />
            <Text variant="emphasis" weight="semiBold" tone="primary" style={styles.headerTitle}>
              Social
            </Text>
            <IconButton icon="close" onPress={onClose} />
          </View>

          <FlatList
            data={[]}
            renderItem={null}
            ListHeaderComponent={
              <View style={styles.content}>
                <View style={styles.section}>
                  <Text variant="body" weight="semiBold" tone="primary" style={styles.sectionTitle}>
                    Profile Picture
                  </Text>
                  <View style={styles.profilePictureContainer}>
                    <TouchableOpacity
                      style={[styles.profilePictureButton, { backgroundColor: currentTheme.colors.surface }]}
                      onPress={handlePickProfilePicture}
                      disabled={isUploadingPicture}
                      activeOpacity={0.7}
                    >
                      {isUploadingPicture ? (
                        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                      ) : profilePictureUrl ? (
                        <Image
                          source={{ uri: profilePictureUrl }}
                          style={styles.profilePictureImage}
                        />
                      ) : (
                        <UserAvatar uri={null} username={username} size={100} />
                      )}
                      <View style={[styles.profilePictureEditBadge, { backgroundColor: currentTheme.colors.primary }]}>
                        <Ionicons name="camera" size={14} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                    <View style={styles.profilePictureTextContainer}>
                      <Text variant="meta" tone="secondary" style={styles.profilePictureHint}>
                        Tap to upload a profile picture
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text variant="body" weight="semiBold" tone="primary" style={styles.sectionTitle}>
                    Your Username
                  </Text>

                  {isEditingUsername ? (
                    <View style={styles.section}>
                      <View style={[styles.usernameInputContainer, { backgroundColor: currentTheme.colors.surface }]}>
                        <Text variant="emphasis" weight="semiBold" style={styles.atSymbol}>@</Text>
                        <TextInput
                          style={[styles.usernameInput, { color: currentTheme.colors.text, fontWeight: '500' }]}
                          value={editedUsername}
                          onChangeText={setEditedUsername}
                          placeholder="Enter username"
                          placeholderTextColor={ink.muted}
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoFocus
                        />
                        {isCheckingUsername && (
                          <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                        )}
                        {!isCheckingUsername && usernameAvailable !== null && editedUsername.length >= 1 && (
                          <Ionicons
                            name={usernameAvailable ? 'checkmark-circle' : 'close-circle'}
                            size={20}
                            color={usernameAvailable ? '#22C55E' : danger}
                          />
                        )}
                      </View>
                      {usernameError && editedUsername !== username && (
                        <Text variant="meta" style={styles.errorText}>
                          {usernameError}
                        </Text>
                      )}
                      <View style={styles.usernameButtons}>
                        <TouchableOpacity
                          style={[styles.cancelButton, { borderColor: currentTheme.colors.border }]}
                          onPress={() => {
                            setIsEditingUsername(false);
                            setEditedUsername(username);
                            setUsernameError(null);
                            setUsernameAvailable(null);
                          }}
                        >
                          <Text variant="body" weight="medium" tone="primary" style={styles.cancelButtonText}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <Button
                          title={isSavingUsername ? 'Saving...' : 'Save'}
                          onPress={handleSaveUsername}
                          variant="primary"
                          size="medium"
                          disabled={isSavingUsername || (usernameAvailable === false && editedUsername !== username)}
                          style={layout.flex1}
                        />
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.usernameDisplay, { backgroundColor: currentTheme.colors.surface }]}
                      onPress={() => setIsEditingUsername(true)}
                    >
                      <Text variant="body" weight="medium" tone="primary" style={styles.usernameDisplayText}>
                        @{username}
                      </Text>
                      <Ionicons name="pencil" size={18} color={ink.muted} />
                    </TouchableOpacity>
                  )}
                  <Text variant="meta" tone="secondary" style={styles.helperText}>
                    Your username is how friends can find you.
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text variant="body" weight="semiBold" tone="primary" style={styles.sectionTitle}>
                    Social Links
                  </Text>
                  <Text variant="meta" tone="secondary" style={[styles.helperText, { marginBottom: space.md }]}>
                    Add your social media so friends can connect with you.
                  </Text>

                  <View style={[styles.socialInputContainer, { backgroundColor: currentTheme.colors.surface }]}>
                    <View style={[styles.socialIconContainer, { backgroundColor: '#E1306C20' }]}>
                      <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                    </View>
                    <TextInput
                      style={[styles.socialInput, { color: currentTheme.colors.text, fontWeight: '500' }]}
                      value={instagramUsername}
                      onChangeText={setInstagramUsername}
                      placeholder="Instagram username"
                      placeholderTextColor={ink.faint}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={[styles.socialInputContainer, { backgroundColor: currentTheme.colors.surface, marginTop: space.sm }]}>
                    <View style={[styles.socialIconContainer, { backgroundColor: '#00000015' }]}>
                      <Ionicons name="logo-tiktok" size={20} color={currentTheme.colors.text} />
                    </View>
                    <TextInput
                      style={[styles.socialInput, { color: currentTheme.colors.text, fontWeight: '500' }]}
                      value={tiktokUsername}
                      onChangeText={setTiktokUsername}
                      placeholder="TikTok username"
                      placeholderTextColor={ink.faint}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={[styles.socialInputContainer, { backgroundColor: currentTheme.colors.surface, marginTop: space.sm }]}>
                    <View style={[styles.socialIconContainer, { backgroundColor: '#5865F220' }]}>
                      <Ionicons name="logo-discord" size={20} color="#5865F2" />
                    </View>
                    <TextInput
                      style={[styles.socialInput, { color: currentTheme.colors.text, fontWeight: '500' }]}
                      value={discordUsername}
                      onChangeText={setDiscordUsername}
                      placeholder="Discord username"
                      placeholderTextColor={ink.faint}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <Button
                    title={isSavingSocials ? 'Saving...' : 'Save Social Links'}
                    onPress={handleSaveSocialLinks}
                    variant="primary"
                    size="medium"
                    disabled={isSavingSocials}
                    style={{ marginTop: space.md }}
                  />

                  {(instagramUsername.trim() || tiktokUsername.trim() || discordUsername.trim()) && (
                    <View style={styles.socialPreview}>
                      <Text variant="meta" tone="muted" style={styles.socialPreviewLabel}>
                        Your links (tap to test):
                      </Text>
                      <View style={styles.socialPreviewButtons}>
                        {instagramUsername.trim() && (
                          <TouchableOpacity
                            style={[styles.socialPreviewButton, { backgroundColor: '#E1306C20' }]}
                            onPress={() => Linking.openURL(`https://instagram.com/${instagramUsername.trim()}`)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                            <Text variant="meta" weight="medium" style={[styles.socialPreviewText, { color: '#E1306C' }]}>
                              @{instagramUsername.trim()}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {tiktokUsername.trim() && (
                          <TouchableOpacity
                            style={[styles.socialPreviewButton, { backgroundColor: ink.hairline }]}
                            onPress={() => Linking.openURL(`https://tiktok.com/@${tiktokUsername.trim()}`)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="logo-tiktok" size={20} color={currentTheme.colors.text} />
                            <Text variant="meta" weight="medium" tone="primary" style={styles.socialPreviewText}>
                              @{tiktokUsername.trim()}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {discordUsername.trim() && (
                          <View
                            style={[styles.socialPreviewButton, { backgroundColor: '#5865F220' }]}
                          >
                            <Ionicons name="logo-discord" size={20} color="#5865F2" />
                            <Text variant="meta" weight="medium" style={[styles.socialPreviewText, { color: '#5865F2' }]}>
                              {discordUsername.trim()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <Text variant="body" weight="semiBold" tone="primary" style={styles.sectionTitle}>
                    Add Friends
                  </Text>
                  <View style={[styles.searchContainer, { backgroundColor: currentTheme.colors.surface }]}>
                    <Ionicons name="search" size={18} color={ink.muted} />
                    <TextInput
                      style={[styles.searchInput, { color: currentTheme.colors.text, fontWeight: '500' }]}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search by username..."
                      placeholderTextColor={ink.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {isSearching && (
                      <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                    )}
                  </View>

                  {searchResults.length > 0 && (
                    <View style={styles.list}>
                      {searchResults.map(user => (
                        <View key={user.id}>
                          {renderSearchResult({ item: user })}
                        </View>
                      ))}
                    </View>
                  )}

                  {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                    <Text variant="meta" tone="muted" style={styles.noResults}>
                      No users found
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text variant="body" weight="semiBold" tone="primary" style={styles.sectionTitle}>
                      Your Friends
                    </Text>
                    {friends.length > 0 && (
                      <View style={[styles.badge, { backgroundColor: currentTheme.colors.primary }]}>
                        <Text variant="meta" weight="semiBold" style={styles.badgeText}>
                          {friends.length}
                        </Text>
                      </View>
                    )}
                  </View>

                  {isLoadingFriends ? (
                    <View style={{ marginTop: space.lg, gap: space.xs }}>
                      {[1, 2, 3].map((i) => (
                        <SkeletonCard key={i} variant="leaderboard-row" />
                      ))}
                    </View>
                  ) : friends.length === 0 ? (
                    <View style={[styles.emptyState, { backgroundColor: currentTheme.colors.surface }]}>
                      <Ionicons name="people-outline" size={32} color={ink.faint} />
                      <Text variant="meta" tone="muted" style={styles.emptyText}>
                        No friends yet. Search above to add friends!
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.list}>
                      {friends.map(friend => (
                        <View key={friend.id}>
                          {renderFriend({ item: friend })}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            }
            keyExtractor={() => 'header'}
          />
        </KeyboardAvoidingView>

        <UserProfileModal
          visible={showUserProfile}
          onClose={() => setShowUserProfile(false)}
          user={selectedUser}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {},
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
    gap: space.section,
  },
  section: {
    gap: space.md,
  },
  list: {
    gap: space.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sectionTitle: {},
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
  },
  badgeText: {
    color: '#FFFFFF',
  },
  usernameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.xs,
  },
  atSymbol: {},
  usernameInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  usernameButtons: {
    flexDirection: 'row',
    gap: space.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {},
  usernameDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  usernameDisplayText: {},
  helperText: {
    lineHeight: 18,
  },
  errorText: {
    color: danger,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  noResults: {
    textAlign: 'center',
    paddingVertical: space.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    borderRadius: radius.card,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {},
  username: {},
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    padding: space.section,
    borderRadius: radius.card,
    alignItems: 'center',
    gap: space.sm,
  },
  emptyText: {
    textAlign: 'center',
  },
  profilePictureContainer: {
    alignItems: 'center',
    gap: space.md,
  },
  profilePictureButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  profilePictureImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicturePlaceholderText: {},
  profilePictureEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePictureTextContainer: {
    alignItems: 'center',
  },
  profilePictureHint: {},
  socialInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.control,
    paddingRight: space.lg,
    gap: space.md,
  },
  socialIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: space.lg,
  },
  socialPreview: {
    marginTop: space.lg,
    gap: space.sm,
  },
  socialPreviewLabel: {},
  socialPreviewButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  socialPreviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.control,
  },
  socialPreviewText: {},
});
