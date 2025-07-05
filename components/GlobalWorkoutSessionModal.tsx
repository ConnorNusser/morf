import { useWorkoutSessionContext } from '@/contexts/WorkoutSessionContext';
import { ActiveWorkoutSession } from '@/types';
import React, { useState } from 'react';
import WorkoutCompletionModal from './WorkoutCompletionModal';
import WorkoutSessionModal from './WorkoutSessionModal';
import { useSound } from '@/hooks/useSound';

export default function GlobalWorkoutSessionModal() {
  const { 
    isModalVisible, 
    generatedWorkout, 
    closeWorkoutModal
  } = useWorkoutSessionContext();

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
      console.log('🎉 Workout completed');
      setCompletedWorkoutData(workoutData);
    }
  };

  const handleModalClose = () => {
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
          workoutSession={completedWorkoutData.session}
          workoutStats={completedWorkoutData.stats}
        />
      ) : (
        <WorkoutSessionModal
          visible={isModalVisible}
          onClose={closeWorkoutModal}
          workout={generatedWorkout}
          onWorkoutComplete={handleWorkoutComplete}
        />
      )}
    </>
  );
} 