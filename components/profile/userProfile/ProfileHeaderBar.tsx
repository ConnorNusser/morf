import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { space, radius, screenGutter } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

interface ProfileHeaderBarProps {
  onClose: () => void;
  /** False on your own profile, where the friend button becomes a spacer. */
  showFriendButton: boolean;
  isFriend: boolean;
  isFriendLoading: boolean;
  onToggleFriend: () => void;
}

/** Fixed top bar: back, "Profile" title, and the add/remove friend button. */
export default function ProfileHeaderBar({
  onClose,
  showFriendButton,
  isFriend,
  isFriendLoading,
  onToggleFriend,
}: ProfileHeaderBarProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
      <IconButton icon="chevron-back" onPress={onClose} />
      <Text variant="emphasis" weight="semiBold" tone="primary">
        Profile
      </Text>
      {/* No friend button on your own profile (reachable via the feed header). */}
      {showFriendButton ? (
        <TouchableOpacity
          style={[
            styles.friendButton,
            {
              backgroundColor: isFriend ? currentTheme.colors.surface : currentTheme.colors.primary,
              borderColor: isFriend ? currentTheme.colors.border : currentTheme.colors.primary,
              borderWidth: 1,
            }
          ]}
          onPress={onToggleFriend}
          disabled={isFriendLoading}
          activeOpacity={0.7}
        >
          {isFriendLoading ? (
            <ActivityIndicator size="small" color={isFriend ? currentTheme.colors.text : '#FFFFFF'} />
          ) : (
            <>
              <Ionicons
                name={isFriend ? 'checkmark' : 'person-add'}
                size={16}
                color={isFriend ? currentTheme.colors.text : '#FFFFFF'}
              />
              <Text
                variant="meta"
                style={{ color: isFriend ? currentTheme.colors.text : '#FFFFFF' }}
              >
                {isFriend ? 'Friends' : 'Add'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        /* Spacer keeps the "Profile" title centered by the space-between row. */
        <View style={[styles.friendButton, { backgroundColor: 'transparent' }]} />
      )}
    </View>
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
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
  },
});
