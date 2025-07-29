import { useTheme } from '@/contexts/ThemeContext';
import { useWorkout } from '@/contexts/WorkoutContext';
import { getWorkoutById } from '@/lib/workouts';
import { GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BrowseSectionProps {
  onBrowseRoutines: () => void;
  onBrowseWorkouts: () => void;
  onQuickStartWorkout?: (workout: GeneratedWorkout) => void;
}

export default function BrowseSection({ 
  onBrowseRoutines, 
  onBrowseWorkouts, 
  onQuickStartWorkout 
}: BrowseSectionProps) {
  const { currentTheme } = useTheme();
  const { workouts: standaloneWorkouts } = useWorkout();

  // Filter workouts that have exercises and remove duplicates
  const validWorkouts = standaloneWorkouts
    .filter(workout => workout.exercises && workout.exercises.length > 0)
    .filter((workout, index, self) => 
      index === self.findIndex(w => w.id === workout.id)
    );

  // Get first 3 valid workouts for quick start
  const quickStartWorkouts = validWorkouts.slice(0, 3);

  const handleQuickStart = (workout: GeneratedWorkout) => {
    if (onQuickStartWorkout) {
      onQuickStartWorkout(workout);
    }
  };

  const getExerciseNames = (workout: GeneratedWorkout): string[] => {
    if (!workout.exercises) return [];
    
    return workout.exercises
      .map(exercise => {
        const exerciseDetails = getWorkoutById(exercise.id);
        return exerciseDetails?.name || 'Unknown Exercise';
      })
      .slice(0, 3); // Show max 3 exercise names
  };

  return (
    <View>
      {/* Quick Start Section */}
      {quickStartWorkouts.length > 0 && onQuickStartWorkout && (
        <View style={styles.quickStartSection}>
          <Text style={[styles.sectionTitle, { 
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_700Bold',
          }]}>
            Quick Start
          </Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.quickStartScrollView}
            contentContainerStyle={styles.quickStartContainer}
          >
            {quickStartWorkouts.map((workout) => {
              const exerciseNames = getExerciseNames(workout);
              const hasMoreExercises = workout.exercises && workout.exercises.length > 3;
              
              return (
                <TouchableOpacity
                  key={workout.id}
                  onPress={() => handleQuickStart(workout)}
                  style={[styles.quickStartCard, { 
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  }]}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickStartIcon, { backgroundColor: currentTheme.colors.primary + '20' }]}>
                    <Ionicons name="play" size={20} color={currentTheme.colors.primary} />
                  </View>
                  
                  <Text style={[styles.quickStartTitle, { 
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_600SemiBold',
                  }]} numberOfLines={2}>
                    {workout.title}
                  </Text>
                  
                  <Text style={[styles.quickStartMeta, { 
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                    opacity: 0.6,
                  }]}>
                    {workout.exercises?.length || 0} exercises
                  </Text>

                  {/* Exercise List */}
                  <View style={styles.exercisePreview}>
                    {exerciseNames.map((exerciseName, index) => (
                      <Text 
                        key={index}
                        style={[styles.exercisePreviewText, { 
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_400Regular',
                          opacity: 0.8,
                        }]}
                        numberOfLines={1}
                      >
                        • {exerciseName}
                      </Text>
                    ))}
                    {hasMoreExercises && (
                      <Text style={[styles.exercisePreviewText, { 
                        color: currentTheme.colors.text,
                        fontFamily: 'Raleway_400Regular',
                        opacity: 0.6,
                        fontStyle: 'italic',
                      }]}>
                        +{(workout.exercises?.length || 0) - 3} more
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Browse & Import Section */}
      <Text style={[styles.sectionTitle, { 
        color: currentTheme.colors.text,
        fontFamily: 'Raleway_700Bold',
        marginTop: quickStartWorkouts.length > 0 ? 24 : 0,
      }]}>
        Browse & Import
      </Text>
      
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          onPress={onBrowseRoutines}
          style={[styles.browseButton, { 
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }]}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: currentTheme.colors.primary + '20' }]}>
            <Ionicons name="library-outline" size={24} color={currentTheme.colors.primary} />
          </View>
          <View style={styles.buttonContent}>
            <Text style={[styles.buttonTitle, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Browse Routines
            </Text>
            <Text style={[styles.buttonDescription, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_400Regular',
              opacity: 0.7,
            }]}>
              View and import existing routines
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.colors.text} style={{ opacity: 0.4 }} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBrowseWorkouts}
          style={[styles.browseButton, { 
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }]}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: currentTheme.colors.primary + '20' }]}>
            <Ionicons name="fitness-outline" size={24} color={currentTheme.colors.primary} />
          </View>
          <View style={styles.buttonContent}>
            <Text style={[styles.buttonTitle, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Browse Workouts
            </Text>
            <Text style={[styles.buttonDescription, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_400Regular',
              opacity: 0.7,
            }]}>
              View, edit, and import workouts
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.colors.text} style={{ opacity: 0.4 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickStartSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  quickStartScrollView: {
    marginHorizontal: -20,
  },
  quickStartContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  quickStartCard: {
    width: 160,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickStartIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStartTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  quickStartMeta: {
    fontSize: 12,
    textAlign: 'center',
  },
  exercisePreview: {
    marginTop: 4,
    alignItems: 'center',
    gap: 2,
  },
  exercisePreviewText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 12,
  },
  buttonsContainer: {
    gap: 12,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flex: 1,
    gap: 2,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDescription: {
    fontSize: 13,
    lineHeight: 16,
  },
}); 