import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { Alert, Animated, Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DashboardHeaderProps {
  onLogoPress?: () => void;
}

export default function DashboardHeader({ onLogoPress }: DashboardHeaderProps) {
  const { currentTheme } = useTheme();
  const scaleAnim = new Animated.Value(1);

  const handleShareApp = async () => {
    try {
      const result = await Share.share({
        message: '🔥 Transform your strength with Morf! \n\nTrack your lifts, unlock percentile rankings, and morph into your strongest self. \n\nDownload now and start your transformation! 💪',
        title: 'Morf - Transform Your Strength',
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared via activity type
          console.log('Shared via:', result.activityType);
        } else {
          // Shared
          console.log('App shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
        console.log('Share dismissed');
      }
    } catch (error) {
      console.error('Error sharing app:', error);
      Alert.alert(
        'Share Error',
        'Unable to share the app right now. Please try again later.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const handlePress = () => {
    // Create a subtle bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Handle sharing or custom action
    if (onLogoPress) {
      onLogoPress();
    } else {
      handleShareApp();
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>
      
      <View style={styles.textContainer}>
        <Text style={[
          styles.appName, 
          { 
            color: currentTheme.colors.text,
            fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_700Bold',
          }
        ]}>
          Morf
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  textContainer: {
    flex: 1,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
}); 