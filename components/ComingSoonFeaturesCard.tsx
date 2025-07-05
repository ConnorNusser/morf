import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ComingSoonFeaturesCardProps {
  userPercentile: number;
  onPress: () => void;
}

export default function ComingSoonFeaturesCard({ userPercentile, onPress }: ComingSoonFeaturesCardProps) {
  const { currentTheme } = useTheme();
  const progress = Math.min(userPercentile, 75);
  const progressPercentage = (progress / 75) * 100;
  const isDisabled = true; // Always disabled for coming soon
  
  let imageBackground = require('@/assets/images/image-light.png');
  if (currentTheme.name === 'elite' || currentTheme.name === 'god') {
    imageBackground = require('@/assets/images/image.png');
  }

  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.7} 
      style={[styles.container, styles.disabledContainer]}
      disabled={isDisabled}
    >
      <ImageBackground
        source={imageBackground}
        style={styles.imageBackground}
        imageStyle={styles.backgroundImage}
      >
        {/* Overlay for readability - darker when disabled */}
        <View style={[
          styles.overlay,
          { backgroundColor: 'rgba(0, 0, 0, 0.75)' }
        ]} />
        
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleSection}>
              <Text style={[
                styles.title, 
                { 
                  color: '#FFFFFF',
                  fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
                }
              ]}>
                Advanced Analytics
              </Text>
              <Text style={[
                styles.subtitle, 
                { 
                  color: '#F0F0F0',
                  fontFamily: 'Raleway_400Regular',
                }
              ]}>
                Feature in development
              </Text>
            </View>
            
            <View style={[
              styles.statusBadge,
              { 
                backgroundColor: 'rgba(156, 163, 175, 0.9)', // Gray color for disabled state
              }
            ]}>
              <Ionicons 
                name="time-outline" 
                size={14} 
                color="white" 
              />
              <Text style={[
                styles.statusText,
                { 
                  color: 'white',
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Available in v1.1.0
              </Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <View style={[
                  styles.progressFill,
                  { 
                    width: `${progressPercentage}%`,
                    backgroundColor: currentTheme.colors.primary,
                    opacity: 0.7, // Slightly muted for disabled state
                  }
                ]} />
              </View>
              <Text style={[
                styles.progressText,
                { 
                  color: 'rgba(224, 224, 224, 0.8)', // Slightly muted
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                {userPercentile}th / 75th percentile (unlock requirement)
              </Text>
            </View>
          </View>

          <View style={styles.actionSection}>
            <View style={styles.disabledActionButton}>
              <Ionicons 
                name="information-circle-outline" 
                size={16} 
                color="rgba(255, 255, 255, 0.7)" 
              />
              <Text style={[
                styles.actionText,
                { 
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Coming Soon
              </Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  disabledContainer: {
    opacity: 0.8,
  },
  imageBackground: {
    minHeight: 140,
    justifyContent: 'center',
  },
  backgroundImage: {
    borderRadius: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  content: {
    padding: 20,
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleSection: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.9,
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressContainer: {
    gap: 8,
  },
  progressBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    opacity: 0.9,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  actionSection: {
    alignItems: 'center',
  },
  disabledActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 