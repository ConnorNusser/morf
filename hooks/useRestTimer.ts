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

// Read the persisted timer and compute elapsed/remaining seconds, or null when
// there's no active timer. Callers keep their own try/catch (this can throw).
const readTimer = async (): Promise<{ data: RestTimerData; elapsed: number; remaining: number } | null> => {
  const raw = await AsyncStorage.getItem(REST_TIMER_KEY);
  if (!raw) return null;
  const data: RestTimerData = JSON.parse(raw);
  const elapsed = Math.floor((Date.now() - new Date(data.startTime).getTime()) / 1000);
  const remaining = Math.max(0, data.duration - elapsed);
  return { data, elapsed, remaining };
};

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
      const timer = await readTimer();
      if (timer) {
        if (timer.remaining > 0) {
          setIsResting(true);
          setRemainingTime(timer.remaining);
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
      const timer = await readTimer();
      if (timer) {
        setRemainingTime(timer.remaining);
        if (timer.remaining <= 0) {
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

      // Flip into rest and push the Lock Screen card *synchronously*, before the
      // awaited storage write. A set is checked off in the same tick the draft
      // advances to the next set; if `isResting` only flipped after this await,
      // the set-mode Live Activity effect would fire on that tick (isResting still
      // false) and publish a "next set" card that the rest card then overwrites —
      // the visible flicker. Setting state here batches it with the draft toggle,
      // so the committed render already reads isResting=true and the set effect
      // stands down. The rest push is also the last native write, so it wins.
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

      await AsyncStorage.setItem(REST_TIMER_KEY, JSON.stringify(timerData));
    } catch (error) {
      console.error('Error starting rest timer:', error);
    }
  };

  const skipTimer = async () => {
    await endTimer();
  };

  const addTime = async (seconds: number) => {
    try {
      const timer = await readTimer();
      if (timer) {
        // Calculate new duration by adding seconds to current remaining + elapsed
        const newRemaining = Math.max(0, timer.remaining + seconds);

        // Update the timer with new duration (keeping same start time)
        const newTimerData: RestTimerData = {
          startTime: timer.data.startTime,
          duration: timer.elapsed + newRemaining,
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