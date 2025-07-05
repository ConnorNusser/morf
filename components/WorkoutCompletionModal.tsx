import Button from '@/components/Button';
import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getWorkoutById } from '@/lib/workouts';
import { ActiveWorkoutSession } from '@/types';
import React from 'react';
import { Modal, ScrollView, StyleSheet } from 'react-native';

interface WorkoutCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  workoutSession: ActiveWorkoutSession | null;
  workoutStats: {
    duration: number;
    totalSets: number;
    totalVolume: number;
    progressUpdates: number;
  } | null;
}

export default function WorkoutCompletionModal({
  visible,
  onClose,
  workoutSession,
  workoutStats
}: WorkoutCompletionModalProps) {
  const { currentTheme } = useTheme();

  console.log('🎉 WorkoutCompletionModal - visible:', visible, 'hasData:', !!workoutSession && !!workoutStats);

  if (!workoutSession || !workoutStats) {
    return null;
  }

  const completedExercises = workoutSession.exercises.filter(ex => ex.completedSets.length > 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={[styles.header, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.celebrationIcon, { color: currentTheme.colors.primary }]}>🎉</Text>
            <Text style={[
              styles.title, 
              { 
                color: currentTheme.colors.text,
                fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_700Bold',
              }
            ]}>
              Workout Complete!
            </Text>
            <Text style={[
              styles.subtitle, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              {workoutSession.title}
            </Text>
          </View>

          {/* Stats Overview */}
          <Card style={styles.statsCard} variant="elevated">
            <Text style={[
              styles.sectionTitle, 
              { 
                color: currentTheme.colors.text,
                fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
              }
            ]}>
              Workout Summary
            </Text>
            
            <View style={[styles.statsGrid, { backgroundColor: 'transparent' }]}>
              <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.statValue, { color: currentTheme.colors.primary }]}>
                  {workoutStats.duration}m
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>
                  Duration
                </Text>
              </View>
              
              <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.statValue, { color: currentTheme.colors.accent }]}>
                  {workoutStats.totalSets}
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>
                  Sets Completed
                </Text>
              </View>
              
              <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
                  {Math.round(workoutStats.totalVolume / 1000)}k
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>
                  Total Volume
                </Text>
              </View>
            </View>
          </Card>

          {/* Progress Updates */}
          {workoutStats.progressUpdates > 0 && (
            <Card style={styles.progressCard} variant="subtle">
              <Text style={[
                styles.sectionTitle, 
                { 
                  color: currentTheme.colors.primary,
                  fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
                }
              ]}>
                💪 Strength Records Updated!
              </Text>
              <Text style={[
                styles.progressText, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                }
              ]}>
                {workoutStats.progressUpdates} lift{workoutStats.progressUpdates > 1 ? 's' : ''} recorded to track your progress
              </Text>
            </Card>
          )}

          {/* Exercise Breakdown */}
          <Card style={styles.exercisesCard} variant="clean">
            <Text style={[
              styles.sectionTitle, 
              { 
                color: currentTheme.colors.text,
                fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
              }
            ]}>
              Exercises Completed
            </Text>
            
            {completedExercises.length > 0 ? (
              completedExercises.map((exercise, index) => {
                const workoutDetails = getWorkoutById(exercise.id);
                const bestSet = exercise.completedSets.reduce((best, current) => {
                  const currentScore = current.weight * current.reps;
                  const bestScore = best.weight * best.reps;
                  return currentScore > bestScore ? current : best;
                });

                return (
                  <View 
                    key={exercise.id} 
                    style={[
                      styles.exerciseRow, 
                      { 
                        borderBottomColor: currentTheme.colors.border,
                        backgroundColor: 'transparent',
                      }
                    ]}
                  >
                    <View style={[styles.exerciseInfo, { backgroundColor: 'transparent' }]}>
                      <Text style={[
                        styles.exerciseName, 
                        { 
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_500Medium',
                        }
                      ]}>
                        {workoutDetails?.name || exercise.id}
                      </Text>
                      <Text style={[
                        styles.exerciseStats, 
                        { 
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_400Regular',
                        }
                      ]}>
                        {exercise.completedSets.length} sets • Best: {bestSet.weight}{bestSet.unit} × {bestSet.reps}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={[styles.noExercisesContainer, { backgroundColor: 'transparent' }]}>
                <Text style={[
                  styles.noExercisesText, 
                  { 
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                  }
                ]}>
                  No exercises were completed during this session.
                </Text>
                <Text style={[
                  styles.noExercisesSubtext, 
                  { 
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                  }
                ]}>
                  Next time, try completing some sets to track your progress!
                </Text>
              </View>
            )}
          </Card>

        </ScrollView>

        {/* Bottom Actions */}
        <View style={[styles.bottomActions, { backgroundColor: 'transparent' }]}>
          <Button
            title="Awesome!"
            onPress={onClose}
            variant="primary"
            size="large"
            style={styles.closeButton}
            hapticType="light"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  celebrationIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.8,
  },
  statsCard: {
    marginBottom: 20,
    padding: 24,
  },
  progressCard: {
    marginBottom: 20,
    padding: 20,
    alignItems: 'center',
  },
  exercisesCard: {
    marginBottom: 20,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  progressText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  exerciseStats: {
    fontSize: 14,
    opacity: 0.7,
  },
  bottomActions: {
    padding: 20,
    paddingBottom: 40,
  },
  closeButton: {
    width: '100%',
  },
  noExercisesContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noExercisesText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  noExercisesSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
}); 