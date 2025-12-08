import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'device_id';
const USERNAME_KEY = 'username';
const FEED_API_URL = 'https://feed.morf.fyi';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'sync' | 'workout' | 'auth' | 'ai' | 'general';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  event: string;
  message?: string;
  context?: Record<string, unknown>;
}

class AnalyticsService {
  private deviceId: string | null = null;
  private username: string | null = null;

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
   * Get the stored username
   */
  async getUsername(): Promise<string | null> {
    if (this.username) return this.username;

    try {
      const username = await AsyncStorage.getItem(USERNAME_KEY);
      this.username = username;
      return username;
    } catch (error) {
      console.error('Error getting username:', error);
      return null;
    }
  }

  /**
   * Set the username
   */
  async setUsername(username: string): Promise<void> {
    try {
      await AsyncStorage.setItem(USERNAME_KEY, username);
      this.username = username;
    } catch (error) {
      console.error('Error setting username:', error);
    }
  }

  /**
   * Generate a default username (short UUID)
   */
  async generateDefaultUsername(): Promise<string> {
    const deviceId = await this.getDeviceId();
    // Use first 8 characters of device ID as default username
    return `user_${deviceId.substring(0, 8)}`;
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
        this.logErr('workout', 'workout_track_failed', error.message, { code: error.code });
      } else {
        // Log successful workout completion
        this.logInfo('workout', 'workout_completed', 'Workout completed successfully', {
          exerciseCount: data.exerciseCount,
          totalSets: data.totalSets,
          durationMinutes: Math.round(data.durationSeconds / 60)
        });
      }
    } catch (error) {
      console.error('Error tracking workout:', error);
      this.logErr('workout', 'workout_track_error', error instanceof Error ? error.message : 'Unknown error');
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
        this.logErr('ai', 'ai_usage_track_failed', error.message, {
          code: error.code,
          requestType: data.requestType
        });
      } else {
        this.logInfo('ai', `ai_${data.requestType}`, `AI ${data.requestType} completed`, {
          tokensUsed: data.tokensUsed,
          model: data.model
        });
      }
    } catch (error) {
      console.error('Error tracking AI usage:', error);
      this.logErr('ai', 'ai_usage_track_error', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Log an error to Supabase for debugging
   * @deprecated Use log() with level='error' instead
   */
  async logError(data: {
    errorType: string;
    message: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    await this.log({
      level: 'error',
      category: 'general',
      event: data.errorType,
      message: data.message,
      context: data.context,
    });
  }

  /**
   * Unified logging method for all app events
   * Logs to self-hosted server instead of Supabase
   */
  async log(entry: LogEntry): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const username = await this.getUsername();

      const response = await fetch(`${FEED_API_URL}/api/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: deviceId,
          username: username,
          level: entry.level,
          category: entry.category,
          event: entry.event,
          message: entry.message ?? null,
          context: entry.context ?? null,
        }),
      });

      if (!response.ok) {
        // Don't log this error to avoid infinite loop, just console
        console.error('Error logging to server:', response.status);
      }
    } catch (err) {
      // Don't log this error to avoid infinite loop, just console
      console.error('Error logging to server:', err);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  async logInfo(category: LogCategory, event: string, message?: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ level: 'info', category, event, message, context });
  }

  async logWarn(category: LogCategory, event: string, message?: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ level: 'warn', category, event, message, context });
  }

  async logErr(category: LogCategory, event: string, message?: string, context?: Record<string, unknown>): Promise<void> {
    await this.log({ level: 'error', category, event, message, context });
  }
}

export const analyticsService = new AnalyticsService();
