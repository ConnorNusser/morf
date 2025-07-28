import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { storageService } from '@/lib/storage';
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
import { Share, StyleSheet, TouchableOpacity } from 'react-native';

export default function ThemeEvolutionSection() {
  const { currentTheme, currentThemeLevel, themes, setThemeLevel } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [filteredProgress, setFilteredProgress] = useState<UserProgress[]>([]);
  const [liftFilters, setLiftFilters] = useState<LiftDisplayFilters>({ hiddenLiftIds: [] });
  const [shareCount, setShareCount] = useState(0); // Track share count instead of boolean
  const { play: playSelectionComplete } = useSound('selectionComplete');

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [userProgress, liftFilters]);

  const loadUserData = async () => {
    try {
      const [userProgressData, savedFilters, shareCountData] = await Promise.all([
        userService.getAllFeaturedLifts(),
        storageService.getLiftDisplayFilters(),
        storageService.getShareCount()
      ]);
      setUserProgress(userProgressData);
      setLiftFilters(savedFilters);
      setShareCount(shareCountData);
    } catch (error) {
      console.error('Error loading theme evolution data:', error);
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

  const handleThemeSelect = async (level: ThemeLevel) => {
    playHapticFeedback('medium', false);
    playSelectionComplete();
    if (isThemeAvailable(level)) {
      setThemeLevel(level);
    }
  };

  const isThemeAvailable = (level: ThemeLevel) => {
    const percentiles = filteredProgress.map(p => p.percentileRanking);
    const calculatedPercentile = percentiles.length > 0 ? calculateOverallPercentile(percentiles) : 0;
    return isThemeUnlocked(level, calculatedPercentile, shareCount);
  };

  const isCurrentTheme = (level: ThemeLevel) => {
    return level === currentThemeLevel;
  };

  const themeEntries = Object.entries(themes) as [ThemeLevel, typeof themes[ThemeLevel]][];

  const handleShareApp = async () => {
    try {
      const result = await Share.share({
        message: 'Im sharing this app to get some free themes but also its a sick workout app! \n\nhttps://apps.apple.com/us/app/morf-your-ai-workout-tracker/id6747366819?platform=iphone 💪',
        title: 'Morf - Transform Your Strength',
      });
      
      // If user shared successfully, increment count
      if (result.action === Share.sharedAction) {
        const newCount = await storageService.incrementShareCount();
        setShareCount(newCount);
        playSelectionComplete();
        playHapticFeedback('medium', false);
      }
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };

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
        <View>
          {/* Fitness Themes Section */}
          <View style={styles.sectionContainer}>
            <Text style={[
              styles.subsectionTitle,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              Fitness Progression Themes
            </Text>
            <Text style={[
              styles.subsectionDescription,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
                opacity: 0.7,
              }
            ]}>
              Unlock themes based on your strength percentile
            </Text>
            <View style={styles.themeGrid}>
              {themeEntries
                .filter(([themeKey]) => !themeKey.startsWith('share_'))
                .map(([themeKey, theme]) => (
                <TouchableOpacity
                  key={themeKey}
                  onPress={() => handleThemeSelect(themeKey)}
                  disabled={!isThemeAvailable(themeKey)}
                  activeOpacity={0.7}
                >
                  <Card 
                    variant={isCurrentTheme(themeKey) ? "elevated" : "clean"} 
                    padding={12}
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
          </View>

          {/* Shareable Themes Section */}
          <View style={[
            styles.sectionContainer, 
            styles.shareableSection,
            { borderTopColor: currentTheme.colors.border }
          ]}>
            <View style={styles.shareableHeader}>
              <View>
                <Text style={[
                  styles.subsectionTitle,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_600SemiBold',
                  }
                ]}>
                  Special Themes
                </Text>
                <Text style={[
                  styles.subsectionDescription,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                    opacity: 0.7,
                  }
                ]}>
                  {shareCount}/3 shares • {shareCount >= 3 ? 'All unlocked' : shareCount >= 1 ? 'Next at 3 shares' : 'Next at 1 share'}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.shareButtonCompact,
                  { 
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border
                  }
                ]}
                onPress={handleShareApp}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={16} color={currentTheme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Shareable Theme Grid */}
            <View style={styles.themeGrid}>
              {themeEntries
                .filter(([themeKey]) => themeKey.startsWith('share_'))
                .map(([themeKey, theme]) => (
                <TouchableOpacity
                  key={themeKey}
                  onPress={() => handleThemeSelect(themeKey)}
                  disabled={!isThemeAvailable(themeKey)}
                  activeOpacity={0.7}
                >
                  <Card 
                    variant={isCurrentTheme(themeKey) ? "elevated" : "clean"} 
                    padding={12}
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  themeEvolutionSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 15,
  },
  currentThemeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  themeGrid: {
    gap: 8,
    paddingTop: 12,
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
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  themeRequirement: {
    fontSize: 10,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  themeRight: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 12,
  },
  colorIndicators: {
    flexDirection: 'row',
    gap: 6,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  themeStatus: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionContainer: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  subsectionTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  subsectionDescription: {
    fontSize: 12,
    marginBottom: 8,
  },
  shareableSection: {
    borderTopWidth: 0.5,
    marginTop: 16,
    paddingTop: 16,
  },
  shareableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
}); 