import Button from '@/components/Button';
import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage';
import { ALL_WORKOUTS } from '@/lib/workouts';
import { Equipment, MuscleGroup, Workout, WorkoutCategory, WorkoutFilters } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

interface WorkoutFiltersSectionProps {
  onFiltersUpdate?: () => Promise<void>;
}

export default function WorkoutFiltersSection({ onFiltersUpdate }: WorkoutFiltersSectionProps) {
  const { currentTheme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMoreFiltersModal, setShowMoreFiltersModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<WorkoutFilters>({
    excludedWorkoutIds: [],
    workoutType: 'powerlifting', // Default to powerlifting
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    try {
      const savedFilters = await storageService.getWorkoutFilters();
      setFilters(savedFilters);
    } catch (error) {
      console.error('Error loading workout filters:', error);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const getFilterSummary = () => {
    const workoutTypeLabel = filters.workoutType === 'powerlifting' ? 'Powerlifting' : 
                            filters.workoutType === 'bodyweight' ? 'Bodyweight' : 
                            filters.workoutType === 'generic' ? 'General' : 'Powerlifting';
    
    if (filters.excludedWorkoutIds.length === 0) {
      return `${workoutTypeLabel} • ${ALL_WORKOUTS.length} exercises available`;
    }

    const availableCount = ALL_WORKOUTS.length - filters.excludedWorkoutIds.length;
    return `${workoutTypeLabel} • ${availableCount} available • ${filters.excludedWorkoutIds.length} hidden`;
  };

  const handleSaveFilters = async () => {
    try {
      await storageService.saveWorkoutFilters(filters);
      setHasUnsavedChanges(false);
      if (onFiltersUpdate) {
        await onFiltersUpdate();
      }
    } catch (error) {
      console.error('Error saving workout filters:', error);
      Alert.alert('Error', 'Failed to save workout filters');
    }
  };

  const handleClearAllFilters = () => {
    setFilters({ ...filters, excludedWorkoutIds: [] });
    setHasUnsavedChanges(true);
  };

  // Helper functions to get workout IDs by category/muscle/equipment
  const getWorkoutIdsByCategory = (category: WorkoutCategory): string[] => {
    return ALL_WORKOUTS.filter(w => w.category === category).map(w => w.id);
  };

  const getWorkoutIdsByMuscleGroup = (muscleGroup: MuscleGroup): string[] => {
    return ALL_WORKOUTS.filter(w => 
      w.primaryMuscles.includes(muscleGroup) || w.secondaryMuscles.includes(muscleGroup)
    ).map(w => w.id);
  };

  const getWorkoutIdsByEquipment = (equipment: Equipment): string[] => {
    return ALL_WORKOUTS.filter(w => w.equipment.includes(equipment)).map(w => w.id);
  };

  // Check if all workouts in a category/muscle/equipment are filtered
  const isCategoryFullyFiltered = (category: WorkoutCategory): boolean => {
    const categoryWorkoutIds = getWorkoutIdsByCategory(category);
    return categoryWorkoutIds.length > 0 && categoryWorkoutIds.every(id => filters.excludedWorkoutIds.includes(id));
  };

  const isMuscleGroupFullyFiltered = (muscleGroup: MuscleGroup): boolean => {
    const muscleWorkoutIds = getWorkoutIdsByMuscleGroup(muscleGroup);
    return muscleWorkoutIds.length > 0 && muscleWorkoutIds.every(id => filters.excludedWorkoutIds.includes(id));
  };

  const isEquipmentFullyFiltered = (equipment: Equipment): boolean => {
    const equipmentWorkoutIds = getWorkoutIdsByEquipment(equipment);
    return equipmentWorkoutIds.length > 0 && equipmentWorkoutIds.every(id => filters.excludedWorkoutIds.includes(id));
  };

  // Toggle functions for categories/muscles/equipment
  const toggleCategoryFilter = (category: WorkoutCategory) => {
    const categoryWorkoutIds = getWorkoutIdsByCategory(category);
    const isCurrentlyFiltered = isCategoryFullyFiltered(category);
    
    const newExcludedIds = [...filters.excludedWorkoutIds];
    
    if (isCurrentlyFiltered) {
      // Remove all category workouts from filter
      categoryWorkoutIds.forEach(id => {
        const index = newExcludedIds.indexOf(id);
        if (index > -1) newExcludedIds.splice(index, 1);
      });
    } else {
      // Add all category workouts to filter
      categoryWorkoutIds.forEach(id => {
        if (!newExcludedIds.includes(id)) {
          newExcludedIds.push(id);
        }
      });
    }
    
    setFilters({ ...filters, excludedWorkoutIds: newExcludedIds });
    setHasUnsavedChanges(true);
  };

  const toggleMuscleGroupFilter = (muscleGroup: MuscleGroup) => {
    const muscleWorkoutIds = getWorkoutIdsByMuscleGroup(muscleGroup);
    const isCurrentlyFiltered = isMuscleGroupFullyFiltered(muscleGroup);
    
    const newExcludedIds = [...filters.excludedWorkoutIds];
    
    if (isCurrentlyFiltered) {
      muscleWorkoutIds.forEach(id => {
        const index = newExcludedIds.indexOf(id);
        if (index > -1) newExcludedIds.splice(index, 1);
      });
    } else {
      muscleWorkoutIds.forEach(id => {
        if (!newExcludedIds.includes(id)) {
          newExcludedIds.push(id);
        }
      });
    }
    
    setFilters({ ...filters, excludedWorkoutIds: newExcludedIds });
    setHasUnsavedChanges(true);
  };

  const toggleEquipmentFilter = (equipment: Equipment) => {
    const equipmentWorkoutIds = getWorkoutIdsByEquipment(equipment);
    const isCurrentlyFiltered = isEquipmentFullyFiltered(equipment);
    
    const newExcludedIds = [...filters.excludedWorkoutIds];
    
    if (isCurrentlyFiltered) {
      equipmentWorkoutIds.forEach(id => {
        const index = newExcludedIds.indexOf(id);
        if (index > -1) newExcludedIds.splice(index, 1);
      });
    } else {
      equipmentWorkoutIds.forEach(id => {
        if (!newExcludedIds.includes(id)) {
          newExcludedIds.push(id);
        }
      });
    }
    
    setFilters({ ...filters, excludedWorkoutIds: newExcludedIds });
    setHasUnsavedChanges(true);
  };

  const toggleWorkoutFilter = (workoutId: string) => {
    const newExcludedIds = [...filters.excludedWorkoutIds];
    const index = newExcludedIds.indexOf(workoutId);
    
    if (index > -1) {
      newExcludedIds.splice(index, 1);
    } else {
      newExcludedIds.push(workoutId);
    }
    
    setFilters({ ...filters, excludedWorkoutIds: newExcludedIds });
    setHasUnsavedChanges(true);
  };

  const removeWorkoutFilter = (workoutId: string) => {
    const newExcludedIds = filters.excludedWorkoutIds.filter(id => id !== workoutId);
    setFilters({ ...filters, excludedWorkoutIds: newExcludedIds });
    setHasUnsavedChanges(true);
  };

  // Quick filter items (most commonly used)
  const quickFilters = {
    categories: [
      { key: 'compound', label: 'Compound' },
      { key: 'isolation', label: 'Isolation' },
      { key: 'cardio', label: 'Cardio' },
    ] as const,
    muscles: [
      { key: 'chest', label: 'Chest' },
      { key: 'back', label: 'Back' },
      { key: 'legs', label: 'Legs' },
      { key: 'arms', label: 'Arms' },
    ] as const,
    equipment: [
      { key: 'bodyweight', label: 'Bodyweight' },
      { key: 'machine', label: 'Machine' },
      { key: 'barbell', label: 'Barbell' },
    ] as const,
  };

  // Get smart active filters for display
  const getActiveFilters = () => {
    const active = [];
    
    // Check for fully filtered categories
    quickFilters.categories.forEach(cat => {
      if (isCategoryFullyFiltered(cat.key)) {
        active.push({ 
          type: 'category', 
          value: cat.key, 
          label: cat.label,
          onRemove: () => toggleCategoryFilter(cat.key)
        });
      }
    });
    
    // Check for fully filtered muscle groups
    quickFilters.muscles.forEach(muscle => {
      if (isMuscleGroupFullyFiltered(muscle.key)) {
        active.push({ 
          type: 'muscle', 
          value: muscle.key, 
          label: muscle.label,
          onRemove: () => toggleMuscleGroupFilter(muscle.key)
        });
      }
    });
    
    // Check for fully filtered equipment
    quickFilters.equipment.forEach(eq => {
      if (isEquipmentFullyFiltered(eq.key)) {
        active.push({ 
          type: 'equipment', 
          value: eq.key, 
          label: eq.label,
          onRemove: () => toggleEquipmentFilter(eq.key)
        });
      }
    });

    // Add individual workouts that aren't part of a fully filtered category
    const individualWorkouts = filters.excludedWorkoutIds.filter(workoutId => {
      const workout = ALL_WORKOUTS.find(w => w.id === workoutId);
      if (!workout) return false;
      
      // Don't show individual workouts if their whole category is filtered
      if (isCategoryFullyFiltered(workout.category)) return false;
      
      // Don't show if all their muscle groups are filtered
      if (workout.primaryMuscles.every(muscle => isMuscleGroupFullyFiltered(muscle))) return false;
      
      // Don't show if all their equipment is filtered
      if (workout.equipment.every(eq => isEquipmentFullyFiltered(eq))) return false;
      
      return true;
    });

    // Group individual workouts if there are too many
    if (individualWorkouts.length > 3) {
      active.push({
        type: 'individual',
        value: 'multiple',
        label: `${individualWorkouts.length} exercises`,
        onRemove: () => setShowMoreFiltersModal(true)
      });
    } else {
      individualWorkouts.forEach(workoutId => {
        const workout = ALL_WORKOUTS.find(w => w.id === workoutId);
        if (workout) {
          active.push({
            type: 'workout',
            value: workoutId,
            label: workout.name,
            onRemove: () => removeWorkoutFilter(workoutId)
          });
        }
      });
    }

    return active;
  };

  const renderQuickFilterChip = (
    item: { key: string; label: string },
    isActive: boolean,
    onToggle: () => void,
    count: number
  ) => {
    return (
      <TouchableOpacity
        key={item.key}
        style={[
          styles.quickChip,
          {
            backgroundColor: isActive 
              ? currentTheme.colors.primary 
              : currentTheme.colors.surface,
            borderColor: isActive 
              ? currentTheme.colors.primary 
              : currentTheme.colors.border,
          }
        ]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.quickChipText,
          {
            color: isActive 
              ? 'white' 
              : currentTheme.colors.text,
            fontFamily: 'Raleway_500Medium',
          }
        ]}>
          {item.label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderActiveFilterChip = (filter: { 
    type: string; 
    value: string; 
    label: string; 
    onRemove: () => void;
  }) => (
    <TouchableOpacity
      key={`${filter.type}-${filter.value}`}
      style={[
        styles.activeChip,
        {
          backgroundColor: currentTheme.colors.primary + '20',
          borderColor: currentTheme.colors.primary,
        }
      ]}
      onPress={filter.onRemove}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.activeChipText,
        {
          color: currentTheme.colors.primary,
          fontFamily: 'Raleway_500Medium',
        }
      ]}>
        {filter.label}
      </Text>
      <Ionicons
        name="close-circle"
        size={16}
        color={currentTheme.colors.primary}
      />
    </TouchableOpacity>
  );

  const renderMoreFiltersModal = () => {
    const getFilteredWorkouts = () => {
      if (!searchQuery.trim()) return ALL_WORKOUTS;
      
      return ALL_WORKOUTS.filter(workout =>
        workout.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        workout.primaryMuscles.some(muscle => 
          muscle.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    };

    const groupedWorkouts = getFilteredWorkouts().reduce((acc, workout) => {
      const category = workout.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(workout);
      return acc;
    }, {} as Record<WorkoutCategory, Workout[]>);

    return (
      <Modal
        visible={showMoreFiltersModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity 
              onPress={() => setShowMoreFiltersModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={[
                styles.modalTitle,
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                Filter Individual Exercises
              </Text>
              <Text style={[
                styles.modalSubtitle,
                { 
                  color: currentTheme.colors.text + '70',
                  fontFamily: 'Raleway_400Regular',
                }
              ]}>
                {ALL_WORKOUTS.length - filters.excludedWorkoutIds.length} of {ALL_WORKOUTS.length} available
              </Text>
            </View>
            <TouchableOpacity 
              onPress={handleClearAllFilters}
              style={styles.modalClearButton}
            >
              <Text style={[
                styles.modalClearText,
                { 
                  color: currentTheme.colors.primary,
                  fontFamily: 'Raleway_500Medium',
                }
              ]}>
                Clear All
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchContainer, { borderColor: currentTheme.colors.border }]}>
            <Ionicons name="search" size={20} color={currentTheme.colors.text + '60'} />
            <TextInput
              style={[
                styles.searchInput,
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                }
              ]}
              placeholder="Search exercises..."
              placeholderTextColor={currentTheme.colors.text + '60'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={currentTheme.colors.text + '60'} />
              </TouchableOpacity>
            )}
          </View>

          {/* Exercise List */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {Object.entries(groupedWorkouts).map(([category, workouts]) => {
              const availableInCategory = workouts.filter(w => !filters.excludedWorkoutIds.includes(w.id)).length;
              const totalInCategory = workouts.length;
              
              return (
                <View key={category} style={styles.exerciseGroup}>
                  <Text style={[
                    styles.exerciseGroupTitle,
                    { 
                      color: currentTheme.colors.text,
                      fontFamily: 'Raleway_600SemiBold',
                    }
                  ]}>
                    {category.charAt(0).toUpperCase() + category.slice(1)} ({availableInCategory}/{totalInCategory})
                  </Text>
                  {workouts.map((workout) => {
                    const isFiltered = filters.excludedWorkoutIds.includes(workout.id);
                    return (
                      <TouchableOpacity
                        key={workout.id}
                        style={[
                          styles.exerciseItem,
                          {
                            backgroundColor: isFiltered
                              ? currentTheme.colors.surface
                              : 'transparent',
                            opacity: isFiltered ? 0.6 : 1,
                          }
                        ]}
                        onPress={() => toggleWorkoutFilter(workout.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.exerciseInfo}>
                          <Text style={[
                            styles.exerciseName,
                            { 
                              color: currentTheme.colors.text,
                              fontFamily: 'Raleway_500Medium',
                              textDecorationLine: isFiltered ? 'line-through' : 'none',
                            }
                          ]}>
                            {workout.name}
                          </Text>
                          <Text style={[
                            styles.exerciseMuscles,
                            { 
                              color: currentTheme.colors.text + '70',
                              fontFamily: 'Raleway_400Regular',
                              textDecorationLine: isFiltered ? 'line-through' : 'none',
                            }
                          ]}>
                            {workout.primaryMuscles.join(', ')}
                          </Text>
                        </View>
                        <View style={[
                          styles.filterToggle,
                          {
                            backgroundColor: isFiltered 
                              ? '#EF4444' 
                              : currentTheme.colors.primary,
                          }
                        ]}>
                          <Ionicons
                            name={isFiltered ? 'close' : 'checkmark'}
                            size={16}
                            color="white"
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
            
            {Object.keys(groupedWorkouts).length === 0 && searchQuery && (
              <Text style={[
                styles.noResultsText,
                { 
                  color: currentTheme.colors.text + '60',
                  fontFamily: 'Raleway_400Regular',
                }
              ]}>
                No exercises found for "{searchQuery}"
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const activeFilters = getActiveFilters();

  return (
    <Card style={styles.filtersCard} variant="clean">
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={[styles.sectionHeaderContent, { backgroundColor: 'transparent' }]}>
          <Text style={[
            styles.sectionTitle, 
            { 
              color: currentTheme.colors.text,
              fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
            }
          ]}>
            Workout Filters
          </Text>
          {!isExpanded && (
            <Text style={[
              styles.filtersSubtitle, 
              { 
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              {getFilterSummary()}
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
        <View style={styles.filtersContent}>
          {/* Summary */}
          <View style={[
            styles.summarySection,
            { backgroundColor: currentTheme.colors.surface }
          ]}>
            <Text style={[
              styles.summaryText,
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              {getFilterSummary()}
            </Text>
          </View>

          {/* Training Style Selection */}
          <View style={styles.workoutTypeSection}>
            <View style={styles.trainingStyleHeader}>
              <Text style={[
                styles.sectionLabel,
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                Training Style
              </Text>
              <Text style={[
                styles.sectionDescription,
                { 
                  color: currentTheme.colors.text + '70',
                  fontFamily: 'Raleway_400Regular',
                }
              ]}>
                Choose your primary training approach
              </Text>
            </View>
            <View style={styles.workoutTypeButtons}>
              {[
                { key: 'powerlifting', label: 'Powerlifting' },
                { key: 'generic', label: 'General' },
                { key: 'bodyweight', label: 'Bodyweight' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.workoutTypeButton,
                    {
                      backgroundColor: filters.workoutType === type.key 
                        ? currentTheme.colors.primary 
                        : currentTheme.colors.surface,
                      borderColor: filters.workoutType === type.key 
                        ? currentTheme.colors.primary 
                        : currentTheme.colors.border,
                    }
                  ]}
                  onPress={() => {
                    setFilters({ ...filters, workoutType: type.key as any });
                    setHasUnsavedChanges(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text 
                    style={[
                      styles.workoutTypeText,
                      {
                        color: filters.workoutType === type.key ? 'white' : currentTheme.colors.text,
                        fontFamily: 'Raleway_500Medium',
                      }
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.8}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <View style={styles.activeFiltersSection}>
              <Text style={[
                styles.sectionLabel,
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                Active Filters
              </Text>
              <Text style={[
                styles.sectionDescription,
                { 
                  color: currentTheme.colors.text + '70',
                  fontFamily: 'Raleway_400Regular',
                }
              ]}>
                Tap any filter to remove it and include those exercises again
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.activeFiltersScroll}
              >
                {activeFilters.map(filter => renderActiveFilterChip(filter))}
              </ScrollView>
            </View>
          )}

          {/* Exercise Exclusions */}
          <View style={[
            styles.quickFiltersSection, 
            styles.exerciseExclusionsSection,
            { borderTopColor: currentTheme.colors.border }
          ]}>
            <View style={styles.trainingStyleHeader}>
              <Text style={[
                styles.sectionLabel,
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                Exercise Exclusions
              </Text>
              <Text style={[
                styles.sectionDescription,
                { 
                  color: currentTheme.colors.text + '70',
                  fontFamily: 'Raleway_400Regular',
                }
              ]}>
                Hide exercises you can't do or don't want
              </Text>
            </View>
            
                          <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.quickFiltersScroll}
              >
                {quickFilters.categories.map(item => {
                  const categoryWorkouts = getWorkoutIdsByCategory(item.key);
                  const availableCount = categoryWorkouts.filter(id => !filters.excludedWorkoutIds.includes(id)).length;
                  return renderQuickFilterChip(
                    item, 
                    isCategoryFullyFiltered(item.key),
                    () => toggleCategoryFilter(item.key),
                    availableCount
                  );
                })}
                {quickFilters.muscles.map(item => {
                  const muscleWorkouts = getWorkoutIdsByMuscleGroup(item.key);
                  const availableCount = muscleWorkouts.filter(id => !filters.excludedWorkoutIds.includes(id)).length;
                  return renderQuickFilterChip(
                    item, 
                    isMuscleGroupFullyFiltered(item.key),
                    () => toggleMuscleGroupFilter(item.key),
                    availableCount
                  );
                })}
                {quickFilters.equipment.map(item => {
                  const equipmentWorkouts = getWorkoutIdsByEquipment(item.key);
                  const availableCount = equipmentWorkouts.filter(id => !filters.excludedWorkoutIds.includes(id)).length;
                  return renderQuickFilterChip(
                    item, 
                    isEquipmentFullyFiltered(item.key),
                    () => toggleEquipmentFilter(item.key),
                    availableCount
                  );
                })}
              </ScrollView>
          </View>

          {/* More Filters Button */}
          <TouchableOpacity
            style={[
              styles.moreFiltersButton,
              {
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }
            ]}
            onPress={() => setShowMoreFiltersModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options" size={20} color={currentTheme.colors.text} />
            <Text style={[
              styles.moreFiltersText,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              Filter Individual Exercises
            </Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '60'} />
          </TouchableOpacity>

          {/* Save Button */}
          {hasUnsavedChanges && (
            <Button
              title="Save Filters"
              onPress={handleSaveFilters}
              variant="primary"
              size="large"
            />
          )}
        </View>
      )}

      {renderMoreFiltersModal()}
    </Card>
  );
}

const styles = StyleSheet.create({
  filtersCard: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filtersSubtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  filtersContent: {
    paddingTop: 16,
    gap: 20,
  },
  summarySection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 16,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeFiltersSection: {
    gap: 8,
  },
  activeFiltersScroll: {
    marginLeft: -4,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  activeChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickFiltersSection: {
    gap: 8,
  },
  quickFiltersScroll: {
    marginLeft: -4,
  },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  moreFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  moreFiltersText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },

  workoutTypeSection: {
    gap: 12,
  },
  trainingStyleHeader: {
    gap: 4,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 16,
  },
  exerciseExclusionsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  workoutTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  workoutTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  workoutTypeText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  modalClearButton: {
    padding: 4,
  },
  modalClearText: {
    fontSize: 16,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  exerciseGroup: {
    marginBottom: 24,
  },
  exerciseGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  exerciseMuscles: {
    fontSize: 14,
    opacity: 0.8,
  },
  filterToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 40,
  },
}); 