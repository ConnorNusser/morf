import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ViewMode = 'home' | 'feed';

interface DashboardHeaderProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export default function DashboardHeader({ viewMode, onViewModeChange }: DashboardHeaderProps) {
  const { currentTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleViewSelect = (mode: ViewMode) => {
    setShowDropdown(false);
    onViewModeChange?.(mode);
  };

  // If no view mode props, show original Morf text
  const showViewSelector = viewMode !== undefined && onViewModeChange !== undefined;

  return (
    <View style={styles.container}>
      {showViewSelector ? (
        <>
          <View style={styles.headerRow}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
            />
            <TouchableOpacity
              style={[styles.viewSelector, { backgroundColor: currentTheme.colors.surface }]}
              onPress={() => setShowDropdown(!showDropdown)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.appName,
                {
                  color: currentTheme.colors.text,
                  fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_700Bold',
                }
              ]}>
                {viewMode === 'home' ? 'Morf' : 'Feed'}
              </Text>
              <Ionicons
                name={showDropdown ? 'chevron-up' : 'chevron-down'}
                size={24}
                color={currentTheme.colors.text}
              />
            </TouchableOpacity>
          </View>

          {showDropdown && (
            <>
              {/* Backdrop to close dropdown */}
              <TouchableOpacity
                style={styles.backdrop}
                onPress={() => setShowDropdown(false)}
                activeOpacity={1}
              />
              <View style={[styles.dropdown, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                <TouchableOpacity
                  style={[styles.dropdownItem, viewMode === 'home' && { backgroundColor: currentTheme.colors.primary + '15' }]}
                  onPress={() => handleViewSelect('home')}
                >
                  <Ionicons name="home" size={18} color={viewMode === 'home' ? currentTheme.colors.primary : currentTheme.colors.text + '80'} />
                  <View style={styles.dropdownTextContainer}>
                    <Text style={[styles.dropdownText, { color: viewMode === 'home' ? currentTheme.colors.primary : currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      Morf
                    </Text>
                    <Text style={[styles.dropdownSubtext, { color: currentTheme.colors.text + '50' }]}>
                      Your stats
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdownItem, viewMode === 'feed' && { backgroundColor: currentTheme.colors.primary + '15' }]}
                  onPress={() => handleViewSelect('feed')}
                >
                  <Ionicons name="people" size={18} color={viewMode === 'feed' ? currentTheme.colors.primary : currentTheme.colors.text + '80'} />
                  <View style={styles.dropdownTextContainer}>
                    <Text style={[styles.dropdownText, { color: viewMode === 'feed' ? currentTheme.colors.primary : currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      Feed
                    </Text>
                    <Text style={[styles.dropdownSubtext, { color: currentTheme.colors.text + '50' }]}>
                      Community workouts
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      ) : (
        <Text style={[
          styles.appName,
          {
            color: currentTheme.colors.text,
            fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_700Bold',
          }
        ]}>
          Morf
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    zIndex: 1000,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  viewSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 12,
  },
  backdrop: {
    position: 'absolute',
    top: -100,
    left: -100,
    right: -100,
    bottom: -1000,
    zIndex: 999,
  },
  dropdown: {
    position: 'absolute',
    top: 64,
    left: 56,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 200,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownText: {
    fontSize: 16,
  },
  dropdownSubtext: {
    fontSize: 12,
    fontFamily: 'Raleway_400Regular',
    marginTop: 2,
  },
}); 