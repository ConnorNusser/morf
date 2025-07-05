import Card from '@/components/Card';
import { Text } from '@/components/Themed';
import { getWorkoutById } from '@/lib/workouts';
import { ActiveWorkoutSession } from '@/types';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

interface WorkoutProgressBarProps {
  session: ActiveWorkoutSession;
  themeColors: any;
  onExerciseSelect: (index: number) => void;
  currentExerciseIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export const WorkoutProgressBar: React.FC<WorkoutProgressBarProps> = ({
  session,
  themeColors,
  onExerciseSelect,
  currentExerciseIndex,
  isExpanded,
  onToggle
}) => {
  const completedExercises = session.exercises.filter(ex => ex.isCompleted).length;
  
  return (
    <Card style={styles.progressCard} variant="subtle">
      <Pressable onPress={onToggle} style={[styles.progressHeader, { backgroundColor: 'transparent' }]}>
        <View style={[styles.progressInfo, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.progressTitle, { color: themeColors.text }]}>
            Progress: {completedExercises}/{session.exercises.length}
          </Text>
          <View style={[styles.progressBarContainer, { backgroundColor: 'transparent' }]}>
            <View style={[styles.progressBarTrack, { backgroundColor: themeColors.border }]}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    backgroundColor: themeColors.primary,
                    width: `${(completedExercises / session.exercises.length) * 100}%`
                  }
                ]} 
              />
            </View>
          </View>
        </View>
        <Text style={[styles.expandIcon, { color: themeColors.text }]}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </Pressable>
      
      {isExpanded && (
        <View style={[styles.exerciseList, { backgroundColor: 'transparent' }]}>
          {session.exercises.map((exercise, index) => {
            const exerciseDetails = getWorkoutById(exercise.id);
            const isActive = index === currentExerciseIndex;
            const isCompleted = exercise.isCompleted;
            const completedSets = exercise.completedSets.length;
            
            return (
              <Pressable 
                key={index}
                style={[
                  styles.exerciseItem,
                  {
                    backgroundColor: isActive 
                      ? themeColors.primary + '15' 
                      : 'transparent',
                    borderLeftWidth: isActive ? 3 : 0,
                    borderLeftColor: themeColors.primary,
                  }
                ]}
                onPress={() => onExerciseSelect(index)}
              >
                <View style={[
                  styles.exerciseIndicator,
                  { 
                    backgroundColor: isCompleted 
                      ? themeColors.accent 
                      : isActive 
                        ? themeColors.primary 
                        : themeColors.text + '30'
                  }
                ]}>
                  <Text style={[
                    styles.exerciseIndicatorText, 
                    { color: isCompleted || isActive ? 'white' : themeColors.text }
                  ]}>
                    {isCompleted ? '✓' : index + 1}
                  </Text>
                </View>
                
                <View style={[styles.exerciseItemInfo, { backgroundColor: 'transparent' }]}>
                  <Text style={[
                    styles.exerciseItemName, 
                    { color: themeColors.text }
                  ]} numberOfLines={1}>
                    {exerciseDetails?.name || 'Unknown'}
                  </Text>
                  <Text style={[
                    styles.exerciseItemSets, 
                    { color: themeColors.text, opacity: 0.6 }
                  ]}>
                    {completedSets}/{exercise.sets} sets
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  progressCard: {
    marginBottom: 12,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressInfo: {
    flex: 1,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBarContainer: {
    marginRight: 16,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  expandIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  exerciseList: {
    marginTop: 12,
    gap: 4,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  exerciseIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseIndicatorText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  exerciseItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  exerciseItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseItemSets: {
    fontSize: 12,
    marginTop: 2,
  },
}); 