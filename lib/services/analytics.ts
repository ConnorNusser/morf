import { supabase } from './supabase';
import { deviceService } from './deviceService';

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
  /**
   * Get device ID from deviceService
   */
  async getDeviceId(): Promise<string> {
    return deviceService.getDeviceId();
  }

  /**
   * Get username from deviceService
   */
  async getUsername(): Promise<string | null> {
    return deviceService.getUsername();
  }

  /**
   * Set username via deviceService
   */
  async setUsername(username: string): Promise<void> {
    return deviceService.setUsername(username);
  }

  /**
   * Generate a default username via deviceService
   */
  async generateDefaultUsername(): Promise<string> {
    return deviceService.generateDefaultUsername();
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
