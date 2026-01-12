import * as Haptics from 'expo-haptics';

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'notification' | 'warning' | 'error' | 'success' | 'none';

const playHapticFeedback = async (hapticType: HapticType, disabled: boolean) => {
    if (hapticType === 'none' || disabled) return;

    try {
      switch (hapticType) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'selection':
          await Haptics.selectionAsync();
          break;
        case 'notification':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  };

export default playHapticFeedback;