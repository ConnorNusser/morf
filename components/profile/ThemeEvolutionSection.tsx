import Card from '@/components/Card';
import Badge from '@/components/ui/Badge';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/utils/haptic';
import { storageService } from '@/lib/storage/storage';
import {
  getThemeDisplayName,
  getThemeRequirement,
  isThemeUnlocked,
  ThemeLevel
} from '@/lib/storage/userProfile';
import { isSeasonalThemeAvailable } from '@/lib/ui/theme';
import { radius, space, tint } from '@/lib/ui/tokens';
import { userService } from '@/lib/services/userService';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { LiftDisplayFilters, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Share, StyleSheet, TouchableOpacity } from 'react-native';

export default function ThemeEvolutionSection() {
  const { currentTheme, currentThemeLevel, themes, setThemeLevel } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [liftFilters, setLiftFilters] = useState<LiftDisplayFilters>({ hiddenLiftIds: [] });
  const [shareCount, setShareCount] = useState(0);
  const { play: playSelectionComplete } = useSound('selectionComplete');

  useEffect(() => {
    loadUserData();
  }, []);

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

  // Compute overall percentile once per data change, not per theme card (~6x/card).
  const calculatedPercentile = useMemo(() => {
    const percentiles = userProgress
      .filter(p => !liftFilters.hiddenLiftIds.includes(p.workoutId))
      .map(p => p.percentileRanking);
    return percentiles.length > 0 ? calculateOverallPercentile(percentiles) : 0;
  }, [userProgress, liftFilters]);

  const isThemeAvailable = useCallback((level: ThemeLevel) => {
    return isThemeUnlocked(level, calculatedPercentile, shareCount);
  }, [calculatedPercentile, shareCount]);

  const isCurrentTheme = (level: ThemeLevel) => {
    return level === currentThemeLevel;
  };

  const themeEntries = useMemo(
    () => Object.entries(themes) as [ThemeLevel, typeof themes[ThemeLevel]][],
    [themes]
  );

  // One tappable theme card, shared by the strength-unlock and shareable/seasonal grids.
  const renderThemeCard = (themeKey: ThemeLevel, theme: typeof themes[ThemeLevel]) => (
    <TouchableOpacity
      key={themeKey}
      onPress={() => handleThemeSelect(themeKey)}
      disabled={!isThemeAvailable(themeKey)}
      activeOpacity={0.7}
    >
      <Card
        padding={space.md}
        style={StyleSheet.flatten([
          styles.themeCard,
          // Selectable cards need their own contrast (shared Card is flat): surface + hairline, and a primary ring + tint when current.
          {
            paddingHorizontal: space.lg,
            borderRadius: radius.card,
            backgroundColor: currentTheme.colors.surface,
            borderWidth: 1,
            borderColor: currentTheme.colors.border,
          },
          !isThemeAvailable(themeKey) && styles.lockedTheme,
          isCurrentTheme(themeKey) && {
            borderColor: currentTheme.colors.primary,
            borderWidth: 2,
            backgroundColor: tint(currentTheme.colors.primary),
          },
        ])}
      >
        <View style={styles.themeInfo}>
          <Text
            variant="body"
            weight="bold"
            tone={isThemeAvailable(themeKey) ? 'primary' : 'faint'}
            style={styles.themeName}
          >
            {getThemeDisplayName(themeKey)}
          </Text>
          <Text
            variant="meta"
            tone={isThemeAvailable(themeKey) ? 'muted' : 'faint'}
            style={styles.themeRequirement}
          >
            {getThemeRequirement(themeKey)}
          </Text>
        </View>

        <View style={styles.themeRight}>
          {isThemeAvailable(themeKey) && (
            <View style={styles.colorIndicators}>
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

          <View style={styles.themeStatus}>
            {isCurrentTheme(themeKey) && (
              <Badge label="Active" color={currentTheme.colors.primary} />
            )}
            {!isThemeAvailable(themeKey) && (
              <View style={styles.lockedRow}>
                <Image
                  source={require('@/assets/images/pixel/padlock.png')}
                  style={styles.lockArt}
                  resizeMode="contain"
                />
                <Text variant="meta" weight="medium" tone="muted">
                  Locked
                </Text>
              </View>
            )}
            {isThemeAvailable(themeKey) && !isCurrentTheme(themeKey) && (
              <Text variant="meta" weight="medium" tone="secondary">
                Tap to activate
              </Text>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const handleShareApp = async () => {
    try {
      const result = await Share.share({
        message: 'Im sharing this app to get some free themes but also its a sick workout app! \n\nhttps://apps.apple.com/us/app/morf-your-ai-workout-tracker/id6747366819?platform=iphone 💪',
        title: 'Morf - Transform Your Strength',
      });

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
    <Card>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.themeSectionHeaderContent}>
          <Text variant="emphasis" weight="bold" tone="primary" style={styles.themeEvolutionTitle}>
            Theme Evolution
          </Text>
          {!isExpanded && (
            <Text variant="meta" weight="medium" style={{ marginTop: space.xs }}>
              {getThemeDisplayName(currentThemeLevel)}
            </Text>
          )}
          {isExpanded && (
            <Text variant="meta" tone="secondary" style={styles.themeEvolutionSubtitle}>
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
          <View style={styles.sectionContainer}>
            <Text variant="body" tone="primary" style={styles.subsectionTitle}>
              Fitness Progression Themes
            </Text>
            <Text variant="meta" tone="secondary" style={styles.subsectionDescription}>
              Unlock themes based on your strength percentile
            </Text>
            <View style={styles.themeGrid}>
              {themeEntries
                .filter(([themeKey]) => !themeKey.startsWith('share_') && themeKey !== 'winter_2026')
                .map(([themeKey, theme]) => renderThemeCard(themeKey, theme))}
            </View>
          </View>

          <View style={[
            styles.sectionContainer,
            styles.shareableSection,
            { borderTopColor: currentTheme.colors.border }
          ]}>
            <View style={styles.shareableHeader}>
              <View>
                <Text variant="body" tone="primary" style={styles.subsectionTitle}>
                  Special Themes
                </Text>
                <Text variant="meta" tone="secondary" style={styles.subsectionDescription}>
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

            <View style={styles.themeGrid}>
              {themeEntries
                .filter(([themeKey]) =>
                  themeKey.startsWith('share_') ||
                  (themeKey === 'winter_2026' && isSeasonalThemeAvailable('winter_2026'))
                )
                .map(([themeKey, theme]) => renderThemeCard(themeKey, theme))}
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
    paddingVertical: space.xs,
  },
  themeSectionHeaderContent: {
    flex: 1,
  },
  themeEvolutionTitle: {
    marginBottom: space.sm,
  },
  themeEvolutionSubtitle: {
    marginBottom: space.lg,
  },
  themeGrid: {
    gap: space.sm,
    paddingTop: space.md,
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
    marginBottom: space.xs,
  },
  themeRequirement: {},
  themeRight: {
    alignItems: 'flex-end',
    gap: space.sm,
    marginLeft: space.md,
  },
  colorIndicators: {
    flexDirection: 'row',
    gap: space.sm,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  themeStatus: {
    alignItems: 'center',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  lockArt: {
    width: 16,
    height: 16,
    opacity: 0.7,
  },
  sectionContainer: {
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
  },
  subsectionTitle: {
    marginBottom: space.xs,
  },
  subsectionDescription: {
    marginBottom: space.sm,
  },
  shareableSection: {
    borderTopWidth: 0.5,
    marginTop: space.lg,
    paddingTop: space.lg,
  },
  shareableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  shareButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
});
