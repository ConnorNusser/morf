import { useRoutine } from '@/contexts/RoutineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Routine } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '../Button';
import Card from '../Card';
import CreateRoutineFlow, { RoutineCreationData } from './CreateRoutineFlow';
import WeeklyRoutineScheduler from './WeeklyRoutineScheduler';


interface RoutinesModalProps {
  visible: boolean;
  onClose: () => void;
  onRoutineCreated?: () => void;
}

export default function RoutinesModal({ visible, onClose, onRoutineCreated }: RoutinesModalProps) {
  const { currentTheme } = useTheme();
  const { routines, deleteRoutine: deleteRoutineFromContext, updateRoutine, setCurrentRoutine, createRoutine } = useRoutine();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRoutineForEdit, setSelectedRoutineForEdit] = useState<Routine | null>(null);


  const handleCreateRoutine = () => {
    setShowCreateForm(true);
  };

  const handleCreateEmptyRoutine = async () => {
    try {
      const emptyRoutine: Routine = {
        id: `routine-${Date.now()}`,
        name: 'New Empty Routine',
        description: 'Start building your custom routine by adding workouts.',
        exercises: [],
        createdAt: new Date(),
      };
      
      await createRoutine(emptyRoutine);
      await setCurrentRoutine(emptyRoutine);
      
      if (onRoutineCreated) {
        onRoutineCreated();
      }
    } catch (error) {
      console.error('Failed to create empty routine:', error);
    }
  };

  const handleCreateFormClose = () => {
    setShowCreateForm(false);
  };

  const handleRoutineCreated = async (data: RoutineCreationData) => {
    setShowCreateForm(false);
    // The context will automatically refresh, no need to manually reload
    if (onRoutineCreated) {
      onRoutineCreated();
    }
  };

  const handleRoutineSelect = async (routine: Routine) => {
    try {
      // Could add haptic feedback or navigation here
    } catch (error) {
      // Handle error silently or show user-friendly message
    }
  };

  const handleEditRoutine = (routine: Routine) => {
    setSelectedRoutineForEdit(routine);
    setCurrentRoutine(routine);
  };

  const handleCancelEdit = () => {
    setSelectedRoutineForEdit(null);
  };

  const handleDeleteRoutine = async (routineId: string, routineName: string) => {
    try {
      await deleteRoutineFromContext(routineId);
    } catch (error) {
      // Handle error silently or show user-friendly message
    }
  };



  const handleMainClose = () => {
    setShowCreateForm(false);
    setSelectedRoutineForEdit(null);
    onClose();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleMainClose}
    >
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <Text style={[
            styles.title,
            {
              color: currentTheme.colors.text,
              fontFamily: 'Raleway_700Bold',
            }
          ]}>
            {showCreateForm ? 'Create Routine' : selectedRoutineForEdit ? `Edit ${selectedRoutineForEdit.name}` : 'Browse Routines'}
          </Text>
          <TouchableOpacity onPress={handleMainClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
        </View>

        {!showCreateForm ? (
          selectedRoutineForEdit ? (
            <View style={styles.content}>
              {/* Back button */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleCancelEdit}
              >
                <Ionicons name="arrow-back" size={20} color={currentTheme.colors.text} />
                <Text style={[
                  styles.backButtonText,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_500Medium',
                  }
                ]}>
                  Back to Routines
                </Text>
              </TouchableOpacity>

              {/* Weekly Routine Scheduler for editing */}
              <WeeklyRoutineScheduler 
                onSelectedDayChange={() => {}} // Empty callback since we don't need day tracking in edit mode
              />
            </View>
          ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Create Routine Section */}
            <Text style={[
              styles.sectionHeader,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              Create Your Own Routine
            </Text>
            
            <Card style={styles.createCard} variant="elevated">
              <Text style={[
                styles.sectionDescription,
                {
                  color: currentTheme.colors.text,
                  fontFamily: 'Raleway_400Regular',
                  opacity: 0.7,
                }
              ]}>
                Build a custom workout routine tailored to your goals and schedule.
              </Text>
              
              <View style={styles.createButtonsContainer}>
                <Button
                  title="AI-Generated Routine"
                  onPress={handleCreateRoutine}
                  variant="primary"
                  size="medium"
                  style={styles.createButton}
                  hapticType="light"
                />
                <Button
                  title="Start Empty Routine"
                  onPress={handleCreateEmptyRoutine}
                  variant="secondary"
                  size="medium"
                  style={styles.createButton}
                  hapticType="light"
                />
              </View>
            </Card>

            {/* My Routines Section */}
            <Text style={[
              styles.sectionHeader,
              {
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_600SemiBold',
              }
            ]}>
              My Routines
            </Text>
            
            {routines.length === 0 ? (
              <Card style={styles.emptyCard} variant="surface">
                <Text style={[
                  styles.emptyText,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                    opacity: 0.6,
                  }
                ]}>
                  No routines yet. Create your first routine to get started!
                </Text>
              </Card>
            ) : (
              <View style={styles.routinesList}>
                {routines.map((routine) => (
                  <Card
                    key={routine.id}
                    style={styles.routineCard}
                    variant="surface"
                  >
                    <TouchableOpacity
                      style={styles.routineItem}
                      onPress={() => handleRoutineSelect(routine)}
                    >
                      <View style={styles.routineHeader}>
                        <Text style={[
                          styles.routineName,
                          {
                            color: currentTheme.colors.text,
                            fontFamily: 'Raleway_600SemiBold',
                          }
                        ]}>
                          {routine.name}
                        </Text>
                        <View style={styles.routineHeaderRight}>
                          <Text style={[
                            styles.routineDate,
                            {
                              color: currentTheme.colors.text,
                              fontFamily: 'Raleway_400Regular',
                              opacity: 0.6,
                            }
                          ]}>
                            {formatDate(routine.createdAt)}
                          </Text>
                          <TouchableOpacity
                            style={styles.editButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleEditRoutine(routine);
                            }}
                          >
                            <Ionicons 
                              name="create-outline" 
                              size={16} 
                              color={currentTheme.colors.text} 
                              style={{ opacity: 0.6 }}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteRoutine(routine.id, routine.name);
                            }}
                          >
                            <Ionicons 
                              name="trash-outline" 
                              size={16} 
                              color={currentTheme.colors.text} 
                              style={{ opacity: 0.6 }}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={[
                        styles.routineDescription,
                        {
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_400Regular',
                          opacity: 0.8,
                        }
                      ]}>
                        {routine.description}
                      </Text>
                      <Text style={[
                        styles.routineInfo,
                        {
                          color: currentTheme.colors.text,
                          fontFamily: 'Raleway_400Regular',
                          opacity: 0.6,
                        }
                      ]}>
                        {routine.exercises.length} workout{routine.exercises.length !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  </Card>
                ))}
              </View>
            )}
          </ScrollView>
          )
        ) : (
          <CreateRoutineFlow
            onClose={handleCreateFormClose}
            onCreateRoutine={handleRoutineCreated}
          />
        )}
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
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  createCard: {
    marginBottom: 24,
  },
  createButtonsContainer: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
  },
  createButton: {
    width: '100%',
  },
  emptyCard: {
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 20,
  },
  routinesList: {
    gap: 12,
  },
  routineCard: {
    marginBottom: 0,
  },
  routineItem: {
    padding: 0,
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routineHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routineName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  routineDate: {
    fontSize: 12,
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  routineDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  routineInfo: {
    fontSize: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  backButtonText: {
    marginLeft: 8,
  },
}); 