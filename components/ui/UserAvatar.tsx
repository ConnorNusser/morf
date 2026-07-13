// Circular user avatar. Shows the profile picture when one is set; otherwise
// falls back to a lettered circle like the profile/leaderboard placeholders.
// The letters are the username's LAST two characters: default usernames are
// `user_<hex>`, so a first-initial would render every default user as "U".
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { tint } from '@/lib/ui/tokens';
import React from 'react';
import { Image, View } from 'react-native';

interface UserAvatarProps {
  uri?: string | null;
  username?: string | null;
  size: number;
}

export default function UserAvatar({ uri, username, size }: UserAvatarProps) {
  const { currentTheme } = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  const letters = username ? username.slice(-2).toUpperCase() : '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint(currentTheme.colors.primary),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="meta" weight="semiBold">
        {letters}
      </Text>
    </View>
  );
}
