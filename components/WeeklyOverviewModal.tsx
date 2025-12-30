import Chart from '@/components/Chart'; // Added import for Chart component
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { calculateWorkoutStats, combineWorkoutStats, formatDistance, formatDuration, WorkoutStats } from '@/lib/utils/utils';
import { getWorkoutByIdWithCustom } from '@/lib/workout/workouts';
import { GeneratedWorkout, TrackingType } from '@/types';
import React, { useMemo } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WeeklyOverviewModalProps {
  visible: boolean;
  onClose: () => void;
  invocationType: 'day' | 'week' | 'volume' | 'time';
  workouts: GeneratedWorkout[];
  selectedDate?: Date;
  weekStartDate?: Date;
  weekEndDate?: Date;
}

const { width: _screenWidth, height: _screenHeight } = Dimensions.get('window');

export default function WeeklyOverviewModal({
  visible,
  onClose,
  invocationType,
  workouts,
  selectedDate,
  weekStartDate: _weekStartDate,
  weekEndDate: _weekEndDate,
}: WeeklyOverviewModalProps) {
  const { currentTheme } = useTheme();
  const { customExercises } = useCustomExercises();

  // Helper to get tracking type for an exercise
  const getTrackingType = (exerciseId: string): TrackingType | undefined => {
    const exerciseInfo = getWorkoutByIdWithCustom(exerciseId, customExercises);
    return exerciseInfo?.trackingType;
  };

  const getWorkoutCategory = (workout: GeneratedWorkout): string => {
    const title = workout.title.toLowerCase();
    
    if (title.includes('push') || title.includes('chest') || title.includes('bench')) {
      return 'push';
    } else if (title.includes('pull') || title.includes('back') || title.includes('deadlift')) {
      return 'pull';
    } else if (title.includes('leg') || title.includes('squat') || title.includes('glute')) {
      return 'legs';
    } else if (title.includes('upper') || title.includes('arm')) {
      return 'upper';
    } else if (title.includes('full') || title.includes('total')) {
      return 'full';
    } else {
      return 'other';
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'push':
        return '#FF6B6B';
      case 'pull':
        return '#4ECDC4';
      case 'legs':
        return '#45B7D1';
      case 'upper':
        return '#FFA726';
      case 'full':
        return '#AB47BC';
      default:
        return currentTheme.colors.accent;
    }
  };

  const analyticsData = useMemo(() => {
    // Calculate combined workout stats using the utility for cardio support
    const workoutStatsList: WorkoutStats[] = workouts.map(workout =>
      calculateWorkoutStats(workout.exercises, getTrackingType)
    );
    const combinedStats = combineWorkoutStats(workoutStatsList);

    const totalVolume = combinedStats.totalVolumeLbs;
    const totalTime = workouts.reduce((sum, workout) => sum + workout.estimatedDuration, 0);
    const totalSets = combinedStats.totalSets;

    const totalReps = workouts.reduce((sum, workout) => {
      return sum + workout.exercises.reduce((exerciseSum, exercise) => {
        return exerciseSum + exercise.completedSets.reduce((setSum, set) => setSum + (set.reps || 0), 0);
      }, 0);
    }, 0);

    // Category breakdown with more detailed metrics
    const categoryBreakdown = workouts.reduce((acc, workout) => {
      const category = getWorkoutCategory(workout);
      if (!acc[category]) {
        acc[category] = { 
          count: 0, 
          volume: 0, 
          time: 0, 
          sets: 0, 
          exercises: 0,
          avgVolume: 0,
          avgTime: 0,
        };
      }
      acc[category].count += 1;
      acc[category].time += workout.estimatedDuration;
      acc[category].exercises += workout.exercises.length;
      
      const workoutSets = workout.exercises.reduce((sum, ex) => sum + ex.completedSets.length, 0);
      acc[category].sets += workoutSets;
      
      const workoutVolume = workout.exercises.reduce((exerciseSum, exercise) => {
        return exerciseSum + exercise.completedSets.reduce((setSum, set) => {
          return setSum + (set.weight * set.reps);
        }, 0);
      }, 0);
      acc[category].volume += workoutVolume;
      
      return acc;
    }, {} as Record<string, { count: number; volume: number; time: number; sets: number; exercises: number; avgVolume: number; avgTime: number }>);

    // Calculate averages
    Object.keys(categoryBreakdown).forEach(category => {
      const data = categoryBreakdown[category];
      data.avgVolume = data.volume / data.count;
      data.avgTime = data.time / data.count;
    });

    // Exercise-specific breakdown
    const exerciseBreakdown = workouts.reduce((acc, workout) => {
      workout.exercises.forEach(exercise => {
        if (!acc[exercise.id]) {
          acc[exercise.id] = {
            name: exercise.id,
            totalVolume: 0,
            totalSets: 0,
            sessions: 0,
            maxWeight: 0,
            totalReps: 0,
          };
        }
        acc[exercise.id].sessions += 1;
        acc[exercise.id].totalSets += exercise.completedSets.length;
        
        exercise.completedSets.forEach(set => {
          acc[exercise.id].totalVolume += set.weight * set.reps;
          acc[exercise.id].totalReps += set.reps;
          acc[exercise.id].maxWeight = Math.max(acc[exercise.id].maxWeight, set.weight);
        });
      });
      return acc;
    }, {} as Record<string, { name: string; totalVolume: number; totalSets: number; sessions: number; maxWeight: number; totalReps: number }>);

    // Get top exercises by volume
    const topExercises = Object.values(exerciseBreakdown)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 5);

    // Weekly patterns (for week view)
    const dailyBreakdown = workouts.reduce((acc, workout) => {
      const day = new Date(workout.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
      if (!acc[day]) {
        acc[day] = { workouts: 0, volume: 0, time: 0 };
      }
      acc[day].workouts += 1;
      acc[day].time += workout.estimatedDuration;
      acc[day].volume += workout.exercises.reduce((sum, ex) => {
        return sum + ex.completedSets.reduce((setSum, set) => setSum + (set.weight * set.reps), 0);
      }, 0);
      return acc;
    }, {} as Record<string, { workouts: number; volume: number; time: number }>);

    return {
      totalVolume,
      totalTime,
      totalSets,
      totalReps,
      categoryBreakdown,
      exerciseBreakdown: topExercises,
      dailyBreakdown,
      avgWorkoutDuration: workouts.length > 0 ? totalTime / workouts.length : 0,
      avgVolumePerWorkout: workouts.length > 0 ? totalVolume / workouts.length : 0,
      // Cardio stats
      hasCardio: combinedStats.hasCardioExercises,
      totalDistanceMeters: combinedStats.totalDistanceMeters,
      totalCardioDurationSeconds: combinedStats.totalCardioDurationSeconds,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getTrackingType is stable
  }, [workouts, customExercises]);

  const formatVolume = (volume: number) => {
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k lbs`;
    }
    return `${volume} lbs`;
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getModalTitle = () => {
    switch (invocationType) {
      case 'day':
        return selectedDate?.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric' 
        }) || 'Day Workouts';
      case 'week':
        return 'Weekly Analysis';
      case 'volume':
        return 'Volume Analytics';
      case 'time':
        return 'Time Analytics';
      default:
        return 'Workout Details';
    }
  };

  const renderDayContent = () => (
    <View style={styles.contentContainer}>
      {workouts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: currentTheme.colors.text }]}>
            No workouts on this day
          </Text>
          <Text style={[styles.emptySubtext, { color: currentTheme.colors.text }]}>
            Consider planning a workout for this day
          </Text>
        </View>
      ) : (
        <>
          {/* Day Summary */}
          <View style={[styles.summaryCard, { backgroundColor: currentTheme.colors.surface }]}>
            <Text style={[styles.summaryTitle, { color: currentTheme.colors.text }]}>
              Day Summary
            </Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
                  {workouts.length}
                </Text>
                <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
                  Workouts
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
                  {formatTime(analyticsData.totalTime)}
                </Text>
                <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
                  Total Time
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
                  {formatVolume(analyticsData.totalVolume)}
                </Text>
                <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
                  Volume
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
                  {analyticsData.totalSets}
                </Text>
                <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
                  Total Sets
                </Text>
              </View>
            </View>
            {/* Cardio stats row */}
            {analyticsData.hasCardio && (analyticsData.totalDistanceMeters > 0 || analyticsData.totalCardioDurationSeconds > 0) && (
              <View style={[styles.summaryGrid, { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: currentTheme.colors.border }]}>
                {analyticsData.totalDistanceMeters > 0 && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
                      {formatDistance(analyticsData.totalDistanceMeters)}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
                      Distance
                    </Text>
                  </View>
                )}
                {analyticsData.totalCardioDurationSeconds > 0 && (
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
                      {formatDuration(analyticsData.totalCardioDurationSeconds)}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
                      Cardio Time
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Workout Details */}
          {workouts.map((workout, index) => (
            <View key={index} style={[styles.workoutCard, { backgroundColor: currentTheme.colors.surface }]}>
              <View style={styles.workoutHeader}>
                <View style={[
                  styles.categoryDot, 
                  { backgroundColor: getCategoryColor(getWorkoutCategory(workout)) }
                ]} />
                <Text style={[styles.workoutTitle, { color: currentTheme.colors.text }]}>
                  {workout.title}
                </Text>
              </View>
              
              <View style={styles.workoutStats}>
                <Text style={[styles.workoutStatText, { color: currentTheme.colors.text }]}>
                  {formatTime(workout.estimatedDuration)} • {workout.exercises.length} exercises
                </Text>
                <Text style={[styles.workoutStatText, { color: currentTheme.colors.text }]}>
                  {workout.exercises.reduce((sum, ex) => sum + ex.completedSets.length, 0)} sets completed
                </Text>
              </View>

              {/* Exercise breakdown */}
              <View style={styles.exerciseBreakdown}>
                <Text style={[styles.breakdownTitle, { color: currentTheme.colors.text }]}>
                  Exercise Details
                </Text>
                {workout.exercises.slice(0, 3).map((exercise, exIndex) => {
                  const exerciseVolume = exercise.completedSets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
                  return (
                    <View key={exIndex} style={styles.exerciseRow}>
                      <Text style={[styles.exerciseName, { color: currentTheme.colors.text }]}>
                        {exercise.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                      <Text style={[styles.exerciseVolume, { color: currentTheme.colors.text }]}>
                        {formatVolume(exerciseVolume)}
                      </Text>
                    </View>
                  );
                })}
                {workout.exercises.length > 3 && (
                  <Text style={[styles.moreExercises, { color: currentTheme.colors.text }]}>
                    +{workout.exercises.length - 3} more exercises
                  </Text>
                )}
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );

  const renderWeekContent = () => (
    <View style={styles.contentContainer}>
      {/* Enhanced Week Summary */}
      <View style={[styles.summaryCard, { backgroundColor: currentTheme.colors.surface }]}>
        <Text style={[styles.summaryTitle, { color: currentTheme.colors.text }]}>
          Weekly Performance
        </Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
              {workouts.length}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Workouts
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
              {formatTime(analyticsData.totalTime)}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Total Time
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
              {formatVolume(analyticsData.totalVolume)}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Total Volume
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
              {formatTime(Math.round(analyticsData.avgWorkoutDuration))}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Avg Duration
            </Text>
          </View>
        </View>
        {/* Cardio stats row */}
        {analyticsData.hasCardio && (analyticsData.totalDistanceMeters > 0 || analyticsData.totalCardioDurationSeconds > 0) && (
          <View style={[styles.summaryGrid, { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: currentTheme.colors.border }]}>
            {analyticsData.totalDistanceMeters > 0 && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
                  {formatDistance(analyticsData.totalDistanceMeters)}
                </Text>
                <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
                  Distance
                </Text>
              </View>
            )}
            {analyticsData.totalCardioDurationSeconds > 0 && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
                  {formatDuration(analyticsData.totalCardioDurationSeconds)}
                </Text>
                <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
                  Cardio Time
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Workout Category Distribution */}
      {Object.keys(analyticsData.categoryBreakdown).length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: currentTheme.colors.surface }]}>
          <Chart
            data={Object.entries(analyticsData.categoryBreakdown).map(([category, data]) => ({
              label: category.charAt(0).toUpperCase() + category.slice(1),
              value: data.count,
              color: getCategoryColor(category),
            }))}
            type="pie"
            height={200}
            title="Workout Category Distribution"
            showValues={true}
          />
        </View>
      )}

      {/* Top Exercises Chart */}
      {analyticsData.exerciseBreakdown.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: currentTheme.colors.surface }]}>
          <Chart
            data={analyticsData.exerciseBreakdown.slice(0, 5).map((exercise) => {
              // Better exercise name truncation
              const cleanName = exercise.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              const truncatedName = cleanName.length > 15 ? cleanName.substring(0, 12) + '...' : cleanName;
              
              return {
                label: truncatedName,
                value: exercise.totalVolume,
                color: currentTheme.colors.primary,
                subtitle: `${exercise.totalSets} sets`,
              };
            })}
            type="horizontal-bar"
            height={200}
            title="Top Exercises by Volume"
            showValues={true}
          />
        </View>
      )}

      {/* Workout Intensity Analysis */}
      {Object.keys(analyticsData.categoryBreakdown).length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: currentTheme.colors.surface }]}>
          <Chart
            data={Object.entries(analyticsData.categoryBreakdown).map(([category, data]) => ({
              label: category.charAt(0).toUpperCase() + category.slice(1),
              value: Math.round(data.avgVolume / data.avgTime * 10) / 10, // Volume per minute
              color: getCategoryColor(category),
            }))}
            type="bar"
            height={180}
            title="Training Intensity (Volume/Min)"
            showValues={true}
          />
        </View>
      )}

      {/* Exercise Performance Breakdown */}
      {analyticsData.exerciseBreakdown.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
            Exercise Performance Breakdown
          </Text>
          {analyticsData.exerciseBreakdown.slice(0, 6).map((exercise, index) => (
            <View key={exercise.name} style={[styles.exerciseBreakdownCard, { backgroundColor: currentTheme.colors.surface }]}>
              <View style={styles.exerciseBreakdownHeader}>
                <Text style={[styles.exerciseBreakdownName, { color: currentTheme.colors.text }]}>
                  {exercise.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
                <View style={[styles.exerciseRankBadge, { backgroundColor: currentTheme.colors.accent }]}>
                  <Text style={[styles.exerciseRankText, { color: '#fff' }]}>
                    #{index + 1}
                  </Text>
                </View>
              </View>
              
              <View style={styles.exerciseMetricsGrid}>
                <View style={styles.exerciseMetricCard}>
                  <Text style={[styles.exerciseMetricValue, { color: currentTheme.colors.accent }]}>
                    {exercise.maxWeight}
                  </Text>
                  <Text style={[styles.exerciseMetricLabel, { color: currentTheme.colors.text }]}>
                    Max Weight (lbs)
                  </Text>
                </View>
                
                <View style={styles.exerciseMetricCard}>
                  <Text style={[styles.exerciseMetricValue, { color: currentTheme.colors.primary }]}>
                    {exercise.totalReps}
                  </Text>
                  <Text style={[styles.exerciseMetricLabel, { color: currentTheme.colors.text }]}>
                    Total Reps
                  </Text>
                </View>
                
                <View style={styles.exerciseMetricCard}>
                  <Text style={[styles.exerciseMetricValue, { color: currentTheme.colors.text }]}>
                    {formatVolume(exercise.totalVolume)}
                  </Text>
                  <Text style={[styles.exerciseMetricLabel, { color: currentTheme.colors.text }]}>
                    Total Volume
                  </Text>
                </View>
                
                <View style={styles.exerciseMetricCard}>
                  <Text style={[styles.exerciseMetricValue, { color: currentTheme.colors.text }]}>
                    {exercise.sessions}
                  </Text>
                  <Text style={[styles.exerciseMetricLabel, { color: currentTheme.colors.text }]}>
                    Sessions
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );

  const renderVolumeContent = () => (
    <View style={styles.contentContainer}>
      <View style={[styles.summaryCard, { backgroundColor: currentTheme.colors.surface }]}>
        <Text style={[styles.summaryTitle, { color: currentTheme.colors.text }]}>
          Volume Analytics
        </Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
              {formatVolume(analyticsData.totalVolume)}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Total Volume
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
              {formatVolume(analyticsData.avgVolumePerWorkout)}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Avg Per Workout
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
              {analyticsData.totalSets}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Total Sets
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.accent }]}>
              {analyticsData.totalReps}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Total Reps
            </Text>
          </View>
        </View>
      </View>

      {/* Volume by Category */}
      <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
        Volume by Workout Type
      </Text>

      {Object.entries(analyticsData.categoryBreakdown).map(([category, data]) => (
        <View key={category} style={[styles.categoryCard, { backgroundColor: currentTheme.colors.surface }]}>
          <View style={styles.categoryHeader}>
            <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(category) }]} />
            <Text style={[styles.categoryName, { color: currentTheme.colors.text }]}>
              {category.charAt(0).toUpperCase() + category.slice(1)} Training
            </Text>
          </View>
          <View style={styles.categoryDetailGrid}>
            <View style={styles.categoryDetailRow}>
              <Text style={[styles.categoryDetailLabel, { color: currentTheme.colors.text }]}>
                Total Volume:
              </Text>
              <Text style={[styles.categoryDetailValue, { color: currentTheme.colors.accent }]}>
                {formatVolume(data.volume)}
              </Text>
            </View>
            <View style={styles.categoryDetailRow}>
              <Text style={[styles.categoryDetailLabel, { color: currentTheme.colors.text }]}>
                Avg per Session:
              </Text>
              <Text style={[styles.categoryDetailValue, { color: currentTheme.colors.text }]}>
                {formatVolume(data.avgVolume)}
              </Text>
            </View>
            <View style={styles.categoryDetailRow}>
              <Text style={[styles.categoryDetailLabel, { color: currentTheme.colors.text }]}>
                Total Sets:
              </Text>
              <Text style={[styles.categoryDetailValue, { color: currentTheme.colors.text }]}>
                {data.sets}
              </Text>
            </View>
            <View style={styles.categoryDetailRow}>
              <Text style={[styles.categoryDetailLabel, { color: currentTheme.colors.text }]}>
                Sessions:
              </Text>
              <Text style={[styles.categoryDetailValue, { color: currentTheme.colors.text }]}>
                {data.count}
              </Text>
            </View>
          </View>
        </View>
      ))}

      {/* Top Volume Contributors */}
      {analyticsData.exerciseBreakdown.length > 0 && (
        <>
          {/* Exercise Volume Chart */}
          <View style={[styles.chartCard, { backgroundColor: currentTheme.colors.surface }]}>
            <Chart
              data={analyticsData.exerciseBreakdown.slice(0, 4).map((exercise) => {
                const cleanName = exercise.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const truncatedName = cleanName.length > 15 ? cleanName.substring(0, 12) + '...' : cleanName;
                
                return {
                  label: truncatedName,
                  value: exercise.totalVolume,
                  color: getCategoryColor('push'),
                };
              })}
              type="bar"
              height={180}
              title="Top 4 Exercises by Volume"
              showValues={true}
            />
          </View>
          
          {/* Exercise Sessions Chart */}
          <View style={[styles.chartCard, { backgroundColor: currentTheme.colors.surface }]}>
            <Chart
              data={analyticsData.exerciseBreakdown.slice(0, 5).map((exercise) => {
                const cleanName = exercise.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const truncatedName = cleanName.length > 15 ? cleanName.substring(0, 12) + '...' : cleanName;
                
                return {
                  label: truncatedName,
                  value: exercise.sessions,
                  color: currentTheme.colors.primary,
                };
              })}
              type="horizontal-bar"
              height={170}
              title="Exercise Frequency (Sessions)"
              showValues={true}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
            Highest Volume Exercises
          </Text>
          {analyticsData.exerciseBreakdown.map((exercise, index) => (
            <View key={exercise.name} style={[styles.exerciseDetailCard, { backgroundColor: currentTheme.colors.surface }]}>
              <View style={styles.exerciseDetailHeader}>
                <View style={styles.exerciseRank}>
                  <Text style={[styles.rankNumber, { color: currentTheme.colors.accent }]}>
                    #{index + 1}
                  </Text>
                  <Text style={[styles.exerciseDetailName, { color: currentTheme.colors.text }]}>
                    {exercise.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </View>
              </View>
              <View style={styles.exerciseMetrics}>
                <View style={styles.exerciseMetricItem}>
                  <Text style={[styles.exerciseMetricValue, { color: currentTheme.colors.accent }]}>
                    {formatVolume(exercise.totalVolume)}
                  </Text>
                  <Text style={[styles.exerciseMetricLabel, { color: currentTheme.colors.text }]}>
                    Volume
                  </Text>
                </View>
                <View style={styles.exerciseMetricItem}>
                  <Text style={[styles.exerciseMetricValue, { color: currentTheme.colors.text }]}>
                    {exercise.maxWeight} lbs
                  </Text>
                  <Text style={[styles.exerciseMetricLabel, { color: currentTheme.colors.text }]}>
                    Max Weight
                  </Text>
                </View>
                <View style={styles.exerciseMetricItem}>
                  <Text style={[styles.exerciseMetricValue, { color: currentTheme.colors.text }]}>
                    {exercise.totalSets}
                  </Text>
                  <Text style={[styles.exerciseMetricLabel, { color: currentTheme.colors.text }]}>
                    Sets
                  </Text>
                </View>
                <View style={styles.exerciseMetricItem}>
                  <Text style={[styles.exerciseMetricValue, { color: currentTheme.colors.text }]}>
                    {exercise.sessions}
                  </Text>
                  <Text style={[styles.exerciseMetricLabel, { color: currentTheme.colors.text }]}>
                    Sessions
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );

  const renderTimeContent = () => (
    <View style={styles.contentContainer}>
      <View style={[styles.summaryCard, { backgroundColor: currentTheme.colors.surface }]}>
        <Text style={[styles.summaryTitle, { color: currentTheme.colors.text }]}>
          Time Analytics
        </Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.primary }]}>
              {formatTime(analyticsData.totalTime)}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Total Time
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.primary }]}>
              {formatTime(Math.round(analyticsData.avgWorkoutDuration))}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Avg Duration
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.primary }]}>
              {workouts.length > 0 ? Math.round(analyticsData.totalTime / workouts.length / 60 * 10) / 10 : 0}h
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Daily Avg
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: currentTheme.colors.primary }]}>
              {workouts.length > 0 ? Math.round(analyticsData.totalVolume / analyticsData.totalTime * 100) / 100 : 0}
            </Text>
            <Text style={[styles.summaryLabel, { color: currentTheme.colors.text }]}>
              Volume/Min
            </Text>
          </View>
        </View>
      </View>

      {/* Time by Category */}
      <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
        Time Distribution by Workout Type
      </Text>
      
      {/* Time Distribution Chart */}
      <View style={[styles.chartCard, { backgroundColor: currentTheme.colors.surface }]}>
        <Chart
          data={Object.entries(analyticsData.categoryBreakdown).map(([category, data]) => ({
            label: category.charAt(0).toUpperCase() + category.slice(1),
            value: data.time,
            color: getCategoryColor(category),
          }))}
          type="horizontal-bar"
          height={180}
          title="Time Distribution (minutes)"
          showValues={true}
        />
      </View>

      {Object.entries(analyticsData.categoryBreakdown).map(([category, data]) => (
        <View key={category} style={[styles.categoryCard, { backgroundColor: currentTheme.colors.surface }]}>
          <View style={styles.categoryHeader}>
            <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(category) }]} />
            <Text style={[styles.categoryName, { color: currentTheme.colors.text }]}>
              {category.charAt(0).toUpperCase() + category.slice(1)} Training
            </Text>
          </View>
          <View style={styles.categoryDetailGrid}>
            <View style={styles.categoryDetailRow}>
              <Text style={[styles.categoryDetailLabel, { color: currentTheme.colors.text }]}>
                Total Time:
              </Text>
              <Text style={[styles.categoryDetailValue, { color: currentTheme.colors.primary }]}>
                {formatTime(data.time)}
              </Text>
            </View>
            <View style={styles.categoryDetailRow}>
              <Text style={[styles.categoryDetailLabel, { color: currentTheme.colors.text }]}>
                Avg Duration:
              </Text>
              <Text style={[styles.categoryDetailValue, { color: currentTheme.colors.text }]}>
                {formatTime(data.avgTime)}
              </Text>
            </View>
            <View style={styles.categoryDetailRow}>
              <Text style={[styles.categoryDetailLabel, { color: currentTheme.colors.text }]}>
                Time Efficiency:
              </Text>
              <Text style={[styles.categoryDetailValue, { color: currentTheme.colors.text }]}>
                {Math.round(data.volume / data.time * 100) / 100} lbs/min
              </Text>
            </View>
            <View style={styles.categoryDetailRow}>
              <Text style={[styles.categoryDetailLabel, { color: currentTheme.colors.text }]}>
                % of Total Time:
              </Text>
              <Text style={[styles.categoryDetailValue, { color: currentTheme.colors.text }]}>
                {Math.round(data.time / analyticsData.totalTime * 100)}%
              </Text>
            </View>
          </View>
        </View>
      ))}

      {/* Daily Time Breakdown */}
      {Object.keys(analyticsData.dailyBreakdown).length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>
            Daily Time Breakdown
          </Text>
          <View style={[styles.categoryCard, { backgroundColor: currentTheme.colors.surface }]}>
            {Object.entries(analyticsData.dailyBreakdown).map(([day, data]) => (
              <View key={day} style={styles.dailyTimeRow}>
                <Text style={[styles.dayName, { color: currentTheme.colors.text }]}>
                  {day}
                </Text>
                <View style={styles.dailyTimeStats}>
                  <Text style={[styles.dailyTimeStat, { color: currentTheme.colors.primary }]}>
                    {formatTime(data.time)}
                  </Text>
                  <Text style={[styles.dailyTimeStat, { color: currentTheme.colors.text }]}>
                    ({data.workouts} session{data.workouts !== 1 ? 's' : ''})
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const renderContent = () => {
    switch (invocationType) {
      case 'day':
        return renderDayContent();
      case 'week':
        return renderWeekContent();
      case 'volume':
        return renderVolumeContent();
      case 'time':
        return renderTimeContent();
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.text + '20' }]}>
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>
            {getModalTitle()}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: currentTheme.colors.accent }]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.scrollView}>
          {renderContent()}
        </ScrollView>
      </View>
    </Modal>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  workoutCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  workoutDate: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.7,
  },
  workoutTime: {
    fontSize: 24,
    opacity: 0.8,
  },
  workoutExercises: {
    fontSize: 24,
    opacity: 0.8,
    marginTop: 4,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 18,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 16,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  summaryItem: {
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 8,
  },
  workoutStats: {
    marginTop: 8,
    marginBottom: 12,
  },
  workoutStatText: {
    fontSize: 16,
    opacity: 0.8,
  },
  exerciseBreakdown: {
    marginTop: 12,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 16,
  },
  exerciseVolume: {
    fontSize: 16,
    color: '#FF6B6B', // Example color for volume
  },
  moreExercises: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  dailyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dayName: {
    fontSize: 16,
  },
  dailyStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyStat: {
    fontSize: 16,
    marginLeft: 15,
  },
  exerciseRankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  exerciseRank: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  exerciseRankStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseRankStat: {
    fontSize: 16,
    marginLeft: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
  },
  categoryDetailGrid: {
    marginTop: 12,
  },
  categoryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryDetailLabel: {
    fontSize: 16,
  },
  categoryDetailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseDetailCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  exerciseDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseDetailName: {
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  exerciseMetricItem: {
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 8,
  },
  exerciseMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  exerciseMetricLabel: {
    fontSize: 16,
    opacity: 0.7,
  },
  dailyTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dailyTimeStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyTimeStat: {
    fontSize: 16,
    marginLeft: 15,
  },
  chartCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  exerciseBreakdownCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  exerciseBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseBreakdownName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  exerciseRankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  exerciseRankText: {
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  exerciseMetricCard: {
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 8,
  },
}); 