import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface StartButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'outlined';
  style?: ViewStyle;
}

// The app's primary "go" button: label on the left, a rounded-square arrow chip on
// the right, and a tactile press (the whole button springs to 0.96 and the arrow
// nudges forward on press, flinging forward on release). Shared by the home
// routine card and the Quick start button so they look and feel identical.
export default function StartButton({ label, onPress, variant = 'solid', style }: StartButtonProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const outlined = variant === 'outlined';

  const pressScale = useSharedValue(1);
  const arrowShift = useSharedValue(0);
  const buttonAnim = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const arrowAnim = useAnimatedStyle(() => ({ transform: [{ translateX: arrowShift.value }] }));

  const onPressIn = useCallback(() => {
    pressScale.value = withSpring(0.96, { damping: 18, stiffness: 320 });
    arrowShift.value = withSpring(4);
  }, [pressScale, arrowShift]);
  const onPressOut = useCallback(() => {
    pressScale.value = withSpring(1, { damping: 14, stiffness: 260 });
    arrowShift.value = withSpring(0);
  }, [pressScale, arrowShift]);
  const handlePress = useCallback(() => {
    arrowShift.value = withSequence(withTiming(14, { duration: 130 }), withSpring(0));
    onPress();
  }, [arrowShift, onPress]);

  return (
    <AnimatedPressable
      style={[
        styles.button,
        buttonAnim,
        outlined
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border }
          : { backgroundColor: colors.text },
        style,
      ]}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text style={[styles.label, { color: outlined ? colors.text : colors.background }]}>{label}</Text>
      <Animated.View
        style={[
          styles.arrow,
          arrowAnim,
          { backgroundColor: outlined ? colors.text + '18' : colors.background },
        ]}
      >
        <Ionicons name="arrow-forward" size={21} color={colors.text} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingLeft: 24,
    paddingRight: 10,
    borderRadius: 18,
  },
  label: { fontSize: 19, fontWeight: '600' },
  arrow: {
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
