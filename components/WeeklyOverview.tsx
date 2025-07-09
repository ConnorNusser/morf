import { useTheme } from '@/contexts/ThemeContext';
import { GeneratedWorkout } from '@/types';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from './Card';
import WeeklyOverviewModal from './WeeklyOverviewModal';

interface WeeklyOverviewProps {
  workoutHistory: GeneratedWorkout[];
}

interface WeekData {
  startDate: Date;
  endDate: Date;
  workouts: GeneratedWorkout[];
  weekDays: {
    date: Date;
    dayNumber: number;
    dayLetter: string;
    hasWorkout: boolean;
    workoutCount: number;
    workoutCategory?: string;
    dayWorkouts: GeneratedWorkout[];
  }[];
}

export default function WeeklyOverview({ workoutHistory }: WeeklyOverviewProps) {
  const { currentTheme } = useTheme();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInvocationType, setModalInvocationType] = useState<'day' | 'week' | 'volume' | 'time'>('day');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [modalWorkouts, setModalWorkouts] = useState<GeneratedWorkout[]>([]);

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

  const getWeekData = (weekOffset: number): WeekData => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to get Monday
    
    const mondayOfWeek = new Date(today);
    mondayOfWeek.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
    mondayOfWeek.setHours(0, 0, 0, 0);
    
    const sundayOfWeek = new Date(mondayOfWeek);
    sundayOfWeek.setDate(mondayOfWeek.getDate() + 6);
    sundayOfWeek.setHours(23, 59, 59, 999);

    const weekWorkouts = workoutHistory.filter(workout => {
      const workoutDate = new Date(workout.createdAt);
      return workoutDate >= mondayOfWeek && workoutDate <= sundayOfWeek;
    });

    const weekDays = [];
    const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayOfWeek);
      date.setDate(mondayOfWeek.getDate() + i);
      
      const dayWorkouts = weekWorkouts.filter(workout => {
        const workoutDate = new Date(workout.createdAt);
        return workoutDate.toDateString() === date.toDateString();
      });
      
      // Get the category of the first workout for the day (if any)
      const firstWorkout = dayWorkouts[0];
      const workoutCategory = firstWorkout ? getWorkoutCategory(firstWorkout) : undefined;
      
      weekDays.push({
        date,
        dayNumber: date.getDate(),
        dayLetter: dayLetters[i],
        hasWorkout: dayWorkouts.length > 0,
        workoutCount: dayWorkouts.length,
        workoutCategory,
        dayWorkouts,
      });
    }

    return {
      startDate: mondayOfWeek,
      endDate: sundayOfWeek,
      workouts: weekWorkouts,
      weekDays,
    };
  };

  const weekData = useMemo(() => getWeekData(currentWeekOffset), [currentWeekOffset, workoutHistory]);

  const weekStats = useMemo(() => {
    const totalWorkouts = weekData.workouts.length;
    const totalTime = weekData.workouts.reduce((sum, workout) => sum + workout.estimatedDuration, 0);
    const totalVolume = weekData.workouts.reduce((sum, workout) => {
      return sum + workout.exercises.reduce((exerciseSum, exercise) => {
        return exerciseSum + exercise.completedSets.reduce((setSum, set) => {
          return setSum + (set.weight * set.reps);
        }, 0);
      }, 0);
    }, 0);

    const formatTime = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) {
        return `${hours}h ${mins}m`;
      }
      return `${mins}m`;
    };

    const formatVolume = (volume: number) => {
      if (volume >= 1000) {
        return `${(volume / 1000).toFixed(1)}k`;
      }
      return volume.toString();
    };

    return {
      totalWorkouts,
      totalTime: formatTime(totalTime),
      totalVolume: formatVolume(Math.round(totalVolume)),
      rawVolume: Math.round(totalVolume),
    };
  }, [weekData.workouts]);

  const formatDateRange = (startDate: Date, endDate: Date) => {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = endDate.getFullYear().toString().slice(-2);
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  };

  const getDayBackgroundColor = (hasWorkout: boolean, workoutCategory?: string) => {
    if (!hasWorkout) return 'transparent';
    if (!workoutCategory) return currentTheme.colors.accent + '20';
    return getCategoryColor(workoutCategory) + '20';
  };

  const getDayTextColor = (hasWorkout: boolean, workoutCategory?: string) => {
    if (!hasWorkout) return currentTheme.colors.text + '60';
    if (!workoutCategory) return currentTheme.colors.accent;
    return getCategoryColor(workoutCategory);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekOffset(prev => direction === 'prev' ? prev - 1 : prev + 1);
  };

  const handleDayPress = (day: WeekData['weekDays'][0]) => {
    setSelectedDate(day.date);
    setModalWorkouts(day.dayWorkouts);
    setModalInvocationType('day');
    setModalVisible(true);
  };

  const handleWeekPress = () => {
    setModalWorkouts(weekData.workouts);
    setModalInvocationType('week');
    setModalVisible(true);
  };

  const handleVolumePress = () => {
    setModalWorkouts(weekData.workouts);
    setModalInvocationType('volume');
    setModalVisible(true);
  };

  const handleTimePress = () => {
    setModalWorkouts(weekData.workouts);
    setModalInvocationType('time');
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedDate(undefined);
    setModalWorkouts([]);
  };

  return (
    <>
      <Card variant="elevated" style={styles.container}>
        {/* Header with navigation */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
            <Text style={[styles.navArrow, { color: currentTheme.colors.text }]}>‹</Text>
          </TouchableOpacity>
          
          <View style={styles.dateContainer}>
            <Text style={[
              styles.workoutSummaryTitle, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_700Bold',
              }
            ]}>
              Workout Summary
            </Text>
            <Text style={[
              styles.dateRange, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
                opacity: 0.6,
              }
            ]}>
              {formatDateRange(weekData.startDate, weekData.endDate)}
            </Text>
          </View>
          
          <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
            <Text style={[styles.navArrow, { color: currentTheme.colors.text }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day numbers with category colors */}
        <View style={styles.daysContainer}>
          {weekData.weekDays.map((day, index) => (
            <View key={index} style={styles.dayColumn}>
              <TouchableOpacity 
                onPress={() => handleDayPress(day)}
                style={[
                  styles.dayButton,
                  { backgroundColor: getDayBackgroundColor(day.hasWorkout, day.workoutCategory) }
                ]}
              >
                <Text style={[
                  styles.dayNumber, 
                  { color: getDayTextColor(day.hasWorkout, day.workoutCategory) }
                ]}>
                  {day.dayNumber}
                </Text>
              </TouchableOpacity>
              <Text style={[
                styles.dayLabel, 
                { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                  opacity: day.hasWorkout ? 1 : 0.5,
                }
              ]}>
                {day.dayLetter}
              </Text>
            </View>
          ))}
        </View>

        {/* Clean Minimalist Statistics */}
        <View style={styles.statsContainer}>
          <TouchableOpacity 
            style={[
              styles.statCard, 
              { backgroundColor: currentTheme.colors.surface }
            ]} 
            onPress={handleWeekPress}
            activeOpacity={0.7}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
              {weekStats.totalWorkouts}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>
              Workouts
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.statCard, 
              { backgroundColor: currentTheme.colors.surface }
            ]} 
            onPress={handleTimePress}
            activeOpacity={0.7}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
              {weekStats.totalTime}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>
              Time
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.statCard, 
              { backgroundColor: currentTheme.colors.surface }
            ]} 
            onPress={handleVolumePress}
            activeOpacity={0.7}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text }]}>
              {weekStats.totalVolume}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text }]}>
              Volume
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      <WeeklyOverviewModal
        visible={modalVisible}
        onClose={handleModalClose}
        invocationType={modalInvocationType}
        workouts={modalWorkouts}
        selectedDate={selectedDate}
        weekStartDate={weekData.startDate}
        weekEndDate={weekData.endDate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  navButton: {
    padding: 8,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  dateContainer: {
    alignItems: 'center',
    flex: 1,
  },
  workoutSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  dateRange: {
    fontSize: 14,
    fontWeight: '500',
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  dayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Raleway_700Bold',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Raleway_700Bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'Raleway_500Medium',
    opacity: 0.7,
  },
}); 