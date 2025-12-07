import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/haptic';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertConfig {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  copyableText?: string; // Text that can be copied to clipboard
}

interface AlertContextType {
  showAlert: (config: AlertConfig) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

const alertIconConfig: Record<AlertType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { icon: 'checkmark-circle', color: '#22C55E' },
  error: { icon: 'alert-circle', color: '#EF4444' },
  warning: { icon: 'warning', color: '#F59E0B' },
  info: { icon: 'information-circle', color: '#3B82F6' },
  confirm: { icon: 'help-circle', color: '#8B5CF6' },
};

function AlertContent({
  config,
  onDismiss,
}: {
  config: AlertConfig;
  onDismiss: () => void;
}) {
  const { currentTheme } = useTheme();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    scale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.back(1.1)) });
    opacity.value = withTiming(1, { duration: 150 });
  }, [scale, opacity]);

  const type = config.type || 'info';
  const { icon, color } = alertIconConfig[type];
  const buttons = config.buttons || [{ text: 'OK', style: 'default' as const }];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleButtonPress = (button: AlertButton) => {
    playHapticFeedback('light', false);
    button.onPress?.();
    onDismiss();
  };

  const handleCopy = async () => {
    if (config.copyableText) {
      await Clipboard.setStringAsync(config.copyableText);
      setCopied(true);
      playHapticFeedback('success', false);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Animated.View
      style={[
        styles.alertBox,
        { backgroundColor: currentTheme.colors.surface },
        animatedStyle,
      ]}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={36} color={color} />
      </View>

      {/* Title */}
      <Text
        style={[
          styles.title,
          { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' },
        ]}
      >
        {config.title}
      </Text>

      {/* Message */}
      {config.message && (
        <Text
          style={[
            styles.message,
            { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' },
          ]}
        >
          {config.message}
        </Text>
      )}

      {/* Copy button if copyableText is provided */}
      {config.copyableText && (
        <TouchableOpacity
          style={[styles.copyButton, { backgroundColor: currentTheme.colors.border + '30' }]}
          onPress={handleCopy}
          activeOpacity={0.7}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={16}
            color={copied ? '#22C55E' : currentTheme.colors.text + '70'}
          />
          <Text style={[styles.copyButtonText, { color: copied ? '#22C55E' : currentTheme.colors.text + '70', fontFamily: 'Raleway_500Medium' }]}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {buttons.map((button, index) => {
          const isDestructive = button.style === 'destructive';
          const isCancel = button.style === 'cancel';
          const isPrimary = !isDestructive && !isCancel && buttons.length > 1 && index === buttons.length - 1;

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.button,
                buttons.length === 1 && styles.singleButton,
                isCancel && { backgroundColor: currentTheme.colors.border + '50' },
                isDestructive && { backgroundColor: '#EF4444' },
                isPrimary && { backgroundColor: currentTheme.colors.primary },
                !isCancel && !isDestructive && !isPrimary && buttons.length === 1 && { backgroundColor: currentTheme.colors.primary },
              ]}
              onPress={() => handleButtonPress(button)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.buttonText,
                  { fontFamily: 'Raleway_600SemiBold' },
                  isCancel && { color: currentTheme.colors.text },
                  (isDestructive || isPrimary || buttons.length === 1) && { color: '#fff' },
                ]}
              >
                {button.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const { currentTheme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);

  const showAlert = useCallback((config: AlertConfig) => {
    // Determine haptic based on type
    const hapticType = config.type === 'error' ? 'error' :
                       config.type === 'success' ? 'success' :
                       config.type === 'warning' ? 'warning' : 'light';
    playHapticFeedback(hapticType, false);

    setAlertConfig(config);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
    setTimeout(() => setAlertConfig(null), 200);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={hideAlert}
        statusBarTranslucent
      >
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={styles.overlay}
        >
          <BlurView intensity={20} tint={currentTheme.colors.background.toLowerCase().startsWith('#0') || currentTheme.colors.background.toLowerCase().startsWith('#1') ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Pressable style={styles.backdrop} onPress={hideAlert} />
          {alertConfig && (
            <AlertContent config={alertConfig} onDismiss={hideAlert} />
          )}
        </Animated.View>
      </Modal>
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  alertBox: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  copyButtonText: {
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  singleButton: {
    flex: 0,
    minWidth: 120,
    alignSelf: 'center',
  },
  buttonText: {
    fontSize: 16,
  },
});
