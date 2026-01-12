import { useTheme } from '@/contexts/ThemeContext';
import { themes, ThemeLevel } from '@/lib/ui/theme';
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type NotificationType = 'christmas_theme';

interface UnlockNotificationModalProps {
  visible: boolean;
  notificationType: NotificationType | null;
  onDismiss: () => void;
  onActivate?: () => void;
}

// Content configuration for each notification type
const NOTIFICATION_CONTENT: Record<NotificationType, {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  themePreview?: ThemeLevel;
  activateText: string;
  dismissText: string;
}> = {
  christmas_theme: {
    icon: '🎄',
    title: 'New Theme Unlocked!',
    subtitle: 'Christmas 2025',
    description: 'Celebrate the season with festive red, green, and gold',
    themePreview: 'christmas_theme_2025',
    activateText: 'Try it now',
    dismissText: 'Maybe later',
  },
};

export default function UnlockNotificationModal({
  visible,
  notificationType,
  onDismiss,
  onActivate,
}: UnlockNotificationModalProps) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible || !notificationType) return null;

  const content = NOTIFICATION_CONTENT[notificationType];
  const previewTheme = content.themePreview ? themes[content.themePreview] : null;

  const handleActivate = () => {
    onActivate?.();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={styles.overlay}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              entering={FadeIn.delay(100).duration(400)}
              style={[
                styles.card,
                {
                  backgroundColor: currentTheme.colors.surface,
                  borderRadius: currentTheme.borderRadius,
                },
              ]}
            >
              {/* Icon */}
              <Text style={styles.icon}>{content.icon}</Text>

              {/* Title */}
              <Text
                style={[
                  styles.title,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: currentTheme.fonts.bold,
                  },
                ]}
              >
                {content.title}
              </Text>

              {/* Subtitle */}
              <Text
                style={[
                  styles.subtitle,
                  {
                    color: currentTheme.colors.primary,
                    fontFamily: currentTheme.fonts.semiBold,
                  },
                ]}
              >
                {content.subtitle}
              </Text>

              {/* Theme preview */}
              {previewTheme && (
                <View style={styles.previewContainer}>
                  <View style={styles.colorRow}>
                    <View
                      style={[
                        styles.colorDot,
                        styles.colorDotLarge,
                        { backgroundColor: previewTheme.colors.primary },
                      ]}
                    />
                    <View
                      style={[
                        styles.colorDot,
                        styles.colorDotLarge,
                        { backgroundColor: previewTheme.colors.background },
                        { borderColor: previewTheme.colors.border, borderWidth: 1 },
                      ]}
                    />
                    <View
                      style={[
                        styles.colorDot,
                        styles.colorDotLarge,
                        { backgroundColor: previewTheme.colors.accent },
                      ]}
                    />
                    <View
                      style={[
                        styles.colorDot,
                        styles.colorDotLarge,
                        { backgroundColor: previewTheme.colors.secondary },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Description */}
              <Text
                style={[
                  styles.description,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: currentTheme.fonts.regular,
                    opacity: 0.7,
                  },
                ]}
              >
                {content.description}
              </Text>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    {
                      backgroundColor: currentTheme.colors.primary,
                      borderRadius: currentTheme.borderRadius / 2,
                    },
                  ]}
                  onPress={handleActivate}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.primaryButtonText,
                      { fontFamily: currentTheme.fonts.semiBold },
                    ]}
                  >
                    {content.activateText}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.secondaryButton,
                    {
                      borderColor: currentTheme.colors.border,
                      borderRadius: currentTheme.borderRadius / 2,
                    },
                  ]}
                  onPress={onDismiss}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: currentTheme.colors.text,
                        fontFamily: currentTheme.fonts.medium,
                        opacity: 0.7,
                      },
                    ]}
                  >
                    {content.dismissText}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>

          {/* Dismiss hint */}
          <Text
            style={[
              styles.hint,
              {
                fontFamily: currentTheme.fonts.regular,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            tap outside to dismiss
          </Text>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    padding: 28,
    alignItems: 'center',
  },
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  previewContainer: {
    marginVertical: 16,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  colorDotLarge: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  primaryButton: {},
  secondaryButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  hint: {
    position: 'absolute',
    bottom: 0,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.3)',
  },
});
