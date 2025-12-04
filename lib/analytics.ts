import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'device_id';

class AnalyticsService {
  private deviceId: string | null = null;

  /**
   * Get or create a unique device ID for anonymous tracking
   */
  async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;

    try {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = this.generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      }
      this.deviceId = id;
      return id;
    } catch (error) {
      console.error('Error getting device ID:', error);
      // Fallback to a temporary ID if storage fails
      return this.generateDeviceId();
    }
  }

  private generateDeviceId(): string {
    // Generate a UUID-like string
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Track a completed workout
   */
  async trackWorkoutCompleted(data: {
    workoutId: string;
    exerciseCount: number;
    totalSets: number;
    durationSeconds: number;
  }): Promise<void> {
    if (!supabase) return;

    try {
      const deviceId = await this.getDeviceId();

      const { error } = await supabase.from('workout_completions').insert({
        device_id: deviceId,
        workout_id: data.workoutId,
        exercise_count: data.exerciseCount,
        total_sets: data.totalSets,
        duration_seconds: data.durationSeconds,
      });

      if (error) {
        console.error('Error tracking workout:', error);
      }
    } catch (error) {
      console.error('Error tracking workout:', error);
    }
  }

  /**
   * Track AI usage (note parsing, routine generation, etc.)
   */
  async trackAIUsage(data: {
    requestType: 'note_parse' | 'routine_generate' | 'plan_builder';
    inputText: string;
    outputData: unknown;
    tokensUsed?: number;
    model?: string;
  }): Promise<void> {
    if (!supabase) return;

    try {
      const deviceId = await this.getDeviceId();

      const { error } = await supabase.from('ai_usage').insert({
        device_id: deviceId,
        request_type: data.requestType,
        input_text: data.inputText,
        output_data: data.outputData,
        tokens_used: data.tokensUsed ?? null,
        model: data.model ?? null,
      });

      if (error) {
        console.error('Error tracking AI usage:', error);
      }
    } catch (error) {
      console.error('Error tracking AI usage:', error);
    }
  }
}

export const analyticsService = new AnalyticsService();
