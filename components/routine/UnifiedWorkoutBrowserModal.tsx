import { useRoutine } from '@/contexts/RoutineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkout } from '@/contexts/WorkoutContext';
import { GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Button from '../Button';

export type WorkoutSource = 'standalone' | 'routine' | 'both';
export type BrowserMode = 'browse' | 'import' | 'select';

interface WorkoutBrowserAction {
  id: string;
  title: string;
  icon: string;
  color?: string;
  onPress: (workout: GeneratedWorkout) => void;
}

interface UnifiedWorkoutBrowserModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  source?: WorkoutSource;
  mode?: BrowserMode;
  customActions?: WorkoutBrowserAction[];
  
  // Legacy compatibility props
  onImportWorkout?: (workout: GeneratedWorkout) => void;
  onSelectWorkout?: (workout: GeneratedWorkout) => void;
  onEditWorkout?: (workout: GeneratedWorkout) => void;
  onDeleteWorkout?: (workoutId: string, workoutTitle: string) => void;
  onCreateNew?: () => void;
  showCreateNew?: boolean;
  
  // Filtering
  filterByDay?: string;
  excludeWorkoutIds?: string[];
}

const EMPTY_ARRAY: WorkoutBrowserAction[] = [];
const EMPTY_EXCLUDE_IDS: string[] = [];

