import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage';
import { GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BrowseWorkoutEditModal from './BrowseWorkoutEditModal';

interface BrowseWorkoutsModalProps {
  visible: boolean;
  onClose: () => void;
  onImportWorkout?: (workout: GeneratedWorkout) => void;
  title?: string;
}

export default function BrowseWorkoutsModal({ 
  visible, 
  onClose, 
  onImportWorkout,
  title = 'Workout Library'
}: BrowseWorkoutsModalProps) {
  const { currentTheme } = useTheme();
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<GeneratedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<GeneratedWorkout | null>(null);

  const loadWorkouts = async () => {
    try {
      setIsLoading(true);
      const workoutHistory = await storageService.getWorkoutHistory();
      workoutHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setWorkouts(workoutHistory);
      setFilteredWorkouts(workoutHistory);
    } catch (error) {
      setWorkouts([]);
      setFilteredWorkouts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadWorkouts();
    }
  }, [visible]);

  // Simple search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredWorkouts(workouts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = workouts.filter(workout => 
      workout.title.toLowerCase().includes(query) ||
      workout.description.toLowerCase().includes(query)
    );
    setFilteredWorkouts(filtered);
  }, [workouts, searchQuery]);

  const handleCreateWorkout = () => {
    setIsCreateModalVisible(true);
  };

  const handleEditWorkout = (workout: GeneratedWorkout) => {
    setEditingWorkout(workout);
    setIsEditModalVisible(true);
  };

  const handleSaveWorkout = async (workoutData: Partial<GeneratedWorkout>) => {
    try {
      if (editingWorkout) {
        // Update existing
        const updatedWorkout = { ...editingWorkout, ...workoutData };
        await storageService.saveWorkout(updatedWorkout);
      } else {
        // Create new
        const newWorkout: GeneratedWorkout = {
          id: Date.now().toString(),
          title: workoutData.title || 'New Workout',
          description: workoutData.description || '',
          exercises: workoutData.exercises || [],
          createdAt: new Date(),
          estimatedDuration: workoutData.estimatedDuration || 45,
          difficulty: 'intermediate',
          ...workoutData
        };
        await storageService.saveWorkout(newWorkout);
      }
      
      await loadWorkouts();
      setIsEditModalVisible(false);
      setIsCreateModalVisible(false);
      setEditingWorkout(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save workout');
    }
  };

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
              await storageService.deleteWorkout(workoutId);
              await loadWorkouts();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete workout');
            }
          }
        }
      ]
    );
  };

  const handleImportWorkout = (workout: GeneratedWorkout) => {
    if (onImportWorkout) {
      onImportWorkout(workout);
      onClose();
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
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
          
          <TouchableOpacity onPress={handleCreateWorkout} style={styles.addButton}>
            <Ionicons name="add" size={24} color={currentTheme.colors.primary} />
          </TouchableOpacity>
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
                {searchQuery ? 'Try a different search term' : 'Tap the + button to create your first workout'}
              </Text>
            </View>
          ) : (
            <View style={styles.workoutsList}>
              {filteredWorkouts.map((workout) => (
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
                        {formatDate(workout.createdAt)} • {workout.exercises?.length || 0} exercises • ~{workout.estimatedDuration || 45}min
                      </Text>
                    </View>
                    
                    <View style={styles.workoutActions}>
                      <TouchableOpacity
                        onPress={() => handleEditWorkout(workout)}
                        style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface + '40' }]}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="pencil" size={18} color={currentTheme.colors.text} style={{ opacity: 0.7 }} />
                      </TouchableOpacity>
                      
                      {onImportWorkout && (
                        <TouchableOpacity
                          onPress={() => handleImportWorkout(workout)}
                          style={[styles.actionButton, { backgroundColor: currentTheme.colors.primary + '20' }]}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="download-outline" size={18} color={currentTheme.colors.primary} />
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity
                        onPress={() => handleDeleteWorkout(workout.id, workout.title)}
                        style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface + '40' }]}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="trash-outline" size={18} color={currentTheme.colors.text} style={{ opacity: 0.7 }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Edit Modal */}
      <BrowseWorkoutEditModal
        visible={isEditModalVisible}
        onClose={() => {
          setIsEditModalVisible(false);
          setEditingWorkout(null);
        }}
        onSave={handleSaveWorkout}
        workout={editingWorkout}
      />

      {/* Create Modal */}
      <BrowseWorkoutEditModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        onSave={handleSaveWorkout}
        workout={null}
      />
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
  addButton: {
    padding: 8,
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  workoutDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  workoutDate: {
    fontSize: 12,
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 30,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 