import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import {
  getThemeDisplayName,
  getThemeRequirement,
  isThemeUnlocked,
  ThemeLevel
} from '@/lib/userProfile';
import { userService } from '@/lib/userService';
import { calculateOverallPercentile } from '@/lib/utils';
import { UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

export default function ThemeEvolutionSection() {
  const { currentTheme, currentThemeLevel, themes, setThemeLevel } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const { play: playSelectionComplete } = useSound('selectionComplete');
  useEffect(() => {
    const loadUserData = async () => {
      const userProgress = await userService.getUsersTopLifts();
      setUserProgress(userProgress);
    };
    loadUserData();
  }, []);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleThemeSelect = async (level: ThemeLevel) => {
    playHapticFeedback('medium', false);
    playSelectionComplete();
    if (isThemeAvailable(level)) {
      setThemeLevel(level);
    }
  };

  const isThemeAvailable = (level: ThemeLevel) => {
    const percentiles = userProgress.map(p => p.percentileRanking);
    const calculatedPercentile = percentiles.length > 0 ? calculateOverallPercentile(percentiles) : 0;
    return isThemeUnlocked(level, calculatedPercentile);
  };

  const isCurrentTheme = (level: ThemeLevel) => {
    return level === currentThemeLevel;
  };

  const themeEntries = Object.entries(themes) as [ThemeLevel, typeof themes[ThemeLevel]][];

  return (
    <Card variant="clean">
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={[styles.themeSectionHeaderContent, { backgroundColor: 'transparent' }]}>
          <Text style={[
            styles.themeEvolutionTitle, 
            { 
              color: currentTheme.colors.text,
              fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_700Bold',
            }
          ]}>
            Theme Evolution
          </Text>
          {!isExpanded && (
            <Text style={[
              styles.currentThemeText, 
              { 
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_500Medium',
                marginTop: 2,
              }
            ]}>
              {getThemeDisplayName(currentThemeLevel)}
            </Text>
          )}
          {isExpanded && (
            <Text style={[
              styles.themeEvolutionSubtitle, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              Unlock new themes as you progress
            </Text>
          )}
        </View>
        <Ionicons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={currentTheme.colors.text} 
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.themeGrid}>
          {themeEntries.map(([themeKey, theme]) => (
            <TouchableOpacity
              key={themeKey}
              onPress={() => handleThemeSelect(themeKey)}
              disabled={!isThemeAvailable(themeKey)}
              activeOpacity={0.7}
            >
              <Card 
                variant={isCurrentTheme(themeKey) ? "elevated" : "clean"} 
                padding={20}
                style={StyleSheet.flatten([
                  styles.themeCard,
                  !isThemeAvailable(themeKey) && styles.lockedTheme,
                  isCurrentTheme(themeKey) && { 
                    borderColor: currentTheme.colors.primary, 
                    borderWidth: 2 
                  }
                ])}
              >
                <View style={[styles.themeInfo, { backgroundColor: 'transparent' }]}>
                  <Text style={[
                    styles.themeName, 
                    { 
                      color: isThemeAvailable(themeKey) ? currentTheme.colors.text : currentTheme.colors.text + '40',
                      fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
                      
                    }
                  ]}>
                    {getThemeDisplayName(themeKey)}
                  </Text>
                  <Text style={[
                    styles.themeRequirement, 
                    { 
                      color: isThemeAvailable(themeKey) ? currentTheme.colors.text : currentTheme.colors.text + '30',
                      fontFamily: 'Raleway_400Regular',
                    }
                  ]}>
                    {getThemeRequirement(themeKey)}
                  </Text>
                </View>
                
                <View style={[styles.themeRight, { backgroundColor: 'transparent' }]}>
                  {isThemeAvailable(themeKey) && (
                    <View style={[styles.colorIndicators, { backgroundColor: 'transparent' }]}>
                      <View style={[
                        styles.colorDot, 
                        { backgroundColor: theme.colors.primary }
                      ]} />
                      <View style={[
                        styles.colorDot, 
                        { backgroundColor: theme.colors.background },
                        { borderColor: theme.colors.border, borderWidth: 1 }
                      ]} />
                      <View style={[
                        styles.colorDot, 
                        { backgroundColor: theme.colors.surface },
                        { borderColor: theme.colors.border, borderWidth: 1 }
                      ]} />
                    </View>
                  )}
                  
                  <View style={[styles.themeStatus, { backgroundColor: 'transparent' }]}>
                    {isCurrentTheme(themeKey) && (
                      <Text style={[
                        styles.statusText, 
                        { 
                          color: currentTheme.colors.primary,
                          fontFamily: 'Raleway_500Medium',
                        }
                      ]}>
                        ✓ Current Theme
                      </Text>
                    )}
                    {!isThemeAvailable(themeKey) && (
                      <Text style={[
                        styles.statusText, 
                        { 
                          color: currentTheme.colors.text + '60',
                          fontFamily: 'Raleway_500Medium',
                        }
                      ]}>
                        🔒 Locked
                      </Text>
                    )}
                    {isThemeAvailable(themeKey) && !isCurrentTheme(themeKey) && (
                      <Text style={[
                        styles.statusText, 
                        { 
                          color: currentTheme.colors.text + '80',
                          fontFamily: 'Raleway_500Medium',
                        }
                      ]}>
                        Tap to activate
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  themeSectionHeaderContent: {
    flex: 1,
  },
  themeEvolutionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  themeEvolutionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 20,
  },
  currentThemeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  themeGrid: {
    gap: 12,
    paddingTop: 16,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lockedTheme: {
    opacity: 0.6,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  themeRequirement: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  themeRight: {
    alignItems: 'flex-end',
    gap: 12,
    marginLeft: 16,
  },
  colorIndicators: {
    flexDirection: 'row',
    gap: 8,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  themeStatus: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 