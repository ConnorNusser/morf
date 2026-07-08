import Card from '@/components/Card';
import { useAlert } from '@/components/CustomAlert';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { space } from '@/lib/ui/tokens';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as StoreReview from 'expo-store-review';
import { ChevronDown, ChevronUp, Mail, Star } from 'lucide-react-native';
import React, { useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';

export default function AppInfoSection() {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { showAlert } = useAlert();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleRateApp = async () => {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      
      if (isAvailable) {
        await StoreReview.requestReview();
      } else {
        const appStoreUrl = Platform.select({
          ios: 'https://apps.apple.com/us/app/morf-your-ai-workout-tracker/id6747366819?platform=iphone',
          android: 'https://play.google.com/store/apps/details?id=com.vanquil.morfai',
        });
        
        if (appStoreUrl) {
          await Linking.openURL(appStoreUrl);
        }
      }
    } catch (error) {
      console.error('Error opening app store:', error);
      showAlert({
        title: 'Unable to Open Store',
        message: 'Please visit the App Store or Google Play to rate our app.',
        type: 'info',
      });
    }
  };

  const handleContactSupport = async () => {
    const showFallback = () => showAlert({
      title: 'Contact Support',
      message: 'Please email us at:',
      type: 'info',
      copyableText: 'connornusser@gmail.com',
    });

    try {
      const subject = encodeURIComponent('Morf App Support Request');
      const body = encodeURIComponent(
        `Hi Morf Support Team,\n\n` +
        `I need help with:\n\n` +
        `Device: ${Platform.OS === 'ios' ? 'iOS' : 'Android'}\n` +
        `App Version: ${Constants.expoConfig?.version}\n\n` +
        `Please describe your issue below:\n\n`
      );

      const emailUrl = `mailto:connornusser@gmail.com?subject=${subject}&body=${body}`;

      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        showFallback();
      }
    } catch (error) {
      console.error('Error opening email:', error);
      showFallback();
    }
  };

  const appVersion = Constants.expoConfig?.version;

  return (
    <Card style={styles.appInfoCard}>
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderContent}>
          <Text variant="title" weight="bold" tone="primary">
            App Info
          </Text>
          {!isExpanded && appVersion && (
            <Text variant="meta" tone="secondary" style={styles.versionSubtitle}>
              Version {appVersion}
            </Text>
          )}
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color={ink.primary} />
        ) : (
          <ChevronDown size={20} color={ink.primary} />
        )}
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.appInfoContent}>
          {appVersion && (
            <View style={styles.infoRow}>
              <Text variant="body" weight="medium" tone="primary">
                Version
              </Text>
              <Text variant="body" tone="secondary">
                {appVersion}
              </Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleRateApp}
              activeOpacity={0.6}
            >
              <Star size={18} color={currentTheme.colors.primary} />
              <Text variant="body" weight="medium" tone="primary">
                Rate App
              </Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: currentTheme.colors.border }]} />

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleContactSupport}
              activeOpacity={0.6}
            >
              <Mail size={18} color={ink.secondary} />
              <Text variant="body" weight="medium" tone="primary">
                Support
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  appInfoCard: {
    gap: space.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  versionSubtitle: {
    marginTop: space.xs,
  },
  appInfoContent: {
    paddingTop: space.xl,
    gap: space.xl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    gap: space.sm,
  },
  separator: {
    width: 1,
    height: 20,
    opacity: 0.3,
  },
});