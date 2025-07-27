import { useTheme } from '@/contexts/ThemeContext';
import { GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface WorkoutAction {
  id: string;
  title: string;
  icon: string;
  color?: string;
  onPress: (workout: GeneratedWorkout) => void;
}

interface WorkoutCardProps {
  workout: GeneratedWorkout;
  actions?: WorkoutAction[];
  onPress?: (workout: GeneratedWorkout) => void;
  showSource?: boolean;
  compact?: boolean;
}

export default function WorkoutCard({
  workout,
  actions = [],
  onPress,
  showSource = true,
  compact = false
}: WorkoutCardProps) {
  const { currentTheme } = useTheme();

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

  const handleCardPress = () => {
    if (onPress) {
      onPress(workout);
    }
  };

  const cardContent = (
    <View style={[
      styles.workoutCard, 
      { 
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      },
      compact && styles.compactCard
    ]}>
      <View style={styles.workoutHeader}>
        <View style={styles.workoutInfo}>
          <Text style={[styles.workoutTitle, { 
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_700Bold',
          }]}>
            {workout.title}
          </Text>
          
          {!compact && workout.description && (
            <Text style={[styles.workoutDescription, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_400Regular',
              opacity: 0.7,
            }]}>
              {workout.description}
            </Text>
          )}
          
          <View style={styles.workoutMeta}>
            <Text style={[styles.workoutMetaText, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_400Regular',
              opacity: 0.5,
            }]}>
              {formatDate(workout.createdAt)} • {workout.exercises?.length || 0} exercises • ~{workout.estimatedDuration || 45}min
              {showSource && ` • ${getWorkoutSource(workout)}`}
            </Text>
          </View>
        </View>
        
        {actions.length > 0 && (
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
                  size={compact ? 16 : 18} 
                  color={action.color || currentTheme.colors.text} 
                  style={!action.color ? { opacity: 0.7 } : {}} 
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  if (onPress && !actions.length) {
    return (
      <TouchableOpacity onPress={handleCardPress} activeOpacity={0.7}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  workoutCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  compactCard: {
    marginBottom: 8,
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
    marginBottom: 6,
  },
  workoutMeta: {
    marginTop: 2,
  },
  workoutMetaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 