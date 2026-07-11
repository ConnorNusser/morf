// Circular user avatar. Shows the profile picture when one is set; otherwise
// falls back to the same person-circle glyph as the header profile button —
// one anonymous-user mark everywhere, instead of per-surface letter initials.
import { useInk } from '@/components/Themed';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image } from 'react-native';

interface UserAvatarProps {
  uri?: string | null;
  size: number;
}

export default function UserAvatar({ uri, size }: UserAvatarProps) {
  const ink = useInk();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  // The glyph draws its own circle; it fills the same size×size box the image
  // would, so surrounding layout is identical for both states.
  return <Ionicons name="person-circle-outline" size={size} color={ink.secondary} />;
}
