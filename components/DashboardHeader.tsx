import TierRing from '@/components/gamification/TierRing';
import { useTheme } from '@/contexts/ThemeContext';
import { StrengthTier } from '@/lib/data/strengthStandards';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ViewMode = 'home' | 'feed';

export interface HeaderStats {
  totalVolume: number;
  totalWorkouts: number;
  unit: WeightUnit;
  tier?: StrengthTier; // strength tier (gamification)
  tierProgress?: number; // 0..1 toward the next tier
}

interface DashboardHeaderProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  stats?: HeaderStats;
  onTierPress?: () => void;
  /** Overrides the default "Morf" wordmark when there's no view selector. */
  title?: string;
}

export default function DashboardHeader({ viewMode, onViewModeChange, stats, onTierPress, title }: DashboardHeaderProps) {
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
            <View style={styles.headerLeft}>
              <Image
                source={require('@/assets/images/icon-original.png')}
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

            {stats?.tier != null && (
              <TouchableOpacity
                style={styles.levelButton}
                onPress={onTierPress}
                activeOpacity={0.7}
                disabled={!onTierPress}
                accessibilityLabel={`${stats.tier} tier, view career`}
              >
                <TierRing tier={stats.tier} progress={stats.tierProgress ?? 0} />
              </TouchableOpacity>
            )}
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
                    <Text style={[styles.dropdownText, { color: viewMode === 'home' ? currentTheme.colors.primary : currentTheme.colors.text, fontWeight: '600' }]}>
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
                    <Text style={[styles.dropdownText, { color: viewMode === 'feed' ? currentTheme.colors.primary : currentTheme.colors.text, fontWeight: '600' }]}>
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
          {title ?? 'Morf'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 0,
    paddingHorizontal: 4,
    zIndex: 1000,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelButton: {
    flexShrink: 0,
    marginLeft: 12,
    padding: 2,
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