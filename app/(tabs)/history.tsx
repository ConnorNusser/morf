import ExerciseCard from '@/components/history/ExerciseCard';
import MuscleFocusWidget from '@/components/history/MuscleFocusWidget';
import { Text, View } from '@/components/Themed';
import WeeklyOverview from '@/components/WeeklyOverview';
import TemplateEditorModal from '@/components/workout/TemplateEditorModal';
import TemplateLibraryModal from '@/components/workout/TemplateLibraryModal';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/hooks/useUser';
import { storageService } from '@/lib/storage';
import { OneRMCalculator } from '@/lib/strengthStandards';
import { userService } from '@/lib/userService';
import { ALL_WORKOUTS, getWorkoutById } from '@/lib/workouts';
import { convertWeight, GeneratedWorkout, WeightUnit, WorkoutTemplate } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import {
  Alert,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

interface ExerciseWithMax {
  id: string;
  name: string;
  maxWeight: number;
  maxReps: number;
  estimated1RM: number;
  isCustom: boolean;
  lastUsed?: Date;
  history: { weight: number; reps: number; date: Date; unit: WeightUnit }[];
}

type TabType = 'workouts' | 'exercises' | 'templates';

export default function HistoryScreen() {
  const { currentTheme } = useTheme();
  const { userProfile } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('workouts');

  // History state
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);

  // Exercise stats state
  const [exerciseStats, setExerciseStats] = useState<ExerciseWithMax[]>([]);

  // Templates state
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [notesSearchQuery, setNotesSearchQuery] = useState('');

  // Modal states
  const [selectedWorkout, setSelectedWorkout] = useState<GeneratedWorkout | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseWithMax | null>(null);

  // Get user's weight unit preference
  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';

  // Load data
  const loadHistory = useCallback(async () => {
    try {
      const history = await storageService.getWorkoutHistory();
      const sorted = history.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setWorkouts(sorted);
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const loadedTemplates = await storageService.getWorkoutTemplates();
      // Sort by most recently used, then by created date
      const sorted = loadedTemplates.sort((a, b) => {
        if (a.lastUsed && b.lastUsed) {
          return b.lastUsed.getTime() - a.lastUsed.getTime();
        }
        if (a.lastUsed) return -1;
        if (b.lastUsed) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      setTemplates(sorted);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }, []);

  const loadExerciseStats = useCallback(async () => {
    try {
      const profile = await userService.getRealUserProfile();
      const customExercises = await storageService.getCustomExercises();
      const workoutHistory = await storageService.getWorkoutHistory();

      // Build a map of exercise IDs to their history and max
      const exerciseDataMap: Record<string, {
        maxWeight: number;
        maxReps: number;
        maxOneRM: number;
        history: { weight: number; reps: number; date: Date; unit: WeightUnit }[];
      }> = {};

      // Helper to add entry
      const addEntry = (id: string, weight: number, reps: number, date: Date, unit: WeightUnit) => {
        if (weight <= 0) return;
        const weightInLbs = unit === 'kg' ? convertWeight(weight, 'kg', 'lbs') : weight;
        const oneRM = OneRMCalculator.estimate(weightInLbs, reps);

        if (!exerciseDataMap[id]) {
          exerciseDataMap[id] = { maxWeight: 0, maxReps: 0, maxOneRM: 0, history: [] };
        }

        exerciseDataMap[id].history.push({ weight, reps, date, unit });

        if (oneRM > exerciseDataMap[id].maxOneRM) {
          exerciseDataMap[id].maxWeight = weightInLbs;
          exerciseDataMap[id].maxReps = reps;
          exerciseDataMap[id].maxOneRM = oneRM;
        }
      };

      // Get from main lifts
      for (const lift of profile?.lifts || []) {
        addEntry(lift.id, lift.weight, lift.reps, new Date(lift.dateRecorded), lift.unit);
      }

      // Get from secondary lifts
      for (const lift of profile?.secondaryLifts || []) {
        addEntry(lift.id, lift.weight, lift.reps, new Date(lift.dateRecorded), lift.unit);
      }

      // Scan workout history
      for (const workout of workoutHistory) {
        for (const exercise of workout.exercises) {
          for (const set of exercise.completedSets || []) {
            addEntry(exercise.id, set.weight, set.reps, new Date(workout.createdAt), set.unit);
          }
        }
      }

      // Build stats list
      const stats: ExerciseWithMax[] = [];

      // Add exercises from database
      for (const workout of ALL_WORKOUTS) {
        const data = exerciseDataMap[workout.id];
        if (data && data.history.length > 0) {
          const displayWeight = weightUnit === 'kg' ? convertWeight(data.maxWeight, 'lbs', 'kg') : data.maxWeight;
          const displayOneRM = weightUnit === 'kg' ? convertWeight(data.maxOneRM, 'lbs', 'kg') : data.maxOneRM;

          // Sort history by date descending
          const sortedHistory = data.history.sort((a, b) => b.date.getTime() - a.date.getTime());

          stats.push({
            id: workout.id,
            name: workout.name,
            maxWeight: Math.round(displayWeight),
            maxReps: data.maxReps,
            estimated1RM: Math.round(displayOneRM),
            isCustom: false,
            lastUsed: sortedHistory[0]?.date,
            history: sortedHistory,
          });
        }
      }

      // Add custom exercises
      for (const custom of customExercises) {
        const data = exerciseDataMap[custom.id];
        const displayWeight = data && weightUnit === 'kg' ? convertWeight(data.maxWeight, 'lbs', 'kg') : (data?.maxWeight || 0);
        const displayOneRM = data && weightUnit === 'kg' ? convertWeight(data.maxOneRM, 'lbs', 'kg') : (data?.maxOneRM || 0);
        const sortedHistory = data?.history.sort((a, b) => b.date.getTime() - a.date.getTime()) || [];

        stats.push({
          id: custom.id,
          name: custom.name,
          maxWeight: data ? Math.round(displayWeight) : 0,
          maxReps: data?.maxReps || 0,
          estimated1RM: data ? Math.round(displayOneRM) : 0,
          isCustom: true,
          lastUsed: sortedHistory[0]?.date || custom.createdAt,
          history: sortedHistory,
        });
      }

      // Sort by estimated 1RM descending
      stats.sort((a, b) => b.estimated1RM - a.estimated1RM || a.name.localeCompare(b.name));

      setExerciseStats(stats);
    } catch (error) {
      console.error('Error loading exercise stats:', error);
    }
  }, [weightUnit]);

  useEffect(() => {
    loadHistory();
    loadExerciseStats();
    loadTemplates();
  }, [loadHistory, loadExerciseStats, loadTemplates]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadHistory(), loadExerciseStats(), loadTemplates()]);
    setRefreshing(false);
  };

  const handleDeleteWorkout = (workout: GeneratedWorkout) => {
    Alert.alert(
      'Delete Workout',
      `Delete "${workout.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await userService.deleteWorkoutAndLifts(workout.id);
            setSelectedWorkout(null);
            await loadHistory();
            await loadExerciseStats();
          },
        },
      ]
    );
  };

  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const d = new Date(date);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleTemplateSelect = useCallback(async (template: WorkoutTemplate) => {
    await storageService.updateTemplateLastUsed(template.id);
    Alert.alert(
      'Use Template',
      `"${template.name}" has been copied to your clipboard. Go to the Workout tab to paste it.`,
      [{ text: 'OK' }]
    );
    // Note: In a real implementation, you might want to navigate to the workout tab
    // and auto-fill the template
  }, []);

  const handleDeleteTemplate = useCallback(async (templateId: string, templateName: string) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${templateName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await storageService.deleteWorkoutTemplate(templateId);
            await loadTemplates();
          },
        },
      ]
    );
  }, [loadTemplates]);

  const handleCreateTemplate = useCallback(() => {
    setEditingTemplate(null);
    setShowTemplateEditor(true);
  }, []);

  const handleEditTemplate = useCallback((template: WorkoutTemplate) => {
    setEditingTemplate(template);
    setShowTemplateEditor(true);
  }, []);

  const handleTemplateEditorClose = useCallback(() => {
    setShowTemplateEditor(false);
    setEditingTemplate(null);
  }, []);

  const handleTemplateEditorSave = useCallback(async () => {
    await loadTemplates();
  }, [loadTemplates]);

  const handleCopyTemplate = useCallback(async (template: WorkoutTemplate) => {
    await Clipboard.setStringAsync(template.noteText);
    Alert.alert('Copied!', `"${template.name}" copied to clipboard. Paste it in your workout notes.`);
  }, []);

  const renderRightActions = useCallback((templateId: string, templateName: string) => {
    return (
      <TouchableOpacity
        style={styles.swipeDeleteButton}
        onPress={() => handleDeleteTemplate(templateId, templateName)}
      >
        <Ionicons name="trash-outline" size={22} color="#fff" />
      </TouchableOpacity>
    );
  }, [handleDeleteTemplate]);

  // Get recent workouts (last 5)
  const recentWorkouts = useMemo(() => workouts.slice(0, 5), [workouts]);

  // Calculate quick stats
  const quickStats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // This week's workouts
    const thisWeekWorkouts = workouts.filter(w => new Date(w.createdAt) >= startOfWeek);

    // This month's workouts
    const thisMonthWorkouts = workouts.filter(w => new Date(w.createdAt) >= startOfMonth);

    // Calculate streak
    let streak = 0;
    const sortedWorkouts = [...workouts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (sortedWorkouts.length > 0) {
      const workoutDates = new Set<string>();
      sortedWorkouts.forEach(w => {
        const date = new Date(w.createdAt);
        workoutDates.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if worked out today or yesterday
      const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

      if (workoutDates.has(todayKey) || workoutDates.has(yesterdayKey)) {
        // Count consecutive days going back
        let checkDate = workoutDates.has(todayKey) ? today : yesterday;
        while (true) {
          const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
          if (workoutDates.has(key)) {
            streak++;
            checkDate = new Date(checkDate);
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
    }

    // Total volume this week
    let weekVolume = 0;
    thisWeekWorkouts.forEach(workout => {
      workout.exercises.forEach(ex => {
        ex.completedSets?.forEach(set => {
          weekVolume += set.weight * set.reps;
        });
      });
    });

    return {
      streak,
      thisWeek: thisWeekWorkouts.length,
      thisMonth: thisMonthWorkouts.length,
      weekVolume,
    };
  }, [workouts]);

  // Calculate workout stats for display
  const getWorkoutStats = (workout: GeneratedWorkout) => {
    let totalSets = 0;
    let totalVolume = 0;
    workout.exercises.forEach(ex => {
      ex.completedSets?.forEach(set => {
        totalSets++;
        totalVolume += set.weight * set.reps;
      });
    });
    return { totalSets, totalVolume };
  };

  // Get all exercises from a workout with their sets
  const getWorkoutExercises = (workout: GeneratedWorkout): { name: string; sets: string[]; isPR: boolean }[] => {
    const exercises: { name: string; sets: string[]; isPR: boolean; volume: number }[] = [];

    workout.exercises.forEach(ex => {
      const exerciseInfo = getWorkoutById(ex.id);
      const name = exerciseInfo?.name || ex.id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];

      if (ex.completedSets && ex.completedSets.length > 0) {
        // Get all sets formatted
        const sets = ex.completedSets.map(set => `${set.weight}×${set.reps}`);

        // Find best set for PR check
        const bestSet = ex.completedSets.reduce((best, current) => {
          return (current.weight > best.weight) ? current : best;
        }, ex.completedSets[0]);

        const volume = ex.completedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);

        // Check if PR
        const exerciseStat = exerciseStats.find(s => s.id === ex.id);
        const isPR = exerciseStat ? bestSet.weight >= exerciseStat.maxWeight : false;

        exercises.push({
          name,
          sets,
          isPR,
          volume,
        });
      }
    });

    // Sort by volume
    return exercises.sort((a, b) => b.volume - a.volume);
  };

  // Filter exercises with data for the Your Lifts section
  const liftsWithData = useMemo(() =>
    exerciseStats.filter(ex => ex.estimated1RM > 0).slice(0, 10),
    [exerciseStats]
  );

  // Filter templates based on search query
  const filteredTemplates = useMemo(() => {
    if (!notesSearchQuery.trim()) return templates;
    const query = notesSearchQuery.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.noteText.toLowerCase().includes(query)
    );
  }, [templates, notesSearchQuery]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
          History
        </Text>

        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'workouts' && styles.activeTab,
                activeTab === 'workouts' && { borderBottomColor: currentTheme.colors.accent }
              ]}
              onPress={() => setActiveTab('workouts')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'workouts' ? currentTheme.colors.text : currentTheme.colors.text + '50' },
                { fontFamily: activeTab === 'workouts' ? 'Raleway_600SemiBold' : 'Raleway_400Regular' }
              ]}>
                Workouts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'exercises' && styles.activeTab,
                activeTab === 'exercises' && { borderBottomColor: currentTheme.colors.accent }
              ]}
              onPress={() => setActiveTab('exercises')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'exercises' ? currentTheme.colors.text : currentTheme.colors.text + '50' },
                { fontFamily: activeTab === 'exercises' ? 'Raleway_600SemiBold' : 'Raleway_400Regular' }
              ]}>
                Exercises
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'templates' && styles.activeTab,
                activeTab === 'templates' && { borderBottomColor: currentTheme.colors.accent }
              ]}
              onPress={() => setActiveTab('templates')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'templates' ? currentTheme.colors.text : currentTheme.colors.text + '50' },
                { fontFamily: activeTab === 'templates' ? 'Raleway_600SemiBold' : 'Raleway_400Regular' }
              ]}>
                Notes
              </Text>
            </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={currentTheme.colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'workouts' ? (
          <>
            {/* Weekly Overview */}
            <WeeklyOverview workoutHistory={workouts} />

            {/* Quick Stats - Inline */}
            {workouts.length > 0 && (
              <View style={[styles.quickStatsInline, { backgroundColor: 'transparent' }]}>
                {quickStats.streak > 0 && (
                  <>
                    <Ionicons name="flame" size={16} color="#FF6B35" />
                    <Text style={[styles.quickStatInlineText, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      {quickStats.streak} day streak
                    </Text>
                    <Text style={[styles.quickStatDivider, { color: currentTheme.colors.text + '30' }]}>•</Text>
                  </>
                )}
                <Text style={[styles.quickStatInlineText, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_400Regular' }]}>
                  {quickStats.thisWeek} this week
                </Text>
                <Text style={[styles.quickStatDivider, { color: currentTheme.colors.text + '30' }]}>•</Text>
                <Text style={[styles.quickStatInlineText, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_400Regular' }]}>
                  {quickStats.weekVolume > 1000 ? `${(quickStats.weekVolume / 1000).toFixed(0)}k` : quickStats.weekVolume} {weightUnit}
                </Text>
              </View>
            )}

            {/* Muscle Focus Widget */}
            {workouts.length > 0 && (
              <View style={styles.widgetSection}>
                <MuscleFocusWidget />
              </View>
            )}

            {/* Recent Workouts */}
            {recentWorkouts.length > 0 && (
              <View style={styles.section}>
                {recentWorkouts.map((workout) => {
                  const stats = getWorkoutStats(workout);
                  const exercises = getWorkoutExercises(workout);
                  return (
                    <TouchableOpacity
                      key={workout.id}
                      style={[styles.workoutCard, { borderColor: currentTheme.colors.border }]}
                      onPress={() => setSelectedWorkout(workout)}
                      onLongPress={() => handleDeleteWorkout(workout)}
                      activeOpacity={0.7}
                    >
                      {/* Header */}
                      <View style={[styles.workoutHeader, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.workoutTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                          {workout.title}
                        </Text>
                        <Text style={[styles.workoutMeta, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                          {formatRelativeDate(workout.createdAt)} • {stats.totalSets} sets • {stats.totalVolume > 1000 ? `${(stats.totalVolume / 1000).toFixed(1)}k` : stats.totalVolume} {weightUnit}
                        </Text>
                      </View>

                      {/* Exercise list */}
                      {exercises.length > 0 && (
                        <View style={styles.exercisesList}>
                          {exercises.map((ex, idx) => (
                            <View key={idx} style={[styles.exerciseRow, { backgroundColor: 'transparent' }]}>
                              <View style={[styles.exerciseNameContainer, { backgroundColor: 'transparent' }]}>
                                <Text style={[styles.exerciseName, { color: currentTheme.colors.text + '90', fontFamily: 'Raleway_500Medium' }]}>
                                  {ex.name}
                                </Text>
                                {ex.isPR && (
                                  <View style={[styles.prBadge, { backgroundColor: currentTheme.colors.accent + '20' }]}>
                                    <Text style={[styles.prText, { color: currentTheme.colors.accent, fontFamily: 'Raleway_600SemiBold' }]}>PR</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                                {ex.sets.join(' · ')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {workouts.length > 5 && (
                  <TouchableOpacity style={styles.viewAllButton}>
                    <Text style={[styles.viewAllText, { color: currentTheme.colors.accent, fontFamily: 'Raleway_500Medium' }]}>
                      View all {workouts.length} workouts
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Empty State */}
            {workouts.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="barbell-outline" size={48} color={currentTheme.colors.text + '20'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_500Medium' }]}>
                  No workouts yet
                </Text>
                <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '30', fontFamily: 'Raleway_400Regular' }]}>
                  Start logging to track your progress
                </Text>
              </View>
            )}
          </>
        ) : activeTab === 'exercises' ? (
          <>
            {/* Exercises Tab */}
            {liftsWithData.length > 0 ? (
              <View style={styles.section}>
                {liftsWithData.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onPress={() => setSelectedExercise(exercise)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="fitness-outline" size={48} color={currentTheme.colors.text + '20'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_500Medium' }]}>
                  No exercises tracked
                </Text>
                <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '30', fontFamily: 'Raleway_400Regular' }]}>
                  Complete workouts to build your exercise history
                </Text>
              </View>
            )}
          </>
        ) : activeTab === 'templates' ? (
          <>
            {/* Notes Tab */}
            {/* Create Note Button */}
            <TouchableOpacity
              style={[styles.createTemplateButton, { backgroundColor: currentTheme.colors.accent }]}
              onPress={handleCreateTemplate}
              activeOpacity={0.8}
            >
              <Text style={[styles.createTemplateButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
                Create New Note
              </Text>
            </TouchableOpacity>

            {templates.length > 0 ? (
              <>
                {/* Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: currentTheme.colors.surface }]}>
                  <Ionicons name="search" size={18} color={currentTheme.colors.text + '50'} />
                  <TextInput
                    style={[styles.searchInput, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}
                    placeholder="Search notes..."
                    placeholderTextColor={currentTheme.colors.text + '40'}
                    value={notesSearchQuery}
                    onChangeText={setNotesSearchQuery}
                  />
                  {notesSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setNotesSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color={currentTheme.colors.text + '40'} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.section}>
                  {filteredTemplates.length > 0 ? (
                    filteredTemplates.map((template) => (
                      <Swipeable
                        key={template.id}
                        renderRightActions={() => renderRightActions(template.id, template.name)}
                        overshootRight={false}
                      >
                        <TouchableOpacity
                          style={[styles.templateCard, { backgroundColor: currentTheme.colors.background, borderColor: currentTheme.colors.border }]}
                          onPress={() => handleEditTemplate(template)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.templateHeader, { backgroundColor: 'transparent' }]}>
                            <View style={[styles.templateHeaderLeft, { backgroundColor: 'transparent' }]}>
                              <Ionicons name="document-text-outline" size={18} color={currentTheme.colors.accent} />
                              <Text style={[styles.templateName, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                                {template.name}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.copyButton, { backgroundColor: currentTheme.colors.accent }]}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleCopyTemplate(template);
                              }}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="copy-outline" size={14} color="#fff" />
                              <Text style={[styles.copyButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
                                Copy
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <Text
                            style={[styles.templatePreview, { color: currentTheme.colors.text + '70', fontFamily: 'Raleway_400Regular' }]}
                            numberOfLines={2}
                          >
                            {template.noteText}
                          </Text>
                          <Text style={[styles.templateDate, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                            {formatRelativeDate(template.createdAt)}
                          </Text>
                        </TouchableOpacity>
                      </Swipeable>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_500Medium' }]}>
                        No matching notes
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={currentTheme.colors.text + '20'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_500Medium' }]}>
                  No notes yet
                </Text>
                <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '30', fontFamily: 'Raleway_400Regular' }]}>
                  Tap "Create New Note" above to get started
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Workout Detail Modal */}
      <Modal visible={!!selectedWorkout} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={() => setSelectedWorkout(null)}>
              <Ionicons name="close" size={28} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              Workout Details
            </Text>
            <TouchableOpacity onPress={() => selectedWorkout && handleDeleteWorkout(selectedWorkout)}>
              <Ionicons name="trash-outline" size={24} color={currentTheme.colors.text + '60'} />
            </TouchableOpacity>
          </View>
          {selectedWorkout && (
            <ScrollView style={styles.modalContent}>
              <Text style={[styles.modalWorkoutTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                {selectedWorkout.title}
              </Text>
              <Text style={[styles.modalDate, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                {formatFullDate(selectedWorkout.createdAt)}
              </Text>

              <View style={styles.modalExerciseList}>
                {selectedWorkout.exercises.map((exercise, idx) => {
                  const exerciseInfo = getWorkoutById(exercise.id);
                  const name = exerciseInfo?.name || exercise.id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];
                  return (
                    <View key={idx} style={[styles.modalExerciseItem, { borderBottomColor: currentTheme.colors.border }]}>
                      <Text style={[styles.modalExerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                        {name}
                      </Text>
                      <View style={styles.modalSetsList}>
                        {exercise.completedSets?.map((set, setIdx) => (
                          <View key={setIdx} style={[styles.modalSetRow, { backgroundColor: 'transparent' }]}>
                            <Text style={[styles.modalSetNumber, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_500Medium' }]}>
                              Set {setIdx + 1}
                            </Text>
                            <Text style={[styles.modalSetValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                              {set.weight} {set.unit} × {set.reps}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Template Library Modal */}
      <TemplateLibraryModal
        visible={showTemplateLibrary}
        onClose={() => {
          setShowTemplateLibrary(false);
          loadTemplates();
        }}
        onSelectTemplate={handleTemplateSelect}
      />

      {/* Template Editor Modal */}
      <TemplateEditorModal
        visible={showTemplateEditor}
        template={editingTemplate}
        onClose={handleTemplateEditorClose}
        onSave={handleTemplateEditorSave}
      />

      {/* Exercise History Modal */}
      <Modal visible={!!selectedExercise} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={() => setSelectedExercise(null)}>
              <Ionicons name="close" size={28} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              Exercise History
            </Text>
            <View style={{ width: 28 }} />
          </View>
          {selectedExercise && (
            <ScrollView style={styles.modalContent}>
              <Text style={[styles.modalWorkoutTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                {selectedExercise.name}
              </Text>

              {selectedExercise.estimated1RM > 0 && (
                <View style={[styles.exerciseStatsBanner, { backgroundColor: currentTheme.colors.surface }]}>
                  <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.statValue, { color: currentTheme.colors.accent, fontFamily: 'Raleway_700Bold' }]}>
                      {selectedExercise.estimated1RM}
                    </Text>
                    <Text style={[styles.statLabel, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                      Est. 1RM
                    </Text>
                  </View>
                  <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                      {selectedExercise.maxWeight}
                    </Text>
                    <Text style={[styles.statLabel, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                      Best Weight
                    </Text>
                  </View>
                  <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                      {selectedExercise.history.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                      Total Sets
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.historyHeader, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_600SemiBold' }]}>
                SET HISTORY
              </Text>

              {selectedExercise.history.length === 0 ? (
                <Text style={[styles.noHistoryText, { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }]}>
                  No history recorded yet
                </Text>
              ) : (
                selectedExercise.history.map((entry, idx) => (
                  <View key={idx} style={[styles.historyRow, { borderBottomColor: currentTheme.colors.border }]}>
                    <Text style={[styles.historyDate, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                      {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={[styles.historyValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                      {entry.weight} {entry.unit} × {entry.reps}
                    </Text>
                    <Text style={[styles.historyOneRM, { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }]}>
                      ~{Math.round(OneRMCalculator.estimate(entry.unit === 'kg' ? convertWeight(entry.weight, 'kg', 'lbs') : entry.weight, entry.reps))} 1RM
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
  },
  headerTitle: {
    fontSize: 28,
    marginBottom: 12,
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  tab: {
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  // Quick stats inline
  quickStatsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  quickStatInlineText: {
    fontSize: 13,
  },
  quickStatDivider: {
    fontSize: 13,
  },
  // Section styles
  section: {
    marginTop: 16,
  },
  widgetSection: {
    marginTop: 16,
  },
  // Workout card styles - minimal, borderless
  workoutCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  workoutHeader: {
    marginBottom: 12,
  },
  workoutTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  workoutMeta: {
    fontSize: 13,
  },
  exercisesList: {
    gap: 8,
  },
  exerciseRow: {},
  exerciseNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  exerciseName: {
    fontSize: 14,
  },
  exerciseSets: {
    fontSize: 13,
  },
  prBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  prText: {
    fontSize: 9,
  },
  viewAllButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
  },
  // Lift card styles - minimal
  liftCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liftMain: {
    flex: 1,
  },
  liftNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  liftName: {
    fontSize: 15,
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  customBadgeText: {
    fontSize: 9,
  },
  liftStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liftValue: {
    fontSize: 18,
  },
  liftLabel: {
    fontSize: 13,
  },
  deltaContainer: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deltaText: {
    fontSize: 11,
  },
  liftRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalWorkoutTitle: {
    fontSize: 24,
    marginBottom: 8,
  },
  modalDate: {
    fontSize: 14,
    marginBottom: 24,
  },
  modalExerciseList: {},
  modalExerciseItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalExerciseName: {
    fontSize: 17,
    marginBottom: 12,
  },
  modalSetsList: {
    gap: 8,
  },
  modalSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSetNumber: {
    fontSize: 14,
  },
  modalSetValue: {
    fontSize: 16,
  },
  // Exercise history modal
  exerciseStatsBanner: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  historyHeader: {
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 12,
  },
  noHistoryText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyDate: {
    width: 60,
    fontSize: 13,
  },
  historyValue: {
    flex: 1,
    fontSize: 15,
  },
  historyOneRM: {
    fontSize: 13,
  },
  // Template card styles
  templateCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  templateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    flex: 1,
  },
  templateDate: {
    fontSize: 12,
    marginTop: 8,
  },
  templatePreview: {
    fontSize: 14,
    lineHeight: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  copyButtonText: {
    fontSize: 13,
    color: '#fff',
  },
  // Create template button
  createTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  createTemplateButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  // Search bar styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    marginTop: 0,
    marginBottom: 0,
    textAlignVertical: 'center',
  },
  // Swipe delete button
  swipeDeleteButton: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginVertical: 0,
  },
});
