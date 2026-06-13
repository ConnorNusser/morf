import { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';

/**
 * Like-button "pop" animation shared by the feed comment/thread modals.
 * Returns the animated style for the heart and a `pop()` to trigger the bounce.
 */
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
