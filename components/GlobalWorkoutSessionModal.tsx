import { WorkoutSessionModalV2 } from '@/components/workoutsession';
import { useWorkoutSessionContext } from '@/contexts/WorkoutSessionContext';
import { useSound } from '@/hooks/useSound';
import { ActiveWorkoutSession, convertActiveWorkoutSessionToGeneratedWorkout, GeneratedWorkout } from '@/types';
import React, { useState } from 'react';
import WorkoutCompletionModal from './WorkoutCompletionModal';
import { useWorkout } from '@/contexts/WorkoutContext';

export default function GlobalWorkoutSessionModal() {
  const { 
    isModalVisible, 
    generatedWorkout, 
    closeWorkoutModal,
  } = useWorkoutSessionContext();

  const { createWorkout: createStandaloneWorkout } = useWorkout();

  const { play: playSelectionComplete } = useSound('selectionComplete');

  const [completedWorkoutData, setCompletedWorkoutData] = useState<{
    session: ActiveWorkoutSession;
    stats: {
      duration: number;
      totalSets: number;
      totalVolume: number;
      progressUpdates: number;
    };
  } | null>(null);

  const handleWorkoutComplete = (workoutData?: any) => {    
    if (workoutData) {
      setCompletedWorkoutData(workoutData);
    }
  };

  const handleModalClose = () => {
    playSelectionComplete();
    setCompletedWorkoutData(null);
    closeWorkoutModal();
  };

  const handleModalCloseAndSave = () => {
    if (completedWorkoutData) {
      createStandaloneWorkout(convertActiveWorkoutSessionToGeneratedWorkout(completedWorkoutData.session));
    }
    playSelectionComplete();
    setCompletedWorkoutData(null);
    closeWorkoutModal();
  };

  // If workout is completed, show completion content, otherwise show workout session
  const isShowingCompletion = !!completedWorkoutData;

  return (
    <>
      {isShowingCompletion ? (
        <WorkoutCompletionModal
          visible={isModalVisible}
          onClose={handleModalClose}
          onCloseAndSave={handleModalCloseAndSave}
          workoutSession={completedWorkoutData.session}
          workoutStats={completedWorkoutData.stats}
        />
      ) : (
        <WorkoutSessionModalV2
          visible={isModalVisible}
          onClose={closeWorkoutModal}
          workout={generatedWorkout}
          onWorkoutComplete={handleWorkoutComplete}
        />
      )}
    </>
  );
} 