import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BrowseSectionProps {
  onBrowseRoutines: () => void;
  onBrowseWorkouts: () => void;
}

export default function BrowseSection({ onBrowseRoutines, onBrowseWorkouts }: BrowseSectionProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { 
        color: currentTheme.colors.text,
        fontFamily: 'Raleway_700Bold',
      }]}>
        Browse & Import
      </Text>
      
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          onPress={onBrowseRoutines}
          style={[styles.browseButton, { 
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }]}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: currentTheme.colors.primary + '20' }]}>
            <Ionicons name="library-outline" size={24} color={currentTheme.colors.primary} />
          </View>
          <View style={styles.buttonContent}>
            <Text style={[styles.buttonTitle, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Browse Routines
            </Text>
            <Text style={[styles.buttonDescription, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_400Regular',
              opacity: 0.7,
            }]}>
              View and import existing routines
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.colors.text} style={{ opacity: 0.4 }} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBrowseWorkouts}
          style={[styles.browseButton, { 
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }]}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: currentTheme.colors.primary + '20' }]}>
            <Ionicons name="fitness-outline" size={24} color={currentTheme.colors.primary} />
          </View>
          <View style={styles.buttonContent}>
            <Text style={[styles.buttonTitle, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Browse Workouts
            </Text>
            <Text style={[styles.buttonDescription, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_400Regular',
              opacity: 0.7,
            }]}>
              View, edit, and import workouts
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.colors.text} style={{ opacity: 0.4 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  buttonsContainer: {
    gap: 12,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flex: 1,
    gap: 2,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDescription: {
    fontSize: 13,
    lineHeight: 16,
  },
}); 