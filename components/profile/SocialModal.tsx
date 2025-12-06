import Button from '@/components/Button';
import IconButton from '@/components/IconButton';
import SkeletonCard from '@/components/SkeletonCard';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { analyticsService } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { userSyncService } from '@/lib/userSyncService';
import { Friend, RemoteUser } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system/next';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

  // Profile picture state
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

  // Username state
  const [username, setUsername] = useState<string>('');
  const [editedUsername, setEditedUsername] = useState<string>('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Friends state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RemoteUser[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);

  // User profile modal state
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Social links state
  const [instagramUsername, setInstagramUsername] = useState('');
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [isSavingSocials, setIsSavingSocials] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      // Load username
      let storedUsername = await analyticsService.getUsername();
      if (!storedUsername) {
        storedUsername = await analyticsService.generateDefaultUsername();
        await analyticsService.setUsername(storedUsername);
      }
      setUsername(storedUsername);
      setEditedUsername(storedUsername);

      // Load friends
      const friendsList = await userSyncService.getFriends();
      setFriends(friendsList);

      // Load profile picture and social links
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
        // Load social links from user_data
        if (userData?.user_data) {
          const data = userData.user_data as { instagram_username?: string; tiktok_username?: string };
          setInstagramUsername(data.instagram_username || '');
          setTiktokUsername(data.tiktok_username || '');
        }
      }

      // Sync user country in background
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
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload a profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
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

      // Get current user
      const user = await userSyncService.getCurrentUser();
      if (!user || !supabase) {
        Alert.alert('Error', 'Could not get user information');
        setIsUploadingPicture(false);
        return;
      }

      // Determine file extension
      const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}.${ext}`;

      // Read file as base64 using new expo-file-system API
      const file = new File(imageUri);
      const base64 = await file.base64();

      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, bytes.buffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert('Upload Failed', 'Could not upload profile picture. Please try again.');
        setIsUploadingPicture(false);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`; // Cache bust

      // Update user record
      await supabase
        .from('users')
        .update({ profile_picture_url: publicUrl })
        .eq('id', user.id);

      setProfilePictureUrl(publicUrl);
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
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

  // Username availability check
  const checkUsernameAvailability = useCallback(async (name: string) => {
    if (name === username) {
      setUsernameAvailable(true);
      setUsernameError(null);
      return;
    }
    if (name.length === 0) {
      setUsernameAvailable(null);
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

  // Search users
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
    // Final validation before saving
    const validationError = await userSyncService.validateUsername(trimmedUsername);
    if (validationError) {
      Alert.alert('Invalid Username', validationError);
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
        Alert.alert('Error', 'Failed to sync username.');
      }
    } catch (error) {
      console.error('Error saving username:', error);
      Alert.alert('Error', 'Failed to save username.');
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSaveSocialLinks = async () => {
    setIsSavingSocials(true);
    try {
      const user = await userSyncService.getCurrentUser();
      if (!user || !supabase) {
        Alert.alert('Error', 'Could not save social links');
        return;
      }

      // Get current user_data
      const { data: currentData } = await supabase
        .from('users')
        .select('user_data')
        .eq('id', user.id)
        .single();

      const existingData = (currentData?.user_data || {}) as Record<string, unknown>;

      // Update with new social links
      const updatedData = {
        ...existingData,
        instagram_username: instagramUsername.trim() || null,
        tiktok_username: tiktokUsername.trim() || null,
      };

      await supabase
        .from('users')
        .update({ user_data: updatedData })
        .eq('id', user.id);

      Alert.alert('Success', 'Social links updated!');
    } catch (error) {
      console.error('Error saving social links:', error);
      Alert.alert('Error', 'Failed to save social links');
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
        Alert.alert('Error', 'Failed to add friend.');
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend.');
    } finally {
      setAddingFriendId(null);
    }
  };

  const handleViewUserProfile = (user: RemoteUser) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const handleRemoveFriend = async (friend: Friend) => {
    Alert.alert(
      'Remove Friend',
      `Remove @${friend.user.username} from your friends?`,
      [
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
      ]
    );
  };

  const renderSearchResult = ({ item }: { item: RemoteUser }) => (
    <View style={[styles.userRow, { backgroundColor: currentTheme.colors.surface }]}>
      <View style={[styles.userInfo, { backgroundColor: 'transparent' }]}>
        {item.profile_picture_url ? (
          <Image
            source={{ uri: item.profile_picture_url }}
            style={[styles.avatar, { backgroundColor: currentTheme.colors.primary + '20' }]}
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: currentTheme.colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: currentTheme.colors.primary }]}>
              {item.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.username, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
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
        style={[styles.userInfo, { backgroundColor: 'transparent' }]}
        onPress={() => handleViewUserProfile(item.user)}
        activeOpacity={0.7}
      >
        {item.user.profile_picture_url ? (
          <Image
            source={{ uri: item.user.profile_picture_url }}
            style={[styles.avatar, { backgroundColor: currentTheme.colors.primary + '20' }]}
          />
        ) : (
          <View style={[styles.avatar, { backgroundColor: currentTheme.colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: currentTheme.colors.primary }]}>
              {item.user.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={[styles.username, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
          @{item.user.username}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '40'} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.removeButton, { backgroundColor: '#EF444420' }]}
        onPress={() => handleRemoveFriend(item)}
        disabled={removingFriendId === item.user.id}
      >
        {removingFriendId === item.user.id ? (
          <ActivityIndicator size="small" color="#EF4444" />
        ) : (
          <Ionicons name="close" size={18} color="#EF4444" />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
            <IconButton icon="chevron-back" onPress={onClose} />
            <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              Social
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <FlatList
            data={[]}
            renderItem={null}
            ListHeaderComponent={
              <View style={styles.content}>
                {/* Profile Picture Section */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
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
                        <View style={[styles.profilePicturePlaceholder, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                          <Text style={[styles.profilePicturePlaceholderText, { color: currentTheme.colors.primary }]}>
                            {username ? username.charAt(0).toUpperCase() : '?'}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.profilePictureEditBadge, { backgroundColor: currentTheme.colors.primary }]}>
                        <Ionicons name="camera" size={14} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                    <View style={styles.profilePictureTextContainer}>
                      <Text style={[styles.profilePictureHint, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
                        Tap to upload a profile picture
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Username Section */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    Your Username
                  </Text>

                  {isEditingUsername ? (
                    <View style={styles.usernameEditContainer}>
                      <View style={[styles.usernameInputContainer, { backgroundColor: currentTheme.colors.surface }]}>
                        <Text style={[styles.atSymbol, { color: currentTheme.colors.primary }]}>@</Text>
                        <TextInput
                          style={[styles.usernameInput, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}
                          value={editedUsername}
                          onChangeText={setEditedUsername}
                          placeholder="Enter username"
                          placeholderTextColor={currentTheme.colors.text + '60'}
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
                            color={usernameAvailable ? '#22C55E' : '#EF4444'}
                          />
                        )}
                      </View>
                      {usernameError && editedUsername !== username && (
                        <Text style={[styles.errorText, { fontFamily: 'Raleway_400Regular' }]}>
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
                          <Text style={[styles.cancelButtonText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <Button
                          title={isSavingUsername ? 'Saving...' : 'Save'}
                          onPress={handleSaveUsername}
                          variant="primary"
                          size="medium"
                          disabled={isSavingUsername || (!usernameAvailable && editedUsername !== username)}
                          style={styles.saveButton}
                        />
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.usernameDisplay, { backgroundColor: currentTheme.colors.surface }]}
                      onPress={() => setIsEditingUsername(true)}
                    >
                      <Text style={[styles.usernameDisplayText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                        @{username}
                      </Text>
                      <Ionicons name="pencil" size={18} color={currentTheme.colors.text + '60'} />
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.helperText, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}>
                    Your username is how friends can find you.
                  </Text>
                </View>

                {/* Social Links Section */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    Social Links
                  </Text>
                  <Text style={[styles.helperText, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular', marginBottom: 12 }]}>
                    Add your social media so friends can connect with you.
                  </Text>

                  {/* Instagram */}
                  <View style={[styles.socialInputContainer, { backgroundColor: currentTheme.colors.surface }]}>
                    <View style={[styles.socialIconContainer, { backgroundColor: '#E1306C20' }]}>
                      <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                    </View>
                    <TextInput
                      style={[styles.socialInput, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}
                      value={instagramUsername}
                      onChangeText={setInstagramUsername}
                      placeholder="Instagram username"
                      placeholderTextColor={currentTheme.colors.text + '40'}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {/* TikTok */}
                  <View style={[styles.socialInputContainer, { backgroundColor: currentTheme.colors.surface, marginTop: 8 }]}>
                    <View style={[styles.socialIconContainer, { backgroundColor: '#00000015' }]}>
                      <Ionicons name="logo-tiktok" size={20} color={currentTheme.colors.text} />
                    </View>
                    <TextInput
                      style={[styles.socialInput, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}
                      value={tiktokUsername}
                      onChangeText={setTiktokUsername}
                      placeholder="TikTok username"
                      placeholderTextColor={currentTheme.colors.text + '40'}
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
                    style={{ marginTop: 12 }}
                  />

                  {/* Preview of your social links */}
                  {(instagramUsername.trim() || tiktokUsername.trim()) && (
                    <View style={styles.socialPreview}>
                      <Text style={[styles.socialPreviewLabel, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
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
                            <Text style={[styles.socialPreviewText, { color: '#E1306C', fontFamily: 'Raleway_500Medium' }]}>
                              @{instagramUsername.trim()}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {tiktokUsername.trim() && (
                          <TouchableOpacity
                            style={[styles.socialPreviewButton, { backgroundColor: currentTheme.colors.text + '10' }]}
                            onPress={() => Linking.openURL(`https://tiktok.com/@${tiktokUsername.trim()}`)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="logo-tiktok" size={20} color={currentTheme.colors.text} />
                            <Text style={[styles.socialPreviewText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                              @{tiktokUsername.trim()}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                {/* Search Friends Section */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    Add Friends
                  </Text>
                  <View style={[styles.searchContainer, { backgroundColor: currentTheme.colors.surface }]}>
                    <Ionicons name="search" size={18} color={currentTheme.colors.text + '60'} />
                    <TextInput
                      style={[styles.searchInput, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search by username..."
                      placeholderTextColor={currentTheme.colors.text + '60'}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {isSearching && (
                      <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                    )}
                  </View>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <View style={styles.resultsList}>
                      {searchResults.map(user => (
                        <View key={user.id}>
                          {renderSearchResult({ item: user })}
                        </View>
                      ))}
                    </View>
                  )}

                  {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                    <Text style={[styles.noResults, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                      No users found
                    </Text>
                  )}
                </View>

                {/* Friends List Section */}
                <View style={styles.section}>
                  <View style={[styles.sectionHeader, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.sectionTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      Your Friends
                    </Text>
                    {friends.length > 0 && (
                      <View style={[styles.badge, { backgroundColor: currentTheme.colors.primary }]}>
                        <Text style={[styles.badgeText, { fontFamily: 'Raleway_600SemiBold' }]}>
                          {friends.length}
                        </Text>
                      </View>
                    )}
                  </View>

                  {isLoadingFriends ? (
                    <View style={{ marginTop: 16, gap: 4 }}>
                      {[1, 2, 3].map((i) => (
                        <SkeletonCard key={i} variant="leaderboard-row" />
                      ))}
                    </View>
                  ) : friends.length === 0 ? (
                    <View style={[styles.emptyState, { backgroundColor: currentTheme.colors.surface }]}>
                      <Ionicons name="people-outline" size={32} color={currentTheme.colors.text + '40'} />
                      <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                        No friends yet. Search above to add friends!
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.friendsList}>
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

        {/* User Profile Modal */}
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
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  usernameEditContainer: {
    gap: 12,
  },
  usernameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  atSymbol: {
    fontSize: 18,
    fontWeight: '600',
  },
  usernameInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  usernameButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
  },
  usernameDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  usernameDisplayText: {
    fontSize: 16,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  resultsList: {
    gap: 8,
  },
  friendsList: {
    gap: 8,
  },
  noResults: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  username: {
    fontSize: 15,
  },
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
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  profilePictureContainer: {
    alignItems: 'center',
    gap: 12,
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
  profilePicturePlaceholderText: {
    fontSize: 40,
    fontWeight: '600',
  },
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
  profilePictureHint: {
    fontSize: 13,
  },
  socialInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingRight: 16,
    gap: 12,
  },
  socialIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
  },
  socialPreview: {
    marginTop: 16,
    gap: 8,
  },
  socialPreviewLabel: {
    fontSize: 13,
  },
  socialPreviewButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  socialPreviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  socialPreviewText: {
    fontSize: 14,
  },
});
