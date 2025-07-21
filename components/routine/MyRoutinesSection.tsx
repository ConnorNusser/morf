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
        <Text style={[
          styles.sectionTitle,
          {
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_500Medium',
          }
        ]}>
          My Routines
        </Text>
        
        {/* Current Routine Card */}
        {currentRoutine ? (
          <TouchableOpacity
            onPress={handleToggleSelector}
            style={[styles.currentRoutineCard, {
              backgroundColor: currentTheme.colors.surface,
            }]}
            activeOpacity={0.8}
          >
            <View style={styles.routineCardContent}>
              <View style={styles.routineInfo}>
                <Text style={[styles.currentRoutineTitle, {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }]}>
                  {currentRoutine.name}
                </Text>
                <Text style={[styles.currentRoutineSubtitle, {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                  opacity: 0.7,
                }]}>
                  {currentRoutine.exercises.length} workout{currentRoutine.exercises.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.routineCardActions}>
                <Ionicons 
                  name={showRoutineSelector ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={currentTheme.colors.text} 
                  style={{ opacity: 0.6 }}
                />
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleCreateNewRoutine}
            style={[styles.createFirstRoutineCard, {
              backgroundColor: currentTheme.colors.primary + '15',
            }]}
            activeOpacity={0.8}
          >
            <View style={styles.createCardContent}>
              <Ionicons name="add-circle" size={32} color={currentTheme.colors.primary} />
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
                Get started with a personalized workout plan
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Routine Selector Cards */}
      {showRoutineSelector && (
        <View style={[styles.routineSelectorContainer, {
          backgroundColor: currentTheme.colors.background,
        }]}>
          {/* Create New Button */}
          <TouchableOpacity
            onPress={handleCreateNewRoutine}
            style={[styles.createRoutineCard, {
              backgroundColor: currentTheme.colors.primary + '15',
            }]}
            activeOpacity={0.8}
          >
            <View style={styles.createCardRow}>
              <Ionicons name="add-circle-outline" size={24} color={currentTheme.colors.primary} />
              <Text style={[styles.createCardText, {
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                Create New Routine
              </Text>
            </View>
          </TouchableOpacity>

          {/* Existing Routines */}
          {userRoutines.map((routine) => (
            <TouchableOpacity
              key={routine.id}
              onPress={() => handleSelectRoutine(routine)}
              style={[
                styles.routineOptionCard,
                {
                  backgroundColor: currentRoutine?.id === routine.id 
                    ? currentTheme.colors.primary + '15' 
                    : currentTheme.colors.surface,
                }
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.routineOptionContent}>
                <View style={styles.routineOptionInfo}>
                  <Text style={[styles.routineOptionTitle, {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_600SemiBold',
                  }]}>
                    {routine.name}
                  </Text>
                  <Text style={[styles.routineOptionSubtitle, {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                    opacity: 0.7,
                  }]}>
                    {routine.exercises.length} workout{routine.exercises.length !== 1 ? 's' : ''} • Created {new Date(routine.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                {currentRoutine?.id === routine.id && (
                  <View style={[styles.selectedBadge, { backgroundColor: currentTheme.colors.primary }]}>
                    <Ionicons name="checkmark" size={16} color={currentTheme.colors.background} />
                  </View>
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
    marginBottom: 16,
    position: 'relative',
    zIndex: 10,
    overflow: 'visible',
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
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
    padding: 32, // Much more padding
    borderRadius: 16,
    borderWidth: 0, // Remove border
    backgroundColor: 'transparent', // Will be set dynamically
  },
  createCardContent: {
    alignItems: 'center',
  },
  createCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16, // More space from icon
    marginBottom: 4,
  },
  createCardSubtitle: {
    fontSize: 15,
    marginTop: 4,
    textAlign: 'center',
  },
  routineSelectorContainer: {
    position: 'absolute',
    top: 110, // Adjust based on new header height
    left: 0,
    right: 0,
    maxWidth: 360, // Slightly wider
    borderRadius: 16, // More rounded
    borderWidth: 0, // Remove border
    marginTop: 8,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    alignSelf: 'center',
    padding: 16, // Add internal padding
  },
  createRoutineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18, // More padding
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 0, // Remove border
    marginBottom: 12,
    backgroundColor: 'transparent', // Will be set dynamically
  },
  createCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createCardText: {
    fontSize: 17, // Larger text
    marginLeft: 12,
    fontWeight: '600',
  },
  routineOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18, // More padding
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 0, // Remove border completely
    marginBottom: 12,
    backgroundColor: 'transparent', // Will be set dynamically
  },
  routineOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  routineOptionInfo: {
    flex: 1,
    marginRight: 10,
  },
  routineOptionTitle: {
    fontSize: 16, // Increased from 14 for better readability
    fontWeight: '600',
  },
  routineOptionSubtitle: {
    fontSize: 14, // Increased from 12
  },
  selectedBadge: {
    width: 20, // Slightly smaller
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12, // Use margin instead of absolute positioning
  },
  emptyRoutinesState: {
    paddingVertical: 24, // Increased from 20
    alignItems: 'center',
  },
  emptyRoutinesText: {
    fontSize: 16, // Increased from 14 for better readability
  },
}); 