export default function UnifiedWorkoutBrowserModal({
  visible,
  onClose,
  title = 'Workout Library',
  source = 'both',
  mode = 'browse',
  customActions = EMPTY_ARRAY,
  onImportWorkout,
  onSelectWorkout,
  onEditWorkout,
  onDeleteWorkout,
  onCreateNew,
  showCreateNew = false,
  filterByDay,
  excludeWorkoutIds = EMPTY_EXCLUDE_IDS
}: UnifiedWorkoutBrowserModalProps) {
  const { currentTheme } = useTheme();
  const { workouts: standaloneWorkouts, isLoading: standaloneLoading, deleteWorkout: deleteStandaloneWorkout } = useWorkout();
  const { currentRoutine } = useRoutine();
  
  const [allWorkouts, setAllWorkouts] = useState<GeneratedWorkout[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<GeneratedWorkout[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Combine workouts from different sources
  useEffect(() => {
    let workouts: GeneratedWorkout[] = [];
    
    if (source === 'standalone' || source === 'both') {
      workouts = [...workouts, ...standaloneWorkouts];
    }
    
    if (source === 'routine' || source === 'both') {
      if (currentRoutine?.exercises) {
        workouts = [...workouts, ...currentRoutine.exercises];
      }
    }
    
    // Apply filtering
    if (filterByDay) {
      workouts = workouts.filter(workout => workout.dayOfWeek === filterByDay);
    }
    
    if (excludeWorkoutIds.length > 0) {
      workouts = workouts.filter(workout => !excludeWorkoutIds.includes(workout.id));
    }
    
    // Remove duplicates by ID
    workouts = workouts.filter((workout, index, self) => 
      index === self.findIndex(w => w.id === workout.id)
    );
    
    setAllWorkouts(workouts);
    setIsLoading(standaloneLoading);
  }, [standaloneWorkouts, currentRoutine?.exercises, source, filterByDay, excludeWorkoutIds.join(','), standaloneLoading]);

  // Filter workouts based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredWorkouts(allWorkouts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allWorkouts.filter(workout => 
      workout.title.toLowerCase().includes(query) ||
      workout.description.toLowerCase().includes(query) ||
      (workout.dayOfWeek && workout.dayOfWeek.toLowerCase().includes(query))
    );
    setFilteredWorkouts(filtered);
  }, [allWorkouts, searchQuery]);

  // Generate default actions based on mode and callbacks
  const getDefaultActions = React.useCallback((workout: GeneratedWorkout): WorkoutBrowserAction[] => {
    const actions: WorkoutBrowserAction[] = [];
    
    if (onEditWorkout) {
      actions.push({
        id: 'edit',
        title: 'Edit',
        icon: 'create-outline',
        onPress: onEditWorkout
      });
    }
    
    if (onImportWorkout) {
      actions.push({
        id: 'start',
        title: 'Start',
        icon: 'chevron-forward',
        color: currentTheme.colors.primary,
        onPress: (workout) => {
          onImportWorkout(workout);
          onClose();
        }
      });
    }
    
    if (onSelectWorkout) {
      actions.push({
        id: 'select',
        title: 'Select',
        icon: 'checkmark-circle-outline',
        color: currentTheme.colors.primary,
        onPress: onSelectWorkout
      });
    }
    
    if (onDeleteWorkout) {
      actions.push({
        id: 'delete',
        title: 'Delete',
        icon: 'remove-outline',
        onPress: (workout) => onDeleteWorkout(workout.id, workout.title)
      });
    }
    
    return actions;
  }, [onEditWorkout, onImportWorkout, onSelectWorkout, onDeleteWorkout, currentTheme.colors.primary]);

  const handleDeleteWorkout = async (workoutId: string, workoutTitle: string) => {
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workoutTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Try standalone deletion first
              const isStandalone = standaloneWorkouts.some(w => w.id === workoutId);
              if (isStandalone) {
                await deleteStandaloneWorkout(workoutId);
              }
              
              // Call custom delete handler if provided
              if (onDeleteWorkout) {
                onDeleteWorkout(workoutId, workoutTitle);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete workout');
            }
          }
        }
      ]
    );
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const getWorkoutSource = (workout: GeneratedWorkout): string => {
    if (workout.dayOfWeek) {
      return `${workout.dayOfWeek.charAt(0).toUpperCase() + workout.dayOfWeek.slice(1)} • Routine`;
    }
    return 'Standalone';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { 
          borderBottomColor: currentTheme.colors.border,
          backgroundColor: currentTheme.colors.background,
        }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { 
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_700Bold',
          }]}>
            {title}
          </Text>
          
          <View style={styles.headerRight} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: currentTheme.colors.background }]}>
          <View style={[styles.searchInputContainer, { 
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }]}>
            <Ionicons name="search" size={20} color={currentTheme.colors.text} style={{ opacity: 0.5 }} />
            <TextInput
              style={[styles.searchInput, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
              }]}
              placeholder="Search workouts..."
              placeholderTextColor={currentTheme.colors.text + '60'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={currentTheme.colors.text} style={{ opacity: 0.5 }} />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Create New Button */}
          {showCreateNew && onCreateNew && (
            <View style={styles.createNewContainer}>
              <Button
                title="Create New"
                onPress={() => {
                  onClose(); // Close this modal first
                  setTimeout(() => onCreateNew(), 100); // Then open create modal after a brief delay
                }}
                variant="primary"
                size="medium"
                hapticType="light"
                style={styles.createNewButton}
              />
            </View>
          )}
        </View>

        {/* Results Count */}
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsCount, { 
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_500Medium',
            opacity: 0.7,
          }]}>
            {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''}
            {searchQuery && ` for "${searchQuery}"`}
            {filterByDay && ` on ${filterByDay.charAt(0).toUpperCase() + filterByDay.slice(1)}`}
          </Text>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {isLoading ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
                opacity: 0.6,
              }]}>
                Loading workouts...
              </Text>
            </View>
          ) : filteredWorkouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="fitness-outline" size={48} color={currentTheme.colors.text + '40'} />
              <Text style={[styles.emptyText, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
                opacity: 0.6,
              }]}>
                {searchQuery ? 'No workouts match your search' : 'No workouts found'}
              </Text>
              <Text style={[styles.emptySubtext, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
                opacity: 0.5,
              }]}>
                {searchQuery ? 'Try a different search term' : 'Create workouts to see them here'}
              </Text>
            </View>
          ) : (
            <View style={styles.workoutsList}>
              {filteredWorkouts.map((workout) => {
                const defaultActions = getDefaultActions(workout);
                const actions = customActions.length > 0 ? customActions : defaultActions;
                
                return (
                  <View key={workout.id} style={[styles.workoutCard, { 
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  }]}>
                    {/* Workout Header */}
                    <View style={styles.workoutHeader}>
                      <View style={styles.workoutInfo}>
                        <Text style={[styles.workoutTitle, { 
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_700Bold',
                        }]}>
                          {workout.title}
                        </Text>
                        <Text style={[styles.workoutDescription, { 
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_400Regular',
                          opacity: 0.7,
                        }]}>
                          {workout.description}
                        </Text>
                        <Text style={[styles.workoutDate, { 
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_400Regular',
                          opacity: 0.5,
                        }]}>
                          {formatDate(workout.createdAt)} • {workout.exercises?.length || 0} exercises • ~{workout.estimatedDuration || 45}min • {getWorkoutSource(workout)}
                        </Text>
                      </View>
                      
                      <View style={styles.workoutActions}>
                        {actions.map((action) => (
                          <TouchableOpacity
                            key={action.id}
                            onPress={() => action.onPress(workout)}
                            style={[styles.actionButton, { 
                              backgroundColor: action.color ? action.color + '20' : currentTheme.colors.surface + '40'
                            }]}
                            activeOpacity={0.6}
                          >
                            <Ionicons 
                              name={action.icon as any} 
                              size={16} 
                              color={action.color || currentTheme.colors.text} 
                              style={!action.color ? { opacity: 0.6 } : {}} 
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  createNewContainer: {
    marginTop: 12,
  },
  createNewButton: {
    width: '100%',
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  workoutsList: {
    gap: 16,
  },
  workoutCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  workoutInfo: {
    flex: 1,
    marginRight: 12,
  },
  workoutTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  workoutDescription: {
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 3,
  },
  workoutDate: {
    fontSize: 11,
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 