import React, { useRef } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { captureAndShare } from '@/lib/shareUtils';
import { Ionicons } from '@expo/vector-icons';

interface RecapCardProps {
  title: string;
  icon: string;
  mainValue: string | number;
  subtitle?: string;
  funFact?: string;
  gradient?: string[];
  year: number;
  children?: React.ReactNode;
}

export default function RecapCard({
  title,
  icon,
  mainValue,
  subtitle,
  funFact,
  gradient,
  year,
  children,
}: RecapCardProps) {
  const { currentTheme } = useTheme();
  const viewShotRef = useRef<ViewShot>(null);

  const defaultGradient = [
    currentTheme.colors.accent + '20',
    currentTheme.colors.primary + '10',
  ];

  const handleShare = async () => {
    if (viewShotRef.current) {
      await captureAndShare(viewShotRef as React.RefObject<ViewShot>);
    }
  };

  return (
    <View style={[styles.cardContainer, { backgroundColor: 'transparent' }]}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'png', quality: 1 }}
        style={styles.viewShot}
      >
        <LinearGradient
          colors={gradient || defaultGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor: currentTheme.colors.border }]}
        >
          {/* Header */}
          <RNView style={styles.header}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={[styles.title, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              {title}
            </Text>
          </RNView>

          {/* Main Value */}
          <RNView style={styles.mainContent}>
            <Text style={[styles.mainValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
              {mainValue}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_500Medium' }]}>
                {subtitle}
              </Text>
            )}
          </RNView>

          {/* Custom children content */}
          {children}

          {/* Fun Fact */}
          {funFact && (
            <RNView style={[styles.funFactContainer, { backgroundColor: currentTheme.colors.background + '60' }]}>
              <Text style={[styles.funFact, { color: currentTheme.colors.text + 'CC', fontFamily: 'Raleway_500Medium' }]}>
                {funFact}
              </Text>
            </RNView>
          )}

          {/* Branding Footer */}
          <RNView style={styles.brandingFooter}>
            <Text style={[styles.brandingText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
              {year} Recap
            </Text>
          </RNView>
        </LinearGradient>
      </ViewShot>

      {/* Share Button - Outside the captured area */}
      <TouchableOpacity
        style={[styles.shareButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
        onPress={handleShare}
        activeOpacity={0.7}
      >
        <Ionicons name="share-outline" size={18} color={currentTheme.colors.text} />
        <Text style={[styles.shareButtonText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
          Share
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 20,
  },
  viewShot: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    minHeight: 200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mainContent: {
    alignItems: 'center',
    marginVertical: 20,
  },
  mainValue: {
    fontSize: 56,
    lineHeight: 64,
  },
  subtitle: {
    fontSize: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  funFactContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  funFact: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  brandingFooter: {
    marginTop: 20,
    alignItems: 'center',
  },
  brandingText: {
    fontSize: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'center',
    marginTop: 12,
    borderWidth: 1,
  },
  shareButtonText: {
    fontSize: 14,
  },
});
