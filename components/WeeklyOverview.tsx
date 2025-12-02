import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getWorkoutByIdWithCustom } from '@/lib/workouts';
import { GeneratedWorkout, MuscleGroup } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from './Card';
import WeeklyOverviewModal from './WeeklyOverviewModal';

// All trackable muscle groups
const ALL_MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'];

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
  const { customExercises } = useCustomExercises();

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

  const getCategoryColor = (_category: string): string => {
    return currentTheme.colors.primary;
  };

  const getMuscleGroupColor = (_muscle: MuscleGroup): string => {
    return currentTheme.colors.primary;
  };

  const getMuscleGroupLabel = (muscle: MuscleGroup): string => {
    switch (muscle) {
      case 'chest': return 'Chest';
      case 'back': return 'Back';
      case 'shoulders': return 'Shoulders';
      case 'arms': return 'Arms';
      case 'legs': return 'Legs';
      case 'glutes': return 'Glutes';
      case 'core': return 'Core';
      default: return muscle;
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

  // Calculate muscle groups trained this week
  const muscleGroupStats = useMemo(() => {
    const trainedMuscles: Record<MuscleGroup, number> = {
      chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, glutes: 0, core: 0, 'full-body': 0
    };

    weekData.workouts.forEach(workout => {
      workout.exercises.forEach(exercise => {
        const exerciseInfo = getWorkoutByIdWithCustom(exercise.id, customExercises);
        if (exerciseInfo) {
          exerciseInfo.primaryMuscles.forEach(muscle => {
            trainedMuscles[muscle] = (trainedMuscles[muscle] || 0) + 1;
          });
        }
      });
    });

    const trained = ALL_MUSCLE_GROUPS.filter(m => trainedMuscles[m] > 0);
    const missed = ALL_MUSCLE_GROUPS.filter(m => trainedMuscles[m] === 0);

    return { trainedMuscles, trained, missed };
  }, [weekData.workouts, customExercises]);

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

  const getDayBackgroundColor = (hasWorkout: boolean, _workoutCategory?: string) => {
    if (!hasWorkout) return 'transparent';
    return currentTheme.colors.primary + '1A'; // 10% opacity
  };

  const getDayTextColor = (hasWorkout: boolean, _workoutCategory?: string) => {
    if (!hasWorkout) return currentTheme.colors.text + '4D'; // 30%
    return currentTheme.colors.primary;
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
        {/* Header */}
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
                color: currentTheme.colors.text + '99',
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              {formatDateRange(weekData.startDate, weekData.endDate)}
            </Text>
          </View>
        </View>

        {/* Week Days with navigation */}
        <View style={styles.weekContainer}>
          <TouchableOpacity
            onPress={() => navigateWeek('prev')}
            style={styles.navButton}
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-back" size={24} color={currentTheme.colors.text + '4D'} />
          </TouchableOpacity>

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
                    color: day.hasWorkout ? currentTheme.colors.text + '99' : currentTheme.colors.text + '4D',
                    fontFamily: 'Raleway_400Regular',
                  }
                ]}>
                  {day.dayLetter}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => navigateWeek('next')}
            style={styles.navButton}
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-forward" size={24} color={currentTheme.colors.text + '4D'} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={handleWeekPress}
            activeOpacity={0.6}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              {weekStats.totalWorkouts}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_400Regular' }]}>
              Workouts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={handleTimePress}
            activeOpacity={0.6}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              {weekStats.totalTime}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_400Regular' }]}>
              Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={handleVolumePress}
            activeOpacity={0.6}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              {weekStats.totalVolume}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_400Regular' }]}>
              Volume
            </Text>
          </TouchableOpacity>
        </View>

        {/* Muscle Groups Focus */}
        <View style={[styles.muscleSection, { borderTopColor: currentTheme.colors.border }]}>
          <Text style={[styles.muscleSectionTitle, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_500Medium' }]}>
            Muscle Focus
          </Text>
          <View style={styles.muscleChips}>
            {ALL_MUSCLE_GROUPS.map(muscle => {
              const isTrained = muscleGroupStats.trained.includes(muscle);
              const count = muscleGroupStats.trainedMuscles[muscle];
              return (
                <View
                  key={muscle}
                  style={[
                    styles.muscleChip,
                    {
                      backgroundColor: isTrained
                        ? currentTheme.colors.primary + '1A' // 10%
                        : 'transparent',
                      borderColor: isTrained
                        ? currentTheme.colors.primary + '4D' // 30%
                        : currentTheme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.muscleChipText,
                      {
                        color: isTrained
                          ? currentTheme.colors.primary
                          : currentTheme.colors.text + '4D', // 30%
                        fontFamily: isTrained ? 'Raleway_500Medium' : 'Raleway_400Regular',
                      },
                    ]}
                  >
                    {getMuscleGroupLabel(muscle)}
                  </Text>
                  {isTrained && count > 1 && (
                    <View style={[styles.muscleCount, { backgroundColor: currentTheme.colors.primary }]}>
                      <Text style={styles.muscleCountText}>{count}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          {muscleGroupStats.missed.length > 0 && muscleGroupStats.trained.length > 0 && (
            <Text style={[styles.missedHint, { color: currentTheme.colors.text + '4D', fontFamily: 'Raleway_400Regular' }]}>
              Missing: {muscleGroupStats.missed.map(m => getMuscleGroupLabel(m)).join(', ')}
            </Text>
          )}
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
    marginBottom: 16,
  },
  header: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  dateRange: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  weekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 32,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  muscleSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  muscleSectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  muscleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  muscleChipText: {
    fontSize: 13,
    lineHeight: 18,
  },
  muscleCount: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muscleCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  missedHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 12,
  },
}); 