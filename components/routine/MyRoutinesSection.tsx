import { useRoutine } from '@/contexts/RoutineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Routine } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const [showRoutineSelector, setShowRoutineSelector] = useState(false);

  const handleCreateNewRoutine = () => {
    onOpenBrowseRoutines();
  };

  const handleSelectRoutine = async (routine: Routine) => {
    try {
      await setCurrentRoutine(routine);
      setShowRoutineSelector(false);
    } catch (error) {
      // Handle error silently
    }
  };

  const handleToggleSelector = () => {
    setShowRoutineSelector(!showRoutineSelector);
  };

  return (
    <View style={[styles.myRoutinesContainer, { backgroundColor: 'transparent', overflow: 'visible' }]}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <Text style={[
            styles.sectionTitle,
            {
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_500Medium',
            }
          ]}>
            My Routines
          </Text>
          
          {/* Compact Routine Selector */}
          {currentRoutine && (
            <TouchableOpacity
              onPress={handleToggleSelector}
              style={styles.compactRoutineSelector}
              activeOpacity={0.8}
            >
              <Text style={[styles.compactRoutineText, {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }]} numberOfLines={1}>
                {currentRoutine.name}
              </Text>
              <Ionicons 
                name={showRoutineSelector ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={currentTheme.colors.text} 
                style={{ opacity: 0.6 }}
              />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Create First Routine Card - only show when no routine */}
        {!currentRoutine && (
          <TouchableOpacity
            onPress={handleCreateNewRoutine}
            style={[styles.createFirstRoutineCard, {
              backgroundColor: currentTheme.colors.surface,
            }]}
            activeOpacity={0.8}
          >
            <View style={styles.createCardContent}>
              <Ionicons name="add-circle-outline" size={32} color={currentTheme.colors.primary} />
              <Text style={[styles.createCardTitle, {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                Create Your First Routine
              </Text>
              <Text style={[styles.createCardSubtitle, {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
                opacity: 0.7,
              }]}>
                Build a custom workout plan
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Compact Routine Selector Dropdown */}
      {showRoutineSelector && (
        <View style={[styles.routineSelectorContainer, {
          backgroundColor: currentTheme.colors.surface,
        }]}>
          {/* Create New Button */}
          <TouchableOpacity
            onPress={() => {
              setShowRoutineSelector(false);
              handleCreateNewRoutine();
            }}
            style={styles.createRoutineCard}
            activeOpacity={0.6}
          >
            <View style={styles.createCardRow}>
              <Text style={[styles.createCardText, {
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_500Medium',
              }]}>
                Browse/Create Routine
              </Text>
            </View>
          </TouchableOpacity>

          {/* Existing Routines */}
          {userRoutines.map((routine) => (
            <TouchableOpacity
              key={routine.id}
              onPress={() => handleSelectRoutine(routine)}
              style={styles.routineOptionCard}
              activeOpacity={0.6}
            >
              <View style={styles.routineOptionContent}>
                <View style={styles.routineOptionInfo}>
                  <Text style={[styles.routineOptionTitle, {
                    color: currentRoutine?.id === routine.id 
                      ? currentTheme.colors.primary 
                      : currentTheme.colors.text,
                    fontFamily: 'Raleway_500Medium',
                  }]}>
                    {routine.name}
                  </Text>
                  <Text style={[styles.routineOptionSubtitle, {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                    opacity: 0.6,
                  }]}>
                    {routine.exercises.length} workout{routine.exercises.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                {currentRoutine?.id === routine.id && (
                  <Ionicons name="checkmark-outline" size={16} color={currentTheme.colors.primary} />
                )}
              </View>
            </TouchableOpacity>
          ))}

          {userRoutines.length === 0 && (
            <View style={styles.emptyRoutinesState}>
              <Text style={[styles.emptyRoutinesText, {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
                opacity: 0.6,
              }]}>
                No other routines yet
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Weekly Routine Scheduler */}
      {currentRoutine && (
        <WeeklyRoutineScheduler 
          onSelectedDayChange={onSelectedDayChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  myRoutinesContainer: {
    marginBottom: 24,
    overflow: 'visible',
  },
  headerSection: {
    marginBottom: 12,
    position: 'relative',
    zIndex: 10,
    overflow: 'visible',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
  },
  compactRoutineSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: 220,
  },
  compactRoutineText: {
    fontSize: 13,
    fontWeight: '500',
    marginRight: 6,
    flex: 1,
  },
  currentRoutineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20, // More generous padding
    borderRadius: 16, // More rounded corners
    borderWidth: 0, // Remove border completely
    backgroundColor: 'transparent', // Will be set dynamically
  },
  routineCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  routineInfo: {
    flex: 1,
    marginRight: 12,
  },
  currentRoutineTitle: {
    fontSize: 20, // Larger title
    fontWeight: '700', // Bolder
    marginBottom: 4,
  },
  currentRoutineSubtitle: {
    fontSize: 15, // Larger subtitle
    opacity: 0.7,
  },
  routineCardActions: {
    paddingLeft: 12,
  },
  createFirstRoutineCard: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: 'transparent',
    marginTop: 8,
  },
  createCardContent: {
    alignItems: 'center',
  },
  createCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  createCardSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  routineSelectorContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    maxWidth: 360,
    borderRadius: 12,
    borderWidth: 0,
    marginTop: 4,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    alignSelf: 'center',
    padding: 16,
  },
  createRoutineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 0,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  createCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createCardText: {
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  routineOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 0,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  routineOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  routineOptionInfo: {
    flex: 1,
    marginRight: 12,
  },
  routineOptionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  routineOptionSubtitle: {
    fontSize: 12,
  },
  emptyRoutinesState: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyRoutinesText: {
    fontSize: 13,
  },
}); 