import { Text, View } from '@/components/Themed';
import ExerciseBadge from '@/components/workout/ExerciseBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { OneRMCalculator } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { ParsedExerciseSummary } from '@/lib/workoutNoteParser';
import { UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  View as RNView,
} from 'react-native';

interface WorkoutSummaryModalProps {
  visible: boolean;
  exercises: ParsedExerciseSummary[];
  isLoading?: boolean;
  onDismiss: () => void;
  onPress?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  visible,
  exercises,
  isLoading = false,
  onDismiss,
  onPress: _onPress,
}) => {
  const { currentTheme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [userLifts, setUserLifts] = useState<UserProgress[]>([]);

  // Fetch user lifts for badge display
  useEffect(() => {
    if (visible) {
      userService.getAllFeaturedLifts().then(setUserLifts).catch(console.error);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      // Slide down from top
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide up
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  // Calculate total sets
  const totalSets = useMemo(() =>
    exercises.reduce((sum, ex) => sum + ex.setCount, 0),
    [exercises]
  );

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.fullScreenContainer,
        {
          backgroundColor: currentTheme.colors.background,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
          {isLoading ? 'Analyzing...' : 'Workout Summary'}
        </Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={24} color={currentTheme.colors.text + '60'} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
            Parsing your workout notes...
          </Text>
        </View>
      ) : exercises.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={currentTheme.colors.text + '30'} />
          <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
            No exercises detected
          </Text>
          <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }]}>
            {"Try adding exercises like \"Bench 135x8\" or \"Squats 225 for 5 reps\""}
          </Text>
        </View>
      ) : (
        <>
          {/* Stats Banner - Two Stats */}
          <View style={[styles.statsBanner, { backgroundColor: currentTheme.colors.surface }]}>
            <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                {exercises.length}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                Exercises
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: currentTheme.colors.border }]} />
            <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                {totalSets}
              </Text>
              <Text style={[styles.statLabel, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                Total Sets
              </Text>
            </View>
          </View>

          {/* Exercise List */}
          <ScrollView style={styles.exerciseList} contentContainerStyle={styles.exerciseListContent} showsVerticalScrollIndicator={false}>
            {exercises.map((exercise, index) => {
              // Calculate best 1RM estimate from sets
              const best1RM = Math.max(
                ...(exercise.sets || []).map(set =>
                  set.weight > 0 && set.reps > 0
                    ? OneRMCalculator.estimate(set.weight, set.reps)
                    : 0
                ),
                0
              );

              return (
                <View
                  key={index}
                  style={[styles.exerciseCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                >
                  <RNView style={styles.exerciseHeader}>
                    <RNView style={styles.exerciseNameContainer}>
                      <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                        {exercise.name}
                      </Text>
                      {best1RM > 0 && (
                        <Text style={[styles.estimated1RM, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
                          ~{Math.round(best1RM)} 1RM
                        </Text>
                      )}
                    </RNView>
                    <ExerciseBadge
                      matchedExerciseId={exercise.matchedExerciseId}
                      isCustom={exercise.isCustom}
                      sets={exercise.sets || []}
                      userLifts={userLifts}
                    />
                  </RNView>

                  {/* Set Details */}
                  <RNView style={styles.setsContainer}>
                    {/* Target Sets (Template) */}
                    {exercise.recommendedSets && exercise.recommendedSets.length > 0 && (
                      <RNView style={styles.setsSection}>
                        <Text style={[styles.sectionLabel, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_600SemiBold' }]}>
                          Target
                        </Text>
                        {exercise.recommendedSets.map((set, setIndex) => (
                          <RNView key={setIndex} style={styles.setRow}>
                            <Text style={[styles.setLabel, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                              Set {setIndex + 1}
                            </Text>
                            <Text style={[styles.setDetails, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_400Regular' }]}>
                              {set.weight > 0 ? `${set.weight} ${set.unit} × ${set.reps}` : `${set.reps} reps`}
                            </Text>
                          </RNView>
                        ))}
                      </RNView>
                    )}

                    {/* Completed Sets */}
                    {exercise.sets && exercise.sets.length > 0 && (
                      <RNView style={styles.setsSection}>
                        {exercise.sets.map((set, setIndex) => (
                          <RNView key={setIndex} style={styles.setRow}>
                            <Text style={[styles.setLabel, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_500Medium' }]}>
                              Set {setIndex + 1}
                            </Text>
                            <Text style={[styles.setDetails, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                              {set.weight > 0 ? `${set.weight} ${set.unit} × ${set.reps}` : `${set.reps} reps`}
                            </Text>
                          </RNView>
                        ))}
                      </RNView>
                    )}
                  </RNView>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 17,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statsBanner: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
  },
  statLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  exerciseList: {
    flex: 1,
  },
  exerciseListContent: {
    paddingBottom: 40,
  },
  exerciseCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  exerciseNameContainer: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontSize: 16,
  },
  estimated1RM: {
    fontSize: 13,
  },
  setsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    gap: 12,
  },
  setsSection: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  setLabel: {
    fontSize: 13,
  },
  setDetails: {
    fontSize: 14,
  },
});

export default WorkoutSummaryModal;
