import { useTheme } from '@/contexts/ThemeContext';
import { DAY_NAMES_DISPLAY, DAY_NAMES_INTERNAL, DAY_NAMES_SHORT } from '@/lib/day';
import { DayOfWeek, GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface WorkoutEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (updatedWorkout: Partial<GeneratedWorkout>) => void;
  workout: GeneratedWorkout | null;
}

const DAYS_OF_WEEK = DAY_NAMES_INTERNAL.map((key, index) => ({
  key,
  label: DAY_NAMES_DISPLAY[index],
  short: DAY_NAMES_SHORT[index],
}));

export default function WorkoutEditModal({ visible, onClose, onSave, workout }: WorkoutEditModalProps) {
  const { currentTheme } = useTheme();
  const [title, setTitle] = useState(workout?.title || '');
  const [description, setDescription] = useState(workout?.description || '');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(workout?.dayOfWeek || 'monday');

  React.useEffect(() => {
    if (workout) {
      setTitle(workout.title);
      setDescription(workout.description);
      setSelectedDay(workout.dayOfWeek || 'monday');
    }
  }, [workout]);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a workout title');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a workout description');
      return;
    }

    const updatedWorkout: Partial<GeneratedWorkout> = {
      title: title.trim(),
      description: description.trim(),
      dayOfWeek: selectedDay,
    };

    onSave(updatedWorkout);
    onClose();
  };

  const handleClose = () => {
    if (workout) {
      setTitle(workout.title);
      setDescription(workout.description);
      setSelectedDay(workout.dayOfWeek || 'monday');
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { 
            color: currentTheme.colors.text,
            fontFamily: 'Raleway_700Bold',
          }]}>
            Edit Workout
          </Text>
          
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={[styles.saveButtonText, { 
              color: currentTheme.colors.primary,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Workout Title
            </Text>
            <TextInput
              style={[styles.textInput, { 
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter workout title"
              placeholderTextColor={currentTheme.colors.text + '60'}
              maxLength={50}
            />
          </View>

          {/* Description Input */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Description
            </Text>
            <TextInput
              style={[styles.textAreaInput, { 
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_500Medium',
              }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter workout description"
              placeholderTextColor={currentTheme.colors.text + '60'}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={200}
            />
          </View>

          {/* Day Selection */}
          <View style={styles.inputSection}>
            <Text style={[styles.inputLabel, { 
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_600SemiBold',
            }]}>
              Day of Week
            </Text>
            
            <View style={styles.daysContainer}>
              {DAYS_OF_WEEK.map((day) => (
                <TouchableOpacity
                  key={day.key}
                  onPress={() => setSelectedDay(day.key as DayOfWeek)}
                  style={[
                    styles.dayButton,
                    {
                      backgroundColor: selectedDay === day.key 
                        ? currentTheme.colors.primary
                        : currentTheme.colors.surface,
                      borderColor: selectedDay === day.key 
                        ? currentTheme.colors.primary
                        : currentTheme.colors.border,
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dayButtonText,
                    {
                      color: selectedDay === day.key 
                        ? currentTheme.colors.background
                        : currentTheme.colors.text,
                      fontFamily: 'Raleway_600SemiBold',
                    }
                  ]}>
                    {day.short}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Workout Info (Read-only) */}
          {workout && (
            <View style={styles.infoSection}>
              <Text style={[styles.infoLabel, { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }]}>
                Workout Info
              </Text>
              
              <View style={[styles.infoCard, { backgroundColor: currentTheme.colors.surface }]}>
                <Text style={[styles.infoText, { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }]}>
                  {workout.exercises?.length || 0} exercises
                </Text>
                <Text style={[styles.infoText, { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }]}>
                  ~{workout.estimatedDuration} minutes
                </Text>
                <Text style={[styles.infoText, { 
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_500Medium',
                }]}>
                  {workout.difficulty} difficulty
                </Text>
              </View>
            </View>
          )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveButton: {
    padding: 8,
    marginRight: -8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 50,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 100,
  },
  daysContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.8,
  },
}); 