import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback, { type HapticType } from '@/lib/haptic';
import { getSound, type SoundName } from '@/lib/sounds';
import { useAudioPlayer } from 'expo-audio';
import React from 'react';
import { Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'subtle';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticType?: HapticType;
  soundName?: SoundName;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
  textStyle,
  hapticType = 'none',
  soundName,
}: ButtonProps) {
  const { currentTheme } = useTheme();
  
  const soundFile = soundName ? getSound(soundName) : null;
  const audioPlayer = useAudioPlayer(soundFile);

  const playSound = () => {
    if (!soundFile || disabled || !audioPlayer) return;

    try {
      audioPlayer.seekTo(0);
      audioPlayer.play();
    } catch (error) {
      console.warn('Sound playback failed:', error);
    }
  };

  const handlePress = async () => {
    if (disabled) return;

    await Promise.all([
      playHapticFeedback(hapticType, disabled),
      Promise.resolve(playSound()),
    ]);

    onPress();
  };

  const getButtonStyle = () => {
    const baseStyle = {
      borderRadius: currentTheme.borderRadius,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      opacity: disabled ? 0.6 : 1,
    };

    const sizeStyles = {
      small: { paddingHorizontal: 16, paddingVertical: 8, minHeight: 36 },
      medium: { paddingHorizontal: 24, paddingVertical: 12, minHeight: 48 },
      large: { paddingHorizontal: 32, paddingVertical: 16, minHeight: 56 },
    };

    const variantStyles = {
      primary: {
        backgroundColor: currentTheme.colors.primary,
      },
      secondary: {
        backgroundColor: currentTheme.colors.surface,
        borderWidth: 1,
        borderColor: currentTheme.colors.border,
      },
      ghost: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: currentTheme.colors.primary,
      },
      subtle: {
        backgroundColor: currentTheme.colors.surface + '40',
        borderWidth: 1,
        borderColor: currentTheme.colors.border + '30',
      },
    };

    return [baseStyle, sizeStyles[size], variantStyles[variant]];
  };

  const getTextStyle = () => {
    const baseTextStyle = {
      fontWeight: '600' as const,
      textAlign: 'center' as const,
      fontFamily: 'Raleway_600SemiBold',
    };

    const sizeTextStyles = {
      small: { fontSize: 14 },
      medium: { fontSize: 16 },
      large: { fontSize: 18 },
    };

    const variantTextStyles = {
      primary: { color: currentTheme.colors.background },
      secondary: { color: currentTheme.colors.text },
      ghost: { color: currentTheme.colors.primary },
      subtle: { color: currentTheme.colors.text, opacity: 0.7 },
    };

    return [baseTextStyle, sizeTextStyles[size], variantTextStyles[variant]];
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[getTextStyle(), textStyle]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
} 