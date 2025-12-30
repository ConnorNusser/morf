import { useTheme } from '@/contexts/ThemeContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { TutorialTarget } from '@/components/tutorial';
import { getStepsByIndex } from '@/components/tutorial/tutorialSteps';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ViewMode = 'home' | 'feed';

interface DashboardHeaderProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export default function DashboardHeader({ viewMode, onViewModeChange }: DashboardHeaderProps) {
  const { currentTheme } = useTheme();
  const { showTutorial, currentStep } = useTutorial();
  const [showDropdown, setShowDropdown] = useState(false);

  // Auto-open dropdown during the feed tutorial step
  useEffect(() => {
    if (showTutorial) {
      const currentStepData = getStepsByIndex(currentStep);
      if (currentStepData?.targetId === 'home-view-selector') {
        // Delay to let the spotlight position first
        const timer = setTimeout(() => setShowDropdown(true), 400);
        return () => clearTimeout(timer);
      } else {
        setShowDropdown(false);
      }
    }
  }, [showTutorial, currentStep]);

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
              source={require('@/assets/images/icon-original.png')}
              style={styles.logo}
            />
            <TutorialTarget id="home-view-selector">
              <TouchableOpacity
                style={[styles.viewSelector, { backgroundColor: currentTheme.colors.surface }]}
                onPress={() => !showTutorial && setShowDropdown(!showDropdown)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.appName,
                  {
                    color: currentTheme.colors.text,
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
            </TutorialTarget>
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
                    <Text style={[styles.dropdownText, { color: viewMode === 'home' ? currentTheme.colors.primary : currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
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
                    <Text style={[styles.dropdownText, { color: viewMode === 'feed' ? currentTheme.colors.primary : currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
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
    marginTop: 2,
  },
}); 