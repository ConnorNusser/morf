import { useRoutine } from '@/contexts/RoutineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Routine } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../Button';
import WeeklyRoutineScheduler from './WeeklyRoutineScheduler';

interface MyRoutinesSectionProps {
  onOpenBrowseRoutines: () => void;
  onSelectedDayChange?: (day: number, dayName: string) => void;
}

export default function MyRoutinesSection({ 
  onOpenBrowseRoutines, 
  onSelectedDayChange 
}: MyRoutinesSectionProps) {
  const { routines: userRoutines, currentRoutine, setCurrentRoutine, isLoading } = useRoutine();
  const { currentTheme } = useTheme();
  const [showRoutineDropdown, setShowRoutineDropdown] = useState(false);

  const handleCreateNewRoutine = () => {
    onOpenBrowseRoutines();
  };

  const handleSelectRoutine = async (routine: Routine) => {
    try {
      await setCurrentRoutine(routine);
      setShowRoutineDropdown(false);
    } catch (error) {
      // Handle error silently
    }
  };

  const truncateRoutineName = (name: string, maxLength: number = 30): string => {
    return name.length > maxLength ? `${name.substring(0, maxLength - 3)}...` : name;
  };

  return (
    <View style={[styles.myRoutinesContainer, { backgroundColor: 'transparent', overflow: 'visible' }]}>
      {/* Header with embedded routine selector */}
      <View style={[styles.headerContainer, { backgroundColor: 'transparent', overflow: 'visible' }]}>
        <TouchableOpacity
          onPress={() => setShowRoutineDropdown(!showRoutineDropdown)}
          style={styles.titleDropdownContainer}
          activeOpacity={0.7}
        >
          <View style={styles.titleRow}>
            <Text style={[
              styles.sectionTitle,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              My Routines
              {currentRoutine && (
                <Text style={[
                  styles.dashSeparator,
                  {
                    color: currentTheme.colors.primary,
                    fontFamily: 'Raleway_500Medium',
                  }
                ]}>
                  {' - '}
                  <Text style={[
                    styles.selectedRoutineName,
                    {
                      color: currentTheme.colors.primary,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    {truncateRoutineName(currentRoutine.name)}
                  </Text>
                </Text>
              )}
            </Text>
            
            <Ionicons 
              name={showRoutineDropdown ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={currentTheme.colors.text} 
              style={{ opacity: 0.6, marginLeft: 8 }}
            />
          </View>
        </TouchableOpacity>

        {/* Dropdown Menu */}
        {showRoutineDropdown && (
          <View style={[
            styles.dropdownMenu,
            {
              backgroundColor: currentTheme.colors.background,
              borderColor: currentTheme.colors.border,
              shadowColor: currentTheme.colors.text,
            }
          ]}>
            {/* Create New Routine */}
            <View style={styles.createButtonContainer}>
              <Button
                title="Create New Routine"
                onPress={handleCreateNewRoutine}
                variant="primary"
                size="small"
                style={styles.createButton}
                hapticType="light"
              />
            </View>

            {/* Existing Routines */}
            {userRoutines.map((routine, index) => (
              <TouchableOpacity
                key={routine.id}
                onPress={() => handleSelectRoutine(routine)}
                style={[
                  styles.dropdownItem,
                  { borderBottomColor: currentTheme.colors.border },
                  currentRoutine?.id === routine.id && {
                    backgroundColor: currentTheme.colors.primary + '10'
                  },
                  index === userRoutines.length - 1 && styles.lastDropdownItem
                ]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dropdownItemText,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_500Medium',
                  }
                ]}>
                  {routine.name}
                </Text>
                {currentRoutine?.id === routine.id && (
                  <View style={[styles.selectedIndicator, { backgroundColor: currentTheme.colors.primary }]} />
                )}
              </TouchableOpacity>
            ))}

            {userRoutines.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: 'transparent' }]}>
                <Text style={[
                  styles.emptyStateText,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                    opacity: 0.5,
                  }
                ]}>
                  No routines created yet
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Weekly Routine Scheduler */}
      <WeeklyRoutineScheduler 
        onSelectedDayChange={onSelectedDayChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  myRoutinesContainer: {
    marginBottom: 24,
    overflow: 'visible',
  },
  headerContainer: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 10,
    overflow: 'visible',
  },
  titleDropdownContainer: {
    // Remove alignSelf that was causing issues
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  dashSeparator: {
    fontSize: 16,
    fontWeight: '500',
  },
  selectedRoutineName: {
    fontSize: 16,
    fontWeight: '500',
    flexShrink: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    maxWidth: 300,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  createButtonContainer: {
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  createButton: {
    width: '100%',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    position: 'relative',
  },
  dropdownItemText: {
    fontSize: 14,
    flex: 1,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
  },
  lastDropdownItem: {
    borderBottomWidth: 0,
  },
  selectedIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    right: 16,
  },
}); 