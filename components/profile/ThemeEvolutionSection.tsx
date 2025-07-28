import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { storageService } from '@/lib/storage';
import { AllThemeLevel, allThemes, ShareableThemeLevel } from '@/lib/theme';
import {
  getThemeDisplayName,
  getThemeRequirement,
  isThemeUnlocked,
  ThemeLevel
} from '@/lib/userProfile';
import { userService } from '@/lib/userService';
import { calculateOverallPercentile } from '@/lib/utils';
import { LiftDisplayFilters, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, TouchableOpacity } from 'react-native';

export default function ThemeEvolutionSection() {
  const { currentTheme, currentThemeLevel, themes, setThemeLevel } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [filteredProgress, setFilteredProgress] = useState<UserProgress[]>([]);
  const [liftFilters, setLiftFilters] = useState<LiftDisplayFilters>({ hiddenLiftIds: [] });
  const [shareCount, setShareCount] = useState(0);
  const [unlockedShareableThemes, setUnlockedShareableThemes] = useState<string[]>([]);
  const { play: playSelectionComplete } = useSound('selectionComplete');

  useEffect(() => {
    loadUserData();
    loadSharingData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [userProgress, liftFilters]);

  const loadUserData = async () => {
    try {
      const [userProgressData, savedFilters] = await Promise.all([
        userService.getAllFeaturedLifts(),
        storageService.getLiftDisplayFilters()
      ]);
      setUserProgress(userProgressData);
      setLiftFilters(savedFilters);
    } catch (error) {
      console.error('Error loading theme evolution data:', error);
    }
  };

  const loadSharingData = async () => {
    try {
      const [count, unlocked] = await Promise.all([
        storageService.getShareCount(),
        storageService.getUnlockedShareableThemes()
      ]);
      setShareCount(count);
      setUnlockedShareableThemes(unlocked);
    } catch (error) {
      console.error('Error loading sharing data:', error);
    }
  };

  const applyFilters = () => {
    const filtered = userProgress.filter(progress => 
      !liftFilters.hiddenLiftIds.includes(progress.workoutId)
    );
    setFilteredProgress(filtered);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleThemeSelect = async (level: AllThemeLevel) => {
    playHapticFeedback('medium', false);
    playSelectionComplete();
    
    const theme = allThemes[level];
    if (theme.unlockType === 'fitness' && isThemeAvailable(level as ThemeLevel)) {
      setThemeLevel(level as ThemeLevel);
    } else if (theme.unlockType === 'share' && isShareableThemeAvailable(level as ShareableThemeLevel)) {
      setThemeLevel(level as ThemeLevel); // Cast for now, will need to update context
    }
  };

  const handleShareApp = async () => {
    try {
      const result = await Share.share({
        message: '🔥 Track your lifts with Morf! \n\nhttps://apps.apple.com/us/app/morf-your-ai-workout-tracker/id6747366819?platform=iphone 💪',
        title: 'Morf - Transform Your Strength',
      });

      if (result.action === Share.sharedAction) {
        const newCount = await storageService.incrementShareCount();
        await loadSharingData(); // Refresh to show newly unlocked themes
        
        Alert.alert(
          'Thanks for sharing! 🚀',
          `You've shared ${newCount} time${newCount === 1 ? '' : 's'}. Keep sharing to unlock more themes!`,
          [{ text: 'Awesome!', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };

  const isThemeAvailable = (level: ThemeLevel) => {
    const percentiles = filteredProgress.map(p => p.percentileRanking);
    const calculatedPercentile = percentiles.length > 0 ? calculateOverallPercentile(percentiles) : 0;
    return isThemeUnlocked(level, calculatedPercentile);
  };

  const isShareableThemeAvailable = (level: ShareableThemeLevel) => {
    return unlockedShareableThemes.includes(level);
  };

  const isCurrentTheme = (level: AllThemeLevel) => {
    return level === currentThemeLevel;
  };

  const getShareRequirement = (level: ShareableThemeLevel): string => {
    const requirements = {
      neon: '1 share',
      retro: '3 shares', 
      cosmic: '5 shares',
      forest: '8 shares',
      ocean: '12 shares',
    };
    return `Requires ${requirements[level]}`;
  };

  const fitnessThemeEntries = Object.entries(themes) as [ThemeLevel, typeof themes[ThemeLevel]][];
  const shareableThemeEntries = Object.entries(allThemes).filter(([key, theme]) => theme.unlockType === 'share') as [ShareableThemeLevel, typeof allThemes[ShareableThemeLevel]][];

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
              {allThemes[currentThemeLevel]?.displayName || getThemeDisplayName(currentThemeLevel)}
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
              Unlock themes through fitness progress or sharing
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
        <View style={styles.themeContent}>
          {/* Fitness-Based Themes */}
          <View style={styles.themeSection}>
            <Text style={[
              styles.themeSectionTitle,
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              Fitness Progress Themes
            </Text>
            <View style={styles.themeGrid}>
              {fitnessThemeEntries.map(([themeKey, theme]) => (
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
                        {theme.displayName}
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
          </View>

          {/* Shareable Themes */}
          <View style={styles.themeSection}>
            <View style={styles.shareableSectionHeader}>
              <Text style={[
                styles.themeSectionTitle,
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                Social Themes
              </Text>
              <TouchableOpacity 
                onPress={handleShareApp}
                style={[styles.shareButton, { borderColor: currentTheme.colors.primary }]}
              >
                <Ionicons name="share-outline" size={16} color={currentTheme.colors.primary} />
                <Text style={[
                  styles.shareButtonText,
                  { 
                    color: currentTheme.colors.primary,
                    fontFamily: 'Raleway_500Medium',
                  }
                ]}>
                  Share ({shareCount})
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.themeGrid}>
              {shareableThemeEntries.map(([themeKey, theme]) => (
                <TouchableOpacity
                  key={themeKey}
                  onPress={() => handleThemeSelect(themeKey)}
                  disabled={!isShareableThemeAvailable(themeKey)}
                  activeOpacity={0.7}
                >
                  <Card 
                    variant={isCurrentTheme(themeKey) ? "elevated" : "clean"} 
                    padding={20}
                    style={StyleSheet.flatten([
                      styles.themeCard,
                      !isShareableThemeAvailable(themeKey) && styles.lockedTheme,
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
                          color: isShareableThemeAvailable(themeKey) ? currentTheme.colors.text : currentTheme.colors.text + '40',
                          fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
                        }
                      ]}>
                        {theme.displayName}
                      </Text>
                      <Text style={[
                        styles.themeRequirement, 
                        { 
                          color: isShareableThemeAvailable(themeKey) ? currentTheme.colors.text : currentTheme.colors.text + '30',
                          fontFamily: 'Raleway_400Regular',
                        }
                      ]}>
                        {getShareRequirement(themeKey)}
                      </Text>
                    </View>
                    
                    <View style={[styles.themeRight, { backgroundColor: 'transparent' }]}>
                      {isShareableThemeAvailable(themeKey) && (
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
                        {!isShareableThemeAvailable(themeKey) && (
                          <Text style={[
                            styles.statusText, 
                            { 
                              color: currentTheme.colors.text + '60',
                              fontFamily: 'Raleway_500Medium',
                            }
                          ]}>
                            🔒 Share to unlock
                          </Text>
                        )}
                        {isShareableThemeAvailable(themeKey) && !isCurrentTheme(themeKey) && (
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
          </View>
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
  themeContent: {
    paddingTop: 16,
  },
  themeSection: {
    marginBottom: 20,
  },
  themeSectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  shareableSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  shareButtonText: {
    marginLeft: 8,
  },
}); 