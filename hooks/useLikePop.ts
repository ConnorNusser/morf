import { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';

// Like-button "pop" animation: returns the heart's animated style and pop().
export function useLikePop() {
  const likeScale = useSharedValue(1);
  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));
  const pop = () => {
    likeScale.value = withSequence(
      withTiming(1.3, { duration: 100 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
  };
  return { likeAnimatedStyle, pop };
}
