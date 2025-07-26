import { useTheme } from '@/contexts/ThemeContext';
import { FEMALE_STANDARDS, MALE_STANDARDS } from '@/lib/strengthStandards';
import { convertWeightForPreference } from '@/lib/utils';
import { Gender, MainLiftType } from '@/types';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface ProgressionIndicatorProps {
  currentOneRM: number;
  bodyWeight: number;
  gender: Gender;
  age: number;
  liftId: MainLiftType;
  weightUnit: 'lbs' | 'kg';
}

// Clean strength targets with colorful theming
const STRENGTH_TARGETS = [
  { key: 'advanced', name: 'Advanced', level: '50th percentile', color: '#3B82F6' }, // Blue
  { key: 'elite', name: 'Elite', level: '75th percentile', color: '#8B5CF6' }, // Purple  
  { key: 'god', name: 'God', level: '90th percentile', color: '#F59E0B' }, // Amber/Gold
] as const;

interface ProgressTarget {
  name: string;
  level: string;
  color: string;
  targetWeight: number;
  deficit: number;
  isAchieved: boolean;
  progressPercent: number;
}

const roundToIncrement = (value: number, unit: 'lbs' | 'kg'): number => {
  const increment = unit === 'kg' ? 2.5 : 5;
  return Math.round(value / increment) * increment;
};

