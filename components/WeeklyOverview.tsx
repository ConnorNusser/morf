import { useTheme } from '@/contexts/ThemeContext';
import { GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
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
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = current week, -1 = last week, +1 = next week
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

  const getWeekData = (weekOffset: number = 0): WeekData => {
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

  const weekData = useMemo(() => getWeekData(currentWeekOffset), [workoutHistory, currentWeekOffset]);

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
      return `${startMonth} ${startDay}-${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
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

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekOffset(prev => direction === 'prev' ? prev - 1 : prev + 1);
  };

  return (
    <>
      <Card variant="elevated" style={styles.container}>
        {/* Compact Header */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <Text style={[
              styles.title, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              Weekly Overview
            </Text>
            <Text style={[
              styles.dateRange, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
                opacity: 0.7,
              }
            ]}>
              {formatDateRange(weekData.startDate, weekData.endDate)}
            </Text>
          </View>
        </View>

        {/* Week Days with integrated navigation arrows */}
        <View style={styles.weekContainer}>
          {/* Left Arrow */}
          <TouchableOpacity 
            onPress={() => navigateWeek('prev')}
            style={[styles.navButton, { backgroundColor: currentTheme.colors.surface + '60' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={30} color={currentTheme.colors.text} />
          </TouchableOpacity>
          
          {/* Days */}
          <View style={styles.daysContainer}>
            {weekData.weekDays.map((day, index) => (
              <View key={index} style={styles.dayColumn}>
                <TouchableOpacity 
                  onPress={() => handleDayPress(day)}
                  style={[
                    styles.dayButton,
                    { backgroundColor: getDayBackgroundColor(day.hasWorkout, day.workoutCategory) }
                  ]}
                  activeOpacity={0.7}
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
                    fontFamily: 'Raleway_400Regular',
                    opacity: day.hasWorkout ? 0.8 : 0.4,
                  }
                ]}>
                  {day.dayLetter}
                </Text>
              </View>
            ))}
          </View>

          {/* Right Arrow */}
          <TouchableOpacity 
            onPress={() => navigateWeek('next')}
            style={[styles.navButton, { backgroundColor: currentTheme.colors.surface + '60' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={30} color={currentTheme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Compact Stats */}
        <View style={styles.statsContainer}>
            <TouchableOpacity 
              style={styles.statItem} 
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
              style={styles.statItem} 
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
              style={styles.statItem} 
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
    marginBottom: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    fontSize: 24,
  },
  header: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 1,
  },
  dateRange: {
    fontSize: 12,
    fontWeight: '400',
  },
  chevronIcon: {
    marginLeft: 4,
  },
  weekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -8,
  },
  spacer: {
    width: 28,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flex: 1,
    marginHorizontal: 8,
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  dayButton: {
    width: 30,
    height: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.7,
  },
}); 