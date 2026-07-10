import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { readableInkOn } from '@/lib/ui/contrast';
import { radius } from '@/lib/ui/tokens';
import playHapticFeedback, { type HapticType } from '@/lib/utils/haptic';
import { getSound, type SoundName } from '@/lib/utils/sounds';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import React from 'react';
import { TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  /** primary = pill CTA (C1); secondary = bordered surface (C2). */
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  /** Optional leading icon, tinted with the label. */
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticType?: HapticType;
  soundName?: SoundName;
}

/** Canonical button: primary pill CTA, secondary bordered surface. */
function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
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
      flexDirection: 'row' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      gap: 8,
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
        borderRadius: radius.pill,
      },
      // Labeled action buttons are pills; radius.card is reserved for cards/tiles/rows.
      secondary: {
        backgroundColor: currentTheme.colors.surface,
        borderWidth: 1,
        borderColor: currentTheme.colors.border,
        borderRadius: radius.pill,
      },
    };

    return [baseStyle, sizeStyles[size], variantStyles[variant]];
  };

  const labelVariant = { small: 'meta', medium: 'body', large: 'emphasis' } as const;

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={size === 'small' ? 15 : 18}
          color={
            (textStyle as TextStyle | undefined)?.color ??
            (variant === 'primary'
              ? readableInkOn(currentTheme.colors.primary)
              : currentTheme.colors.text)
          }
        />
      )}
      <Text
        variant={labelVariant[size]}
        weight="semiBold"
        style={[
          {
            textAlign: 'center',
            color:
              variant === 'primary'
                ? readableInkOn(currentTheme.colors.primary)
                : currentTheme.colors.text,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default React.memo(Button);
