import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage';
import { getAvailableWorkouts } from '@/lib/workouts';
import { Equipment, MuscleGroup, Workout, WorkoutCategory, WorkoutFilters } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import KeyboardToolbar from '../inputs/KeyboardToolbar';

export interface ExerciseOptions {
  sets: number;
  reps: string;
  weight?: string;
}

interface ExerciseSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Workout, options: ExerciseOptions) => void;
}

export default function ExerciseSelectionModal({ 
  visible, 
  onClose, 
  onSelectExercise 
}: ExerciseSelectionModalProps) {
  const { currentTheme } = useTheme();
  const [allExercises, setAllExercises] = useState<Workout[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Workout[]>([]);
  const [hiddenExercises, setHiddenExercises] = useState<Workout[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilters, setUserFilters] = useState<WorkoutFilters | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'hidden'>('available');
  const [activeFilters, setActiveFilters] = useState({
    category: null as WorkoutCategory | null,
    muscleGroup: null as MuscleGroup | null,
    equipment: null as Equipment | null,
  });
  
  // Inline expansion state
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [configSets, setConfigSets] = useState('3');
  const [configReps, setConfigReps] = useState('8-12');
  
  // Keyboard toolbar state
  const [activeInputRef, setActiveInputRef] = useState<any>(null);
  const inputAccessoryViewID = 'ExerciseConfigToolbar';
  
  useEffect(() => {
    if (visible) {
      loadExercisesAndFilters();
      setSearchQuery('');
      setActiveTab('available');
      setExpandedExerciseId(null);
      setActiveInputRef(null);
    } else {
      // Dismiss keyboard when modal closes
      Keyboard.dismiss();
      setActiveInputRef(null);
    }
  }, [visible]);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, allExercises, userFilters, activeFilters]);

  const loadExercisesAndFilters = async () => {
    try {
      // Load user's workout filters
      const filters = await storageService.getWorkoutFilters();
      setUserFilters(filters);
      
      // Load available exercises
      const availableWorkouts = getAvailableWorkouts(50);
      setAllExercises(availableWorkouts);
    } catch (error) {
      console.error('Error loading exercises and filters:', error);
      const availableWorkouts = getAvailableWorkouts(50);
      setAllExercises(availableWorkouts);
    }
  };

  const applyFilters = () => {
    if (!allExercises.length) return;

    let exercises = [...allExercises];

    // Apply search filter
    if (searchQuery.trim()) {
      exercises = exercises.filter(exercise =>
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.primaryMuscles.some(muscle => muscle.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply category filter
    if (activeFilters.category) {
      exercises = exercises.filter(exercise => exercise.category === activeFilters.category);
    }

    // Apply muscle group filter
    if (activeFilters.muscleGroup) {
      exercises = exercises.filter(exercise => 
        exercise.primaryMuscles.includes(activeFilters.muscleGroup!) ||
        exercise.secondaryMuscles.includes(activeFilters.muscleGroup!)
      );
    }

    // Apply equipment filter
    if (activeFilters.equipment) {
      exercises = exercises.filter(exercise => exercise.equipment.includes(activeFilters.equipment!));
    }

    // Separate available and hidden exercises based on user filters
    if (userFilters) {
      const available = exercises.filter(exercise => !userFilters.excludedWorkoutIds.includes(exercise.id));
      const hidden = exercises.filter(exercise => userFilters.excludedWorkoutIds.includes(exercise.id));
      setFilteredExercises(available);
      setHiddenExercises(hidden);
    } else {
      setFilteredExercises(exercises);
      setHiddenExercises([]);
    }
  };

  // Group exercises by equipment type
  const groupExercisesByEquipment = (exercises: Workout[]) => {
    const equipmentOrder = ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable'];
    const grouped: Record<string, Workout[]> = {};

    // Initialize groups
    equipmentOrder.forEach(eq => {
      grouped[eq] = [];
    });

    // Group exercises by their primary equipment
    exercises.forEach(exercise => {
      const primaryEquipment = exercise.equipment[0] || 'bodyweight';
      if (grouped[primaryEquipment]) {
        grouped[primaryEquipment].push(exercise);
      } else {
        // If equipment not in our main categories, add to 'other'
        if (!grouped['other']) grouped['other'] = [];
        grouped['other'].push(exercise);
      }
    });

    // Remove empty groups
    Object.keys(grouped).forEach(key => {
      if (grouped[key].length === 0) {
        delete grouped[key];
      }
    });

    return grouped;
  };

  const renderBodyPartFilters = () => {
    const muscleGroups: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

    return (
      <View style={styles.filterSection}>
        <Text style={[
          styles.filterSectionTitle,
          {
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_600SemiBold',
          }
        ]}>
          Body Parts
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersScrollContent}
        >
          {muscleGroups.map(muscle => (
            <TouchableOpacity
              key={muscle}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilters.muscleGroup === muscle 
                    ? currentTheme.colors.primary 
                    : currentTheme.colors.surface,
                  borderColor: activeFilters.muscleGroup === muscle 
                    ? currentTheme.colors.primary 
                    : currentTheme.colors.border,
                }
              ]}
              onPress={() => setActiveFilters(prev => ({ 
                ...prev, 
                muscleGroup: prev.muscleGroup === muscle ? null : muscle 
              }))}
            >
              <Text style={[
                styles.filterChipText,
                {
                  color: activeFilters.muscleGroup === muscle 
                    ? currentTheme.colors.background 
                    : currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                {muscle.charAt(0).toUpperCase() + muscle.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderGeneralFilters = () => {
    const categories: WorkoutCategory[] = ['compound', 'isolation', 'cardio'];
    const equipment: Equipment[] = ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable'];

    return (
      <View style={styles.filterSection}>
        <Text style={[
          styles.filterSectionTitle,
          {
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_600SemiBold',
          }
        ]}>
          Equipment & Categories
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersScrollContent}
        >
          {/* Equipment filters first */}
          {equipment.map(eq => (
            <TouchableOpacity
              key={eq}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilters.equipment === eq 
                    ? currentTheme.colors.primary 
                    : currentTheme.colors.surface,
                  borderColor: activeFilters.equipment === eq 
                    ? currentTheme.colors.primary 
                    : currentTheme.colors.border,
                }
              ]}
              onPress={() => setActiveFilters(prev => ({ 
                ...prev, 
                equipment: prev.equipment === eq ? null : eq 
              }))}
            >
              <Text style={[
                styles.filterChipText,
                {
                  color: activeFilters.equipment === eq 
                    ? currentTheme.colors.background 
                    : currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                {eq.charAt(0).toUpperCase() + eq.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Category filters second */}
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilters.category === category 
                    ? currentTheme.colors.primary 
                    : currentTheme.colors.surface,
                  borderColor: activeFilters.category === category 
                    ? currentTheme.colors.primary 
                    : currentTheme.colors.border,
                }
              ]}
              onPress={() => setActiveFilters(prev => ({ 
                ...prev, 
                category: prev.category === category ? null : category 
              }))}
            >
              <Text style={[
                styles.filterChipText,
                {
                  color: activeFilters.category === category 
                    ? currentTheme.colors.background 
                    : currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Clear filters if any active */}
          {getActiveFilterCount() > 0 && (
            <TouchableOpacity
              style={[
                styles.clearFiltersChip,
                {
                  backgroundColor: currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                }
              ]}
              onPress={clearFilters}
            >
              <Ionicons name="close" size={16} color={currentTheme.colors.text} />
              <Text style={[
                styles.filterChipText,
                {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  const handleExercisePress = (exercise: Workout) => {
    // Toggle expansion for this exercise
    if (expandedExerciseId === exercise.id) {
      setExpandedExerciseId(null);
    } else {
      setExpandedExerciseId(exercise.id);
      // Reset config values when expanding
      setConfigSets('3');
      setConfigReps('8-12');
    }
  };

  const handleAddExercise = (exercise: Workout) => {
    console.log('🎯 [EXERCISE] Adding exercise:', exercise.name, 'Sets:', configSets, 'Reps:', configReps);
    
    // Dismiss keyboard first
    Keyboard.dismiss();
    
    const options: ExerciseOptions = {
      sets: parseInt(configSets) || 3,
      reps: configReps || '8-12',
      weight: ''
    };
    
    onSelectExercise(exercise, options);
    
    // Reset and close
    setExpandedExerciseId(null);
    onClose();
  };

  const handleCancelConfig = () => {
    Keyboard.dismiss();
    setExpandedExerciseId(null);
  };

  // Keyboard toolbar handlers
  const handleKeyboardDone = () => {
    if (activeInputRef) {
      activeInputRef.blur();
    }
    setActiveInputRef(null);
  };

  const handleKeyboardCancel = () => {
    if (activeInputRef) {
      activeInputRef.blur();
    }
    setActiveInputRef(null);
    // Reset to defaults
    setConfigSets('3');
    setConfigReps('8-12');
  };

  const clearFilters = () => {
    setActiveFilters({
      category: null,
      muscleGroup: null,
      equipment: null,
    });
  };

  const getActiveFilterCount = () => {
    return Object.values(activeFilters).filter(Boolean).length;
  };

  const currentExercises = activeTab === 'available' ? filteredExercises : hiddenExercises;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <Text style={[
              styles.title,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_700Bold',
              }
            ]}>
              Add Exercise
            </Text>
            <View style={styles.spacer} />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={[
              styles.searchBar,
              {
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }
            ]}>
              <Ionicons 
                name="search" 
                size={20} 
                color={currentTheme.colors.text} 
                style={{ opacity: 0.5 }} 
              />
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_500Medium',
                  }
                ]}
                placeholder="Search exercises..."
                placeholderTextColor={currentTheme.colors.text + '60'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Filter Chips */}
          <View style={styles.filtersContainer}>
            {renderBodyPartFilters()}
            {renderGeneralFilters()}
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: activeTab === 'available' 
                    ? currentTheme.colors.primary 
                    : 'transparent',
                }
              ]}
              onPress={() => setActiveTab('available')}
            >
              <Text style={[
                styles.tabText,
                {
                  color: activeTab === 'available' 
                    ? currentTheme.colors.background 
                    : currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                Available ({filteredExercises.length})
              </Text>
            </TouchableOpacity>
            {hiddenExercises.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.tab,
                  {
                    backgroundColor: activeTab === 'hidden' 
                      ? currentTheme.colors.primary 
                      : 'transparent',
                  }
                ]}
                onPress={() => setActiveTab('hidden')}
              >
                <Text style={[
                  styles.tabText,
                  {
                    color: activeTab === 'hidden' 
                      ? currentTheme.colors.background 
                      : currentTheme.colors.text,
                      fontFamily: 'Raleway_600SemiBold',
                    }
                  ]}>
                  Hidden ({hiddenExercises.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Exercise List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.exerciseListContainer}
            contentContainerStyle={[
              styles.exerciseListContent,
              { paddingBottom: 20 } // Add padding for bottom panel
            ]}
          >
            {(() => {
              const groupedExercises = groupExercisesByEquipment(currentExercises);
              const groupKeys = Object.keys(groupedExercises);

              if (groupKeys.length === 0) {
                return (
                  <View style={styles.emptyState}>
                    <Ionicons 
                      name={activeTab === 'hidden' ? 'eye-off' : 'search'} 
                      size={48} 
                      color={currentTheme.colors.text + '30'} 
                    />
                    <Text style={[
                      styles.emptyText,
                      {
                        color: currentTheme.colors.text,
                        fontFamily: 'Raleway_500Medium',
                        opacity: 0.6,
                      }
                    ]}>
                      {activeTab === 'hidden' 
                        ? 'No hidden exercises found' 
                        : 'No exercises found'
                      }
                    </Text>
                  </View>
                );
              }

              return groupKeys.map(equipmentType => {
                const exercises = groupedExercises[equipmentType];
                const equipmentDisplayName = equipmentType === 'bodyweight' ? 'Bodyweight' :
                                           equipmentType.charAt(0).toUpperCase() + equipmentType.slice(1);
                
                return (
                  <View key={equipmentType} style={styles.equipmentSection}>
                    <Text style={[
                      styles.equipmentSectionTitle,
                      {
                        color: currentTheme.colors.text,
                        fontFamily: 'Raleway_700Bold',
                      }
                    ]}>
                      {equipmentDisplayName} ({exercises.length})
                    </Text>
                    
                    {exercises.map((exercise) => {
                        const isExpanded = expandedExerciseId === exercise.id;
                        
                        return (
                          <View key={exercise.id}>
                            <TouchableOpacity
                              onPress={() => handleExercisePress(exercise)}
                              style={[
                                styles.exerciseItem,
                                {
                                  backgroundColor: isExpanded 
                                    ? currentTheme.colors.primary + '10' 
                                    : currentTheme.colors.surface,
                                  borderColor: isExpanded 
                                    ? currentTheme.colors.primary 
                                    : currentTheme.colors.border,
                                }
                              ]}
                              activeOpacity={0.7}
                            >
                              <View style={styles.exerciseInfo}>
                                <Text style={[styles.exerciseName, { 
                                  color: currentTheme.colors.text,
                                  fontFamily: 'Raleway_600SemiBold',
                                }]}>
                                  {exercise.name}
                                </Text>
                                <Text style={[styles.exerciseDescription, { 
                                  color: currentTheme.colors.text,
                                  fontFamily: 'Raleway_400Regular',
                                  opacity: 0.7,
                                }]}>
                                  {exercise.primaryMuscles.join(', ')} • {exercise.category}
                                </Text>
                                {exercise.equipment.length > 0 && (
                                  <Text style={[styles.exerciseEquipment, { 
                                    color: currentTheme.colors.text,
                                    fontFamily: 'Raleway_400Regular',
                                    opacity: 0.5,
                                  }]}>
                                    {exercise.equipment.join(', ')}
                                  </Text>
                                )}
                              </View>
                              <Ionicons 
                                name={isExpanded ? "chevron-up" : "add-circle-outline"} 
                                size={24} 
                                color={isExpanded ? currentTheme.colors.primary : currentTheme.colors.text} 
                                style={{ opacity: isExpanded ? 1 : 0.5 }} 
                              />
                            </TouchableOpacity>

                            {/* Inline Configuration Panel */}
                            {isExpanded && (
                              <View style={[styles.configPanel, { 
                                backgroundColor: currentTheme.colors.background,
                                borderColor: currentTheme.colors.border,
                              }]}>
                                <View style={styles.configRow}>
                                  <View style={styles.configItem}>
                                    <Text style={[styles.configLabel, { 
                                      color: currentTheme.colors.text,
                                      fontFamily: 'Raleway_500Medium',
                                    }]}>
                                      Sets
                                    </Text>
                                    <TextInput
                                      style={[styles.configInput, { 
                                        backgroundColor: currentTheme.colors.surface,
                                        borderColor: currentTheme.colors.border,
                                        color: currentTheme.colors.text,
                                        fontFamily: 'Raleway_400Regular',
                                      }]}
                                      value={configSets}
                                      onChangeText={setConfigSets}
                                      keyboardType="numeric"
                                      selectTextOnFocus
                                      inputAccessoryViewID={inputAccessoryViewID}
                                      onFocus={(e) => setActiveInputRef(e.target)}
                                      onBlur={() => setActiveInputRef(null)}
                                    />
                                  </View>

                                  <View style={styles.configItem}>
                                    <Text style={[styles.configLabel, { 
                                      color: currentTheme.colors.text,
                                      fontFamily: 'Raleway_500Medium',
                                    }]}>
                                      Reps
                                    </Text>
                                    <TextInput
                                      style={[styles.configInput, { 
                                        backgroundColor: currentTheme.colors.surface,
                                        borderColor: currentTheme.colors.border,
                                        color: currentTheme.colors.text,
                                        fontFamily: 'Raleway_400Regular',
                                      }]}
                                      value={configReps}
                                      onChangeText={setConfigReps}
                                      placeholder="8-12"
                                      placeholderTextColor={currentTheme.colors.text + '60'}
                                      selectTextOnFocus
                                      inputAccessoryViewID={inputAccessoryViewID}
                                      onFocus={(e) => setActiveInputRef(e.target)}
                                      onBlur={() => setActiveInputRef(null)}
                                    />
                                  </View>
                                </View>

                                <View style={styles.configButtons}>
                                  <TouchableOpacity
                                    onPress={handleCancelConfig}
                                    style={[styles.configButton, styles.cancelButton, { 
                                      backgroundColor: currentTheme.colors.surface,
                                      borderColor: currentTheme.colors.border,
                                    }]}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={[styles.configButtonText, { 
                                      color: currentTheme.colors.text,
                                      fontFamily: 'Raleway_500Medium',
                                    }]}>
                                      Cancel
                                    </Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    onPress={() => handleAddExercise(exercise)}
                                    style={[styles.configButton, styles.addButton, { 
                                      backgroundColor: currentTheme.colors.primary,
                                    }]}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={[styles.configButtonText, { 
                                      color: currentTheme.colors.background,
                                      fontFamily: 'Raleway_600SemiBold',
                                    }]}>
                                      Add Exercise
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                  </View>
                );
              });
            })()}
          </ScrollView>

          {/* Bottom Options Panel */}
          {/* Removed - using direct callbacks instead */}
        </View>
      </Modal>
      
      {/* Keyboard Toolbar */}
      <KeyboardToolbar
        nativeID={inputAccessoryViewID}
        onCancel={handleKeyboardCancel}
        onDone={handleKeyboardDone}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  spacer: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  filtersScroll: {
    paddingHorizontal: 2, // Reduced padding
  },
  filtersScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 6, // Reduced margin
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterChipText: {
    fontSize: 13, // Slightly smaller text
  },
  clearFiltersChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    marginLeft: 6, // Reduced margin
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseListContainer: {
    flex: 1,
  },
  exerciseListContent: {
    paddingHorizontal: 20,
  },
  equipmentSection: {
    marginBottom: 16,
  },
  equipmentSectionTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  exerciseEquipment: {
    fontSize: 11,
  },
  exerciseDescription: {
    fontSize: 12,
    marginBottom: 2,
  },
  configPanel: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  configItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  configLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  configInput: {
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  configButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  configButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    borderColor: 'transparent',
  },
  addButton: {
    borderColor: 'transparent',
  },
  configButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
}); 