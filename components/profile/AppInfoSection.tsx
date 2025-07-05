import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import * as StoreReview from 'expo-store-review';
import { ChevronDown, ChevronUp, Mail, Star } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity } from 'react-native';

export default function AppInfoSection() {
  const { currentTheme } = useTheme();
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
          ios: 'https://apps.apple.com/app/id123456789',
          android: 'https://play.google.com/store/apps/details?id=com.vanquil.morfai',
        });
        
        if (appStoreUrl) {
          await Linking.openURL(appStoreUrl);
        }
      }
    } catch (error) {
      console.error('Error opening app store:', error);
      Alert.alert(
        'Unable to Open Store',
        'Please visit the App Store or Google Play to rate our app.'
      );
    }
  };

  const handleContactSupport = async () => {
    try {
      const subject = encodeURIComponent('Morf App Support Request');
      const body = encodeURIComponent(
        `Hi Morf Support Team,\n\n` +
        `I need help with:\n\n` +
        `Device: ${Platform.OS === 'ios' ? 'iOS' : 'Android'}\n` +
        `App Version: ${Application.nativeApplicationVersion}\n` +
        `Build: ${Application.nativeBuildVersion}\n\n` +
        `Please describe your issue below:\n\n`
      );
      
      const emailUrl = `mailto:support@vanquil.com?subject=${subject}&body=${body}`;
      
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert(
          'Contact Support',
          'Please email us at: support@vanquil.com',
          [
            { text: 'Copy Email', onPress: () => {
              Alert.alert('Email Address', 'support@vanquil.com');
            }},
            { text: 'OK', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('Error opening email:', error);
      Alert.alert(
        'Contact Support',
        'Please email us at: support@vanquil.com'
      );
    }
  };

  const appVersion = Application.nativeApplicationVersion;

  return (
    <Card style={styles.appInfoCard} variant="clean">
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderContent}>
          <Text style={[
            styles.sectionTitle, 
            { 
              color: currentTheme.colors.text,
              fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
            }
          ]}>
            App Info
          </Text>
          {!isExpanded && appVersion && (
            <Text style={[
              styles.versionSubtitle, 
              { 
                color: currentTheme.colors.text + '70',
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              Version {appVersion}
            </Text>
          )}
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color={currentTheme.colors.text} />
        ) : (
          <ChevronDown size={20} color={currentTheme.colors.text} />
        )}
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.appInfoContent}>
          {/* Version Info Row */}
          {appVersion && (
            <View style={styles.infoRow}>
              <Text style={[
                styles.infoLabel,
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Version
              </Text>
              <Text style={[
                styles.infoValue,
                { 
                  color: currentTheme.colors.text + '70',
                  fontFamily: 'Raleway_400Regular',
                }
              ]}>
                {appVersion}
              </Text>
            </View>
          )}

          {/* Actions Row */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleRateApp}
              activeOpacity={0.6}
            >
              <Star size={18} color={currentTheme.colors.primary} />
              <Text style={[
                styles.actionText,
                {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Rate App
              </Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: currentTheme.colors.border }]} />

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleContactSupport}
              activeOpacity={0.6}
            >
              <Mail size={18} color={currentTheme.colors.text + '80'} />
              <Text style={[
                styles.actionText,
                {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
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
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionHeaderContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  versionSubtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  appInfoContent: {
    paddingTop: 12,
    gap: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
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
    paddingVertical: 12,
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  separator: {
    width: 1,
    height: 20,
    opacity: 0.3,
  },
}); 