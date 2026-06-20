import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { endLiveActivity, startLiveActivity, updateLiveActivity } from '@/lib/liveActivity/liveActivity';

const REST_TIMER_KEY = 'activeRestTimer';

interface RestTimerData {
  startTime: string; // ISO string
  duration: number; // seconds
}

// Optional context shown on the Lock Screen Live Activity for this rest.
interface RestContext {
  workoutTitle?: string;
  exerciseName?: string;
  nextLabel?: string;
}

// Epoch ms when a rest ends — the Live Activity self-ticks down to this.
const restEndTime = (d: RestTimerData): number => new Date(d.startTime).getTime() + d.duration * 1000;

export const useRestTimer = () => {
  const [isResting, setIsResting] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  // Load any existing rest timer on mount
  useEffect(() => {
    loadExistingTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run on mount
  }, []);

  // Update timer every second when resting
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isResting) {
      interval = setInterval(() => {
        updateTimer();
      }, 1000);
    }

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateTimer is stable, only re-run when isResting changes
  }, [isResting]);

  const loadExistingTimer = async () => {
    try {
      const data = await AsyncStorage.getItem(REST_TIMER_KEY);
      if (data) {
        const timerData: RestTimerData = JSON.parse(data);
        const now = new Date();
        const startTime = new Date(timerData.startTime);
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const remaining = Math.max(0, timerData.duration - elapsed);

        if (remaining > 0) {
          setIsResting(true);
          setRemainingTime(remaining);
        } else {
          // Timer expired while app was closed
          await clearTimer();
        }
      }
    } catch (error) {
      console.error('Error loading rest timer:', error);
    }
  };

  const updateTimer = async () => {
    try {
      const data = await AsyncStorage.getItem(REST_TIMER_KEY);
      if (data) {
        const timerData: RestTimerData = JSON.parse(data);
        const now = new Date();
        const startTime = new Date(timerData.startTime);
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const remaining = Math.max(0, timerData.duration - elapsed);

        setRemainingTime(remaining);

        if (remaining <= 0) {
          await endTimer();
        }
      }
    } catch (error) {
      console.error('Error updating rest timer:', error);
    }
  };

  const startTimer = async (duration: number = 90, context?: RestContext) => {
    try {
      const timerData: RestTimerData = {
        startTime: new Date().toISOString(),
        duration,
      };

      await AsyncStorage.setItem(REST_TIMER_KEY, JSON.stringify(timerData));
      setIsResting(true);
      setRemainingTime(duration);

      // Surface the countdown on the Lock Screen / Dynamic Island. No-op until
      // the native target is built; self-ticks to endTime without further updates.
      startLiveActivity({
        mode: 'rest',
        workoutTitle: context?.workoutTitle ?? 'Workout',
        rest: {
          // No placeholder — an empty name lets the widget show just "REST"
          // instead of echoing the word twice.
          endTime: restEndTime(timerData),
          exerciseName: context?.exerciseName ?? '',
          nextLabel: context?.nextLabel,
        },
      });
    } catch (error) {
      console.error('Error starting rest timer:', error);
    }
  };

  const skipTimer = async () => {
    await endTimer();
  };

  const addTime = async (seconds: number) => {
    try {
      const data = await AsyncStorage.getItem(REST_TIMER_KEY);
      if (data) {
        const timerData: RestTimerData = JSON.parse(data);
        // Calculate new duration by adding seconds to current remaining + elapsed
        const now = new Date();
        const startTime = new Date(timerData.startTime);
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const currentRemaining = Math.max(0, timerData.duration - elapsed);
        const newRemaining = Math.max(0, currentRemaining + seconds);

        // Update the timer with new duration (keeping same start time)
        const newTimerData: RestTimerData = {
          startTime: timerData.startTime,
          duration: elapsed + newRemaining,
        };

        await AsyncStorage.setItem(REST_TIMER_KEY, JSON.stringify(newTimerData));
        setRemainingTime(newRemaining);

        // Push the new end time to the Live Activity so its countdown re-syncs.
        updateLiveActivity({
          mode: 'rest',
          workoutTitle: 'Workout',
          rest: { endTime: restEndTime(newTimerData), exerciseName: '' },
        });

        // If we subtracted all time, end the timer
        if (newRemaining <= 0) {
          await endTimer();
        }
      }
    } catch (error) {
      console.error('Error adding time to rest timer:', error);
    }
  };

  const endTimer = async () => {
    await clearTimer();
    setIsResting(false);
    setRemainingTime(0);
    endLiveActivity();
  };

  const clearTimer = async () => {
    try {
      await AsyncStorage.removeItem(REST_TIMER_KEY);
    } catch (error) {
      console.error('Error clearing rest timer:', error);
    }
  };

  // Format time as MM:SS
  const formattedTime = (): string => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    isResting,
    remainingTime,
    formattedTime: formattedTime(),
    startTimer,
    skipTimer,
    addTime,
  };
}; 