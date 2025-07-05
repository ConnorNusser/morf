import Button from '@/components/Button';
import Card from '@/components/Card';
import Divider from '@/components/Divider';
import PreviousWorkoutCard from '@/components/PreviousWorkoutCard';
import PreviousWorkoutDetailsModal from '@/components/PreviousWorkoutDetailsModal';
import { Text, View } from '@/components/Themed';
import WorkoutModal from '@/components/WorkoutModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkoutSessionContext } from '@/contexts/WorkoutSessionContext';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { aiWorkoutService } from '@/lib/aiWorkoutService';
import { storageService } from '@/lib/storage';
import { userService } from '@/lib/userService';
import { GeneratedWorkout, UserProgress } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet } from 'react-native';

export default function WorkoutScreen() {
  const { currentTheme } = useTheme();
  const { 
    activeSession, 
    openWorkoutModal: openGlobalWorkoutModal  } = useWorkoutSessionContext();
  
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);
  const [previousWorkoutModalVisible, setPreviousWorkoutModalVisible] = useState(false);
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [selectedPreviousWorkout, setSelectedPreviousWorkout] = useState<GeneratedWorkout | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<GeneratedWorkout[]>([]);

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
      // Get user preferences, real profile, and workout history
      const preferences = await storageService.getUserPreferences();
      const userProfile = await userService.getUserProfileOrDefault();
      const workoutHistory = await storageService.getWorkoutHistory();
      
      // Use real user progress if available, otherwise use empty array
      const progressToUse = userProgress.length > 0 ? userProgress : [];
      
      // Generate AI workout with real user data and history
      const workout = await aiWorkoutService.generateWorkout({
        userProfile: userProfile,
        userProgress: progressToUse,
        availableEquipment: preferences.preferredEquipment as any,
        workoutHistory: workoutHistory,
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

  const handleRegenerateWorkout = async (workoutType?: string) => {
    // Get user preferences, real profile, and workout history
    const preferences = await storageService.getUserPreferences();
    const userProfile = await userService.getUserProfileOrDefault(); // Always returns a profile
    const workoutHistory = await storageService.getWorkoutHistory();
    
    // Use real user progress if available, otherwise use empty array
    const progressToUse = userProgress.length > 0 ? userProgress : [];
    
    // Generate AI workout with real user data and history (with optional workoutType override)
    const workout = await aiWorkoutService.generateWorkout({
      userProfile: userProfile,
      userProgress: progressToUse,
      availableEquipment: preferences.preferredEquipment as any,
      workoutHistory: workoutHistory,
      preferences: {
        duration: preferences.workoutDuration,
        excludeBodyweight: preferences.excludeBodyweight,
      }
    }, undefined, workoutType);
    
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

          {/* AI Workout Generation */}
          <Card style={styles.generateCard} variant="elevated">
            <View style={[styles.generateContent, { backgroundColor: 'transparent' }]}>
              <Image
                source={require('@/assets/images/splash-icon.png')}
                style={[styles.generateIcon, { width: 96, height: 96, marginRight: 16 }]}
                resizeMode="contain"
              />
              <View style={[styles.generateTextContent, { backgroundColor: 'transparent' }]}>
                <Text style={[
                  styles.generateTitle, 
                  { 
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_700Bold',
                  }
                ]}>
                  Morf the AI Trainer
                </Text>
                <Text style={[
                  styles.generateDescription, 
                  { 
                    color: currentTheme.colors.text, 
                    opacity: 0.8,
                    fontFamily: 'Raleway_400Regular',
                  }
                ]}>
                  Get an intelligent workout based on your training history, progress, and preferences
                </Text>
              </View>
            </View>
            
            <Button
              title={isGenerating ? "Generating workout..." : "Generate My Workout"}
              onPress={handleGenerateWorkout}
              variant="primary"
              size="large"
              style={styles.generateButton}
              disabled={isGenerating}
              hapticType="light"      
            />
          </Card>

          {/* Previous Workouts Section */}
          {workoutHistory.length > 0 && (
            <>
              <Text style={[
                styles.sectionTitle,
                {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                Previous Workouts
              </Text>
              
              <Divider />
              
              {workoutHistory.map((workout) => (
                <PreviousWorkoutCard
                  key={workout.id}
                  workout={workout}
                  onPress={() => handlePreviousWorkoutPress(workout)}
                  onDelete={handleDeleteWorkout}
                />
              ))}
            </>
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
      />

      <PreviousWorkoutDetailsModal
        visible={previousWorkoutModalVisible}
        onClose={() => setPreviousWorkoutModalVisible(false)}
        workout={selectedPreviousWorkout}
        onDelete={handleDeleteWorkout}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 160,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  headerCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 12,
  },
  statsPreview: {
    marginTop: 8,
  },
  statsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  generateCard: {
    marginBottom: 24,
    padding: 20,
  },
  generateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  generateIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  generateTextContent: {
    flex: 1,
  },
  generateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  generateDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  generateButton: {
    marginTop: 8,
  },
  viewAllButton: {
    marginBottom: 24,
  },
  quickStatsCard: {
    marginBottom: 24,
    padding: 20,
  },
  quickStatsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  quickStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  resumeCard: {
    marginBottom: 24,
    padding: 20,
  },
  resumeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resumeIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  resumeTextContent: {
    flex: 1,
  },
  resumeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resumeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  resumeButton: {
    marginTop: 8,
  },
  centeredContainerFullHeight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  generateIconLarge: {
    width: 96,
    height: 96,
    marginRight: 16,
  },
  resumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  workoutTime: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 