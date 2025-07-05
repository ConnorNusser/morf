import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const REST_TIMER_KEY = 'activeRestTimer';

interface RestTimerData {
  startTime: string; // ISO string
  duration: number; // seconds
}

export const useRestTimer = () => {
  const [isResting, setIsResting] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  // Load any existing rest timer on mount
  useEffect(() => {
    loadExistingTimer();
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

  const startTimer = async (duration: number = 90) => {
    try {
      const timerData: RestTimerData = {
        startTime: new Date().toISOString(),
        duration,
      };

      await AsyncStorage.setItem(REST_TIMER_KEY, JSON.stringify(timerData));
      setIsResting(true);
      setRemainingTime(duration);
    } catch (error) {
      console.error('Error starting rest timer:', error);
    }
  };

  const skipTimer = async () => {
    await endTimer();
  };

  const endTimer = async () => {
    await clearTimer();
    setIsResting(false);
    setRemainingTime(0);
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
  };
}; 