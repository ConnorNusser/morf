import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Animated,
  View,
} from 'react-native';

interface VoiceMicButtonProps {
  isListening: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const VoiceMicButton: React.FC<VoiceMicButtonProps> = ({
  isListening,
  onPress,
  disabled = false,
  size = 'medium',
}) => {
  const { currentTheme } = useTheme();
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isListening) {
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Stop animation
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const sizeConfig = {
    small: { button: 44, icon: 20 },
    medium: { button: 56, icon: 26 },
    large: { button: 68, icon: 32 },
  };

  const { button: buttonSize, icon: iconSize } = sizeConfig[size];

  return (
    <View style={styles.container}>
      {isListening && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: buttonSize + 20,
              height: buttonSize + 20,
              borderRadius: (buttonSize + 20) / 2,
              backgroundColor: currentTheme.colors.accent + '30',
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}
      <TouchableOpacity
        style={[
          styles.button,
          {
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            backgroundColor: isListening
              ? currentTheme.colors.accent
              : currentTheme.colors.surface,
            borderColor: isListening
              ? currentTheme.colors.accent
              : currentTheme.colors.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isListening ? 'stop' : 'mic'}
          size={iconSize}
          color={isListening ? '#fff' : currentTheme.colors.text}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default VoiceMicButton;