export default function ProgressionIndicator({ 
  currentOneRM, 
  bodyWeight, 
  gender, 
  age, 
  liftId, 
  weightUnit 
}: ProgressionIndicatorProps) {
  const { currentTheme } = useTheme();
  const [slideAnim] = useState(new Animated.Value(0));

  // Convert gender for strength calculations
  const strengthGender: 'male' | 'female' = gender === 'female' ? 'female' : 'male';
  
  // Get strength standards for this lift
  const standards = strengthGender === 'male' ? MALE_STANDARDS[liftId] : FEMALE_STANDARDS[liftId];

  // Gentle entrance animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  // Convert current 1RM to display units first
  const currentOneRMInDisplayUnits = convertWeightForPreference(currentOneRM, 'lbs', weightUnit);
  const currentOneRMRounded = roundToIncrement(currentOneRMInDisplayUnits, weightUnit);

  // Calculate targets based on actual strength standards
  const targets: ProgressTarget[] = STRENGTH_TARGETS.map(target => {
    const multiplier = standards[target.key];
    const targetWeightLbs = bodyWeight * multiplier;
    
    // Convert target to display units and round
    const targetInDisplayUnits = convertWeightForPreference(targetWeightLbs, 'lbs', weightUnit);
    const targetRounded = roundToIncrement(targetInDisplayUnits, weightUnit);
    
    // Calculate deficit based on rounded values (so math adds up)
    const isAchieved = currentOneRMRounded >= targetRounded;
    const deficit = Math.max(0, targetRounded - currentOneRMRounded);
    const progressPercent = isAchieved ? 100 : Math.min(95, (currentOneRMRounded / targetRounded) * 100);

    return {
      name: target.name,
      level: target.level,
      color: target.color,
      targetWeight: targetRounded,
      deficit,
      isAchieved,
      progressPercent,
    };
  });

  return (
    <Animated.View 
      style={[
        styles.container,
        { 
          backgroundColor: currentTheme.colors.surface,
          transform: [{ 
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            })
          }],
          opacity: slideAnim,
        }
      ]}
    >
      {/* Colorful header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>
          Strength Progression
        </Text>
        <View style={[styles.divider, { backgroundColor: currentTheme.colors.primary }]} />
      </View>

      {/* Minimalist current status display */}
      <View style={styles.currentStatus}>
        <Text style={[styles.currentLabel, { color: currentTheme.colors.text + '70' }]}>
          Current 1RM
        </Text>
        <Text style={[styles.currentValue, { color: currentTheme.colors.primary }]}>
          {currentOneRMRounded} {weightUnit}
        </Text>
      </View>

      {/* Colorful data grid */}
      <View style={styles.grid}>
        {/* Header row */}
        <View style={styles.gridHeader}>
          <View style={styles.nameColumn}>
            <Text style={[styles.columnLabel, { color: currentTheme.colors.text + '70' }]}>
              Level
            </Text>
          </View>
          <View style={styles.targetColumn}>
            <Text style={[styles.columnLabel, { color: currentTheme.colors.text + '70' }]}>
              Target
            </Text>
          </View>
          <View style={styles.statusColumn}>
            <Text style={[styles.columnLabel, { color: currentTheme.colors.text + '70' }]}>
              Progress
            </Text>
          </View>
        </View>

        {/* Data rows with individual colors */}
        {targets.map((target, index) => {
          return (
            <View key={target.name} style={styles.gridRow}>
              {/* Level info */}
              <View style={styles.nameColumn}>
                <Text style={[styles.levelName, { color: currentTheme.colors.text }]}>
                  {target.name}
                </Text>
                <Text style={[styles.levelDescription, { color: currentTheme.colors.text + '60' }]}>
                  {target.level}
                </Text>
              </View>

              {/* Target weight */}
              <View style={styles.targetColumn}>
                <Text style={[styles.targetWeight, { color: currentTheme.colors.text }]}>
                  {target.targetWeight}
                </Text>
                <Text style={[styles.targetUnit, { color: currentTheme.colors.text + '60' }]}>
                  {weightUnit}
                </Text>
              </View>

              {/* Status with positive language */}
              <View style={styles.statusColumn}>
                {target.isAchieved ? (
                  <View style={styles.achievedStatus}>
                    <Text style={[styles.achievedText, { color: target.color }]}>
                      ✓ Achieved
                    </Text>
                  </View>
                ) : (
                  <View style={styles.pendingStatus}>
                    <Text style={[styles.toGoText, { color: target.color }]}>
                      {target.deficit} {weightUnit} to go
                    </Text>
                    <Text style={[styles.progressText, { color: target.color + 'CC' }]}>
                      {Math.round(target.progressPercent)}% there
                    </Text>
                  </View>
                )}
              </View>

              {/* Colorful progress indicator */}
              <View style={styles.progressContainer}>
                <View style={[styles.progressTrack, { backgroundColor: target.color + '20' }]}>
                  <View 
                    style={[
                      styles.progressBar,
                      { 
                        width: `${target.progressPercent}%`,
                        backgroundColor: target.color + (target.isAchieved ? '' : '80')
                      }
                    ]} 
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Gentle footer */}
      <View style={styles.footer}>
        <Text style={[styles.footnote, { color: currentTheme.colors.text + '50' }]}>
          Based on strength standards from powerlifting competition data
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    marginBottom: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  divider: {
    height: 3,
    width: 40,
    borderRadius: 2,
  },
  currentStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 20,
  },
  currentLabel: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Raleway_500Medium',
  },
  currentValue: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    letterSpacing: -0.2,
  },
  grid: {
    gap: 0,
  },
  gridHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00000008',
  },
  gridRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#00000005',
  },
  nameColumn: {
    flex: 2,
    justifyContent: 'center',
  },
  targetColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusColumn: {
    flex: 1.5,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Raleway_500Medium',
    letterSpacing: 0.3,
  },
  levelName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  levelDescription: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Raleway_400Regular',
  },
  targetWeight: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: 'Raleway_500Medium',
    lineHeight: 20,
  },
  targetUnit: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Raleway_400Regular',
    marginTop: 2,
  },
  achievedStatus: {
    alignItems: 'flex-end',
  },
  achievedText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Raleway_600SemiBold',
  },
  pendingStatus: {
    alignItems: 'flex-end',
  },
  toGoText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Raleway_500Medium',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '400',
    fontFamily: 'Raleway_400Regular',
    marginTop: 2,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressTrack: {
    height: '100%',
    width: '100%',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  footer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#00000008',
  },
  footnote: {
    fontSize: 11,
    fontWeight: '400',
    fontFamily: 'Raleway_400Regular',
    textAlign: 'center',
    lineHeight: 16,
  },
}); 