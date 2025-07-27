import Button from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import PreviousWorkoutCard from '@/components/PreviousWorkoutCard';
import PreviousWorkoutDetailsModal from '@/components/PreviousWorkoutDetailsModal';
import WorkoutFiltersSection from '@/components/profile/WorkoutFiltersSection';
import BrowseSection from '@/components/routine/BrowseSection';
import MyRoutinesSection from '@/components/routine/MyRoutinesSection';
import RoutinesModal from '@/components/routine/RoutinesModal';
import UnifiedWorkoutBrowserModal from '@/components/routine/UnifiedWorkoutBrowserModal';
import UnifiedWorkoutEditorModal from '@/components/routine/UnifiedWorkoutEditorModal';
import { Text, View } from '@/components/Themed';
import WorkoutModal from '@/components/WorkoutModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkout } from '@/contexts/WorkoutContext';
import { useWorkoutSessionContext } from '@/contexts/WorkoutSessionContext';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { aiWorkoutService } from '@/lib/aiWorkoutService';
import { storageService } from '@/lib/storage';
import { userService } from '@/lib/userService';
import { GeneratedWorkout, UserProgress, WorkoutSplit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

export default function WorkoutScreen() {
  const { currentTheme } = useTheme();
  const { 
    activeSession, 
    openWorkoutModal: openGlobalWorkoutModal  } = useWorkoutSessionContext();
  const { createWorkout: createStandaloneWorkout } = useWorkout();
  
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);
  const [previousWorkoutModalVisible, setPreviousWorkoutModalVisible] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [selectedPreviousWorkout, setSelectedPreviousWorkout] = useState<GeneratedWorkout | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<GeneratedWorkout[]>([]);
  const [showPreviousWorkouts, setShowPreviousWorkouts] = useState(false);
  const [routinesModalVisible, setRoutinesModalVisible] = useState(false);
  const [browseWorkoutsModalVisible, setBrowseWorkoutsModalVisible] = useState(false);
  const [browseForImportVisible, setBrowseForImportVisible] = useState(false);
  const [createWorkoutModalVisible, setCreateWorkoutModalVisible] = useState(false);
  const [editWorkoutModalVisible, setEditWorkoutModalVisible] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<GeneratedWorkout | null>(null);
  const [selectedDay, setSelectedDay] = useState(0); // Track selected day from routine scheduler
  const [selectedDayName, setSelectedDayName] = useState('Monday'); // Track selected day name

  // Add workout timer for active session
  const { formattedTime: activeWorkoutTime } = useWorkoutTimer(activeSession?.startTime || null);

  useEffect(() => {
    loadUserData();
    loadWorkoutHistory();
  }, []);

  // Refresh data when activeSession changes (especially when it becomes null after completion)
  useEffect(() => {
    if (!activeSession) {
      // Session was cleared, refresh data
      loadUserData();
      loadWorkoutHistory();
    }
  }, [activeSession]);

  const loadUserData = async () => {
    try {
      // Get real user progress from recorded lifts
      const realProgress = await userService.calculateRealUserProgress();
      
      setUserProgress(realProgress);
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserProgress([]);
    }
  };

  const loadWorkoutHistory = async () => {
    try {
      const history = await storageService.getWorkoutHistory();
      // Sort by most recent first
      const sortedHistory = history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setWorkoutHistory(sortedHistory);
    } catch (error) {
      console.error('Error loading workout history:', error);
      setWorkoutHistory([]);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
      loadWorkoutHistory();
    }, [])
  );

  const handleGenerateWorkout = async () => {
    setIsGenerating(true);
    
    try {
      // Get user preferences, real profile, workout history, and filters
      const preferences = await storageService.getUserPreferences();
      const userProfile = await userService.getUserProfileOrDefault();
      const workoutHistory = await storageService.getWorkoutHistory();
      const workoutFilters = await storageService.getWorkoutFilters();
      
      // Use real user progress if available, otherwise use empty array
      const progressToUse = userProgress.length > 0 ? userProgress : [];
      
      // Generate AI workout with real user data, history, and filters
      const workout = await aiWorkoutService.generateWorkout({
        userProfile: userProfile,
        userProgress: progressToUse,
        availableEquipment: preferences.preferredEquipment as any,
        workoutHistory: workoutHistory,
        workoutFilters: workoutFilters,
        preferences: {
          duration: preferences.workoutDuration,
          excludeBodyweight: preferences.excludeBodyweight,
        }
      });
      
      setGeneratedWorkout(workout);
      setWorkoutModalVisible(true);
    } catch (error) {
      console.error('Error generating workout:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateWorkout = async (workoutType?: WorkoutSplit, previousWorkout?: GeneratedWorkout) => {
    // Get user preferences, real profile, workout history, and filters
    const preferences = await storageService.getUserPreferences();
    const userProfile = await userService.getUserProfileOrDefault(); // Always returns a profile
    const workoutHistory = await storageService.getWorkoutHistory();
    const workoutFilters = await storageService.getWorkoutFilters();
    
    // Use real user progress if available, otherwise use empty array
    const progressToUse = userProgress.length > 0 ? userProgress : [];
    
    // Generate AI workout with real user data, history, and filters (with optional workoutType override)
    // Pass the previousWorkout parameter for variation
    const workout = await aiWorkoutService.generateWorkout({
      userProfile: userProfile,
      userProgress: progressToUse,
      availableEquipment: preferences.preferredEquipment as any,
      workoutHistory: workoutHistory,
      workoutFilters: workoutFilters,
      preferences: {
        duration: preferences.workoutDuration,
        excludeBodyweight: preferences.excludeBodyweight,
      }
    }, undefined, workoutType, previousWorkout);
    
    return workout;
  };

  const handleStartWorkout = async () => {
    if (generatedWorkout) {
      // Close the generate workout modal
      setWorkoutModalVisible(false);
      
      // Open the global workout session modal
      openGlobalWorkoutModal(generatedWorkout);
      
      // Clear local state
      setGeneratedWorkout(null);
    } else {
      console.error('❌ No generated workout available to start');
    }
  };

  const handleResumeWorkout = async () => {
    if (activeSession) {
      // Create a GeneratedWorkout object from the active session for the modal
      const workoutForModal: GeneratedWorkout = {
        id: activeSession.workoutId,
        title: activeSession.title,
        description: `Resume workout with ${activeSession.exercises.length} exercises`,
        exercises: activeSession.exercises.map((ex: any) => ({
          id: ex.id,
          sets: ex.sets,
          reps: ex.reps,
          completedSets: ex.completedSets,
          isCompleted: ex.isCompleted,
        })),
        estimatedDuration: 45,
        difficulty: 'In Progress',
        createdAt: activeSession.startTime,
      };
      
      openGlobalWorkoutModal(workoutForModal);
    }
  };

  const handleWorkoutUpdate = (updatedWorkout: GeneratedWorkout) => {
    setGeneratedWorkout(updatedWorkout);
  };

  const handleCloseModal = () => {
    setWorkoutModalVisible(false);
    setGeneratedWorkout(null);
  };

  const handlePreviousWorkoutPress = (workout: GeneratedWorkout) => {
    // Set the selected previous workout and open the details modal
    setSelectedPreviousWorkout(workout);
    setPreviousWorkoutModalVisible(true);
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    try {
      await userService.deleteWorkoutAndLifts(workoutId);
      
      // Refresh data after deletion
      await loadUserData();
      await loadWorkoutHistory();
      
      // Close modal if the deleted workout was being viewed
      if (selectedPreviousWorkout?.id === workoutId) {
        setPreviousWorkoutModalVisible(false);
        setSelectedPreviousWorkout(null);
      }
      
      Alert.alert('Success', 'Workout deleted successfully');
    } catch (error) {
      console.error('Error deleting workout:', error);
      Alert.alert('Error', 'Failed to delete workout. Please try again.');
    }
  };

  const handleBrowseRoutines = () => {
    setRoutinesModalVisible(true);
  };

  const handleSelectedDayChange = useCallback((day: number, dayName: string) => {
    setSelectedDay(day);
    setSelectedDayName(dayName);
  }, []);

  const handleBrowseWorkouts = () => {
    setBrowseWorkoutsModalVisible(true);
  };

  const handleImportWorkout = (workout: GeneratedWorkout) => {
    // Import workout directly to the generate modal
    console.log('Import workout to generate:', workout.title);
    setGeneratedWorkout(workout);
    setWorkoutModalVisible(true);
  };

  const handleOpenImportModal = () => {
    setBrowseForImportVisible(true);
  };

  const handleImportForEditing = (workout: GeneratedWorkout) => {
    // Import workout for editing in the WorkoutModal
    setGeneratedWorkout(workout);
    setBrowseForImportVisible(false);
    setWorkoutModalVisible(true);
  };

  const handleCreateNewWorkout = () => {
    setCreateWorkoutModalVisible(true);
  };

  const handleSaveNewWorkout = async (workoutData: Partial<GeneratedWorkout>) => {
    try {
      // Create the workout using the workout context
      await createStandaloneWorkout(workoutData as GeneratedWorkout);
      setCreateWorkoutModalVisible(false);
      
      // Optionally, import the new workout into the generate modal
      if (workoutData.id) {
        const newWorkout = workoutData as GeneratedWorkout;
        setGeneratedWorkout(newWorkout);
        setWorkoutModalVisible(true);
      }
    } catch (error) {
      console.error('Error creating workout:', error);
    }
  };

  const handleEditWorkout = (workout: GeneratedWorkout) => {
    setEditingWorkout(workout);
    setBrowseWorkoutsModalVisible(false);
    setTimeout(() => setEditWorkoutModalVisible(true), 100);
  };

  const handleSaveEditedWorkout = async (workoutData: Partial<GeneratedWorkout>) => {
    try {
      if (editingWorkout) {
        const updatedWorkout = { ...editingWorkout, ...workoutData };
        await createStandaloneWorkout(updatedWorkout);
        setEditWorkoutModalVisible(false);
        setEditingWorkout(null);
      }
    } catch (error) {
      console.error('Error updating workout:', error);
    }
  };

  const handleDeleteWorkoutFromBrowser = async (workoutId: string, workoutTitle: string) => {
    // This will be handled by the UnifiedWorkoutBrowserModal itself
  };

  const handleStartSelectedDayWorkout = async () => {
    try {
      // Get current routine
      const currentRoutine = await storageService.getCurrentRoutine();
      
      if (!currentRoutine) {
        Alert.alert(
          'No Routine Selected', 
          'Please select a routine first to start the workout.',
          [
            { text: 'OK' },
            { text: 'Browse Routines', onPress: () => setRoutinesModalVisible(true) }
          ]
        );
        return;
      }

      // Convert day index to day name for filtering
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const selectedDayNameLower = dayNames[selectedDay];

      // Find workouts for the selected day
      const dayWorkouts = currentRoutine.exercises.filter(workout => workout.dayOfWeek === selectedDayNameLower);

      if (dayWorkouts.length === 0) {
        Alert.alert(
          'No Workout Scheduled', 
          `No workouts scheduled for ${selectedDayName}. Would you like to generate a workout instead?`,
          [
            { text: 'Cancel' },
            { text: 'Generate Workout', onPress: handleGenerateWorkout }
          ]
        );
        return;
      }

      // If there's exactly one workout, start it directly
      if (dayWorkouts.length === 1) {
        openGlobalWorkoutModal(dayWorkouts[0]);
        return;
      }

      // If multiple workouts, let user choose (for now, just start the first one)
      openGlobalWorkoutModal(dayWorkouts[0]);
      
    } catch (error) {
      console.error('Error starting selected day workout:', error);
      Alert.alert('Error', 'Failed to start workout. Please try again.');
    }
  };

  const hasActiveSession = activeSession && !activeSession.isCompleted;

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.content, { backgroundColor: 'transparent' }]}>

          {/* Resume Active Workout */}
          {hasActiveSession && activeSession && (
            <Card style={StyleSheet.flatten([
              styles.resumeCard,
              { backgroundColor: currentTheme.colors.accent + '20' }
            ])} variant="elevated">
              <View style={[styles.resumeContent, { backgroundColor: 'transparent' }]}>
                <View style={[styles.resumeTextContent, { backgroundColor: 'transparent' }]}>
                  <View style={[styles.resumeHeader, { backgroundColor: 'transparent' }]}>
                    <Text style={[
                      styles.resumeTitle, 
                      { 
                        color: currentTheme.colors.accent,
                        fontFamily: 'Raleway_700Bold',
                      }
                    ]}>
                      Workout In Progress
                    </Text>
                    <Text style={[
                      styles.workoutTime, 
                      { 
                        color: currentTheme.colors.primary,
                        fontFamily: 'Raleway_600SemiBold',
                      }
                    ]}>
                      {activeWorkoutTime}
                    </Text>
                  </View>
                  <Text style={[
                    styles.resumeDescription, 
                    { 
                      color: currentTheme.colors.text, 
                      opacity: 0.8,
                      fontFamily: 'Raleway_400Regular',
                    }
                  ]}>
                    {activeSession.title} • Exercise {activeSession.currentExerciseIndex + 1}/{activeSession.exercises.length}
                  </Text>
                </View>
              </View>
              
              <Button
                title="Resume Workout"
                onPress={handleResumeWorkout}
                variant="primary"
                size="large"
                style={styles.resumeButton}
              />
            </Card>
          )}

          {/* Quick Actions Section */}
          <View style={[styles.quickActionsSection, { backgroundColor: 'transparent' }]}>
            <Text style={[
              styles.quickActionsTitle,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              Quick Actions
            </Text>
            
            <View style={[styles.actionButtonsContainer, { backgroundColor: 'transparent' }]}>
              <Button
                title={`Start ${selectedDayName}'s Workout`}
                onPress={handleStartSelectedDayWorkout}
                variant="primary"
                size="medium"
                style={styles.actionButton}
                hapticType="light"      
              />
              
              <Button
                title={isGenerating ? "Generating..." : "Generate Workout"}
                onPress={handleGenerateWorkout}
                variant="secondary"
                size="medium"
                style={styles.actionButton}
                disabled={isGenerating}
                hapticType="light"
              />
            </View>
          </View>

          {/* My Routines Section - MOVED TO SECOND POSITION */}
          <MyRoutinesSection 
            onOpenBrowseRoutines={() => setRoutinesModalVisible(true)} 
            onSelectedDayChange={handleSelectedDayChange}
          />

          {/* Browse Section */}
          <BrowseSection
            onBrowseRoutines={handleBrowseRoutines}
            onBrowseWorkouts={handleBrowseWorkouts}
          />

          {/* Workout Filters - MOVED TO BOTTOM */}
          <WorkoutFiltersSection 
            onFiltersUpdate={async () => {
              await loadUserData();
            }}
          />

          {/* Previous Workouts Section - Collapsible */}
          {workoutHistory.length > 0 && (
            <View style={[styles.previousWorkoutsContainer, { backgroundColor: 'transparent' }]}>
              <TouchableOpacity 
                onPress={() => setShowPreviousWorkouts(!showPreviousWorkouts)}
                style={styles.previousWorkoutsHeader}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.previousWorkoutsTitle,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_500Medium',
                  }
                ]}>
                  Previous Workouts ({workoutHistory.length})
                </Text>
                <Ionicons
                  name={showPreviousWorkouts ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={currentTheme.colors.text}
                  style={{ opacity: 0.6 }}
                />
              </TouchableOpacity>
              
              {showPreviousWorkouts && (
                <>
                  <Divider />
                  {workoutHistory.slice(0, 5).map((workout) => (
                    <PreviousWorkoutCard
                      key={workout.id}
                      workout={workout}
                      onPress={() => handlePreviousWorkoutPress(workout)}
                      onDelete={handleDeleteWorkout}
                    />
                  ))}
                  {workoutHistory.length > 5 && (
                    <TouchableOpacity 
                      style={styles.viewAllButton}
                      onPress={() => {
                        // TODO: Implement view all previous workouts
                        Alert.alert('Coming Soon', 'View all workouts functionality is being developed!');
                      }}
                    >
                      <Text style={[
                        styles.viewAllText,
                        { 
                          color: currentTheme.colors.accent,
                          fontFamily: 'Raleway_500Medium',
                        }
                      ]}>
                        View All {workoutHistory.length} Workouts
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}
        </View>
        <View style={{ marginBottom: 120 }} />
      </ScrollView>

      <WorkoutModal
        visible={workoutModalVisible}
        onClose={handleCloseModal}
        workout={generatedWorkout}
        onStartWorkout={handleStartWorkout}
        onRegenerateWorkout={handleRegenerateWorkout}
        onWorkoutUpdate={handleWorkoutUpdate}
        onOpenImportModal={handleOpenImportModal}
      />

      <PreviousWorkoutDetailsModal
        visible={previousWorkoutModalVisible}
        onClose={() => setPreviousWorkoutModalVisible(false)}
        workout={selectedPreviousWorkout}
        onDelete={handleDeleteWorkout}
      />

      <RoutinesModal
        visible={routinesModalVisible}
        onClose={() => setRoutinesModalVisible(false)}
        onRoutineCreated={() => {
          // Trigger refresh of MyRoutinesSection
          // No longer needed, context handles updates
        }}
      />

      <UnifiedWorkoutBrowserModal
        visible={browseWorkoutsModalVisible}
        onClose={() => setBrowseWorkoutsModalVisible(false)}
        onImportWorkout={handleImportWorkout}
        onEditWorkout={handleEditWorkout}
        source="standalone"
        mode="browse"
        showCreateNew={true}
        onCreateNew={handleCreateNewWorkout}
      />

      {/* Separate unified browser for importing into WorkoutModal */}
      <UnifiedWorkoutBrowserModal
        visible={browseForImportVisible}
        onClose={() => setBrowseForImportVisible(false)}
        onImportWorkout={handleImportForEditing}
        title="Import Workout to Edit"
        source="standalone"
        mode="import"
        showCreateNew={true}
        onCreateNew={handleCreateNewWorkout}
      />

      {/* Create New Workout Modal */}
      <UnifiedWorkoutEditorModal
        visible={createWorkoutModalVisible}
        onClose={() => setCreateWorkoutModalVisible(false)}
        onSave={handleSaveNewWorkout}
        workout={null}
        mode="create"
        title="Create New Workout"
        saveButtonText="Create Workout"
      />

      {/* Edit Workout Modal */}
      <UnifiedWorkoutEditorModal
        visible={editWorkoutModalVisible}
        onClose={() => {
          setEditWorkoutModalVisible(false);
          setEditingWorkout(null);
        }}
        onSave={handleSaveEditedWorkout}
        workout={editingWorkout}
        mode="edit"
        title="Edit Workout"
        saveButtonText="Save Changes"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 80,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  generateButton: {
    marginBottom: 24,
  },
  actionButtonsContainer: {
    marginBottom: 12,
  },
  actionButton: {
    marginBottom: 12,
  },
  emptyStateCard: {
    marginTop: 8,
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  resumeCard: {
    marginBottom: 24,
  },
  resumeContent: {
    marginBottom: 16,
  },
  resumeTextContent: {
    flex: 1,
  },
  resumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resumeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  workoutTime: {
    fontSize: 16,
    fontWeight: '600',
  },
  resumeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  resumeButton: {
    marginTop: 8,
  },
  previousWorkoutsContainer: {
    marginTop: 24,
  },
  previousWorkoutsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  previousWorkoutsTitle: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickActionsSection: {
    marginBottom: 6,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
}); 