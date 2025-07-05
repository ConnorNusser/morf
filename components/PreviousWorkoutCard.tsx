import Card from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { GeneratedWorkout } from '@/types';
import React from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PreviousWorkoutCardProps {
  workout: GeneratedWorkout;
  onPress?: () => void;
  onDelete?: (workoutId: string) => void;
}

export default function PreviousWorkoutCard({ workout, onPress, onDelete }: PreviousWorkoutCardProps) {
  const { currentTheme } = useTheme();

  const handleLongPress = () => {
    if (!onDelete) return;
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'View Details', 'Delete Workout'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex: number) => {
          if (buttonIndex === 1) {
            onPress?.();
          } else if (buttonIndex === 2) {
            handleDelete();
          }
        }
      );
    } else {
      // Android fallback
      handleDelete();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workout.title}"? This will also remove any recorded lifts from this workout.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(workout.id),
        },
      ]
    );
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return '#10B981'; // Green
      case 'intermediate':
        return '#F59E0B'; // Yellow
      case 'advanced':
        return '#EF4444'; // Red
      case 'elite':
        return '#8B5CF6'; // Purple
      default:
        return currentTheme.colors.primary;
    }
  };

  return (
    <TouchableOpacity 
      onPress={onPress} 
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <Card variant="clean" style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={[
              styles.workoutTitle, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              {workout.title}
            </Text>
            <Text style={[
              styles.workoutDate, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              {formatDate(workout.createdAt)}
            </Text>
          </View>
          
          <View style={[
            styles.difficultyBadge, 
            { backgroundColor: getDifficultyColor(workout.difficulty) }
          ]}>
            <Text style={[
              styles.difficultyText,
              { fontFamily: 'Raleway_500Medium' }
            ]}>
              {workout.difficulty}
            </Text>
          </View>
        </View>

        <Text style={[
          styles.workoutDescription, 
          { 
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_400Regular',
          }
        ]}>
          {workout.description}
        </Text>

        <View style={styles.footer}>
          <View style={styles.exerciseInfo}>
            <Text style={[
              styles.exerciseCount, 
              { 
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              {workout.exercises.length} exercises
            </Text>
            <Text style={[
              styles.duration, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              ~{workout.estimatedDuration} min
            </Text>
          </View>
          
          <Text style={[
            styles.viewButton, 
            { 
              color: currentTheme.colors.primary,
              fontFamily: 'Raleway_500Medium',
            }
          ]}>
            View →
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleSection: {
    flex: 1,
    marginRight: 12,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  workoutDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  workoutDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  exerciseCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  duration: {
    fontSize: 12,
    opacity: 0.7,
  },
  viewButton: {
    fontSize: 13,
    fontWeight: '500',
  },
}); 