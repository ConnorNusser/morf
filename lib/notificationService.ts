import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { analyticsService } from './analytics';
import { Notification, NotificationData, RemoteUser } from '@/types';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private currentUserId: string | null = null;
  private expoPushToken: string | null = null;

  /**
   * Get current user ID (cached)
   */
  private async getCurrentUserId(): Promise<string | null> {
    if (this.currentUserId) return this.currentUserId;

    if (!supabase) return null;

    try {
      const deviceId = await analyticsService.getDeviceId();
      const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('device_id', deviceId)
        .single();

      if (error || !user) return null;
      this.currentUserId = user.id;
      return user.id;
    } catch {
      return null;
    }
  }

  /**
   * Register for push notifications and get Expo push token
   */
  async registerForPushNotifications(): Promise<string | null> {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return null;
      }

      // Get the Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('No EAS project ID found');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      this.expoPushToken = tokenData.data;

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
        });
      }

      // Save token to database
      await this.savePushToken(this.expoPushToken);

      return this.expoPushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Save push token to Supabase
   */
  private async savePushToken(token: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return false;

      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token,
          device_type: Platform.OS,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,token',
        });

      if (error) {
        console.error('Error saving push token:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error saving push token:', error);
      return false;
    }
  }

  /**
   * Remove push token (call on logout or when disabling notifications)
   */
  async removePushToken(): Promise<boolean> {
    if (!supabase || !this.expoPushToken) return false;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return false;

      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', this.expoPushToken);

      if (error) {
        console.error('Error removing push token:', error);
        return false;
      }

      this.expoPushToken = null;
      return true;
    } catch (error) {
      console.error('Error removing push token:', error);
      return false;
    }
  }

  /**
   * Get push tokens for a user's friends
   */
  private async getFriendPushTokens(): Promise<string[]> {
    if (!supabase) return [];

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      // Get friend IDs
      const { data: friends, error: friendsError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId);

      if (friendsError || !friends || friends.length === 0) return [];

      const friendIds = friends.map(f => f.friend_id);

      // Get push tokens for friends
      const { data: tokens, error: tokensError } = await supabase
        .from('push_tokens')
        .select('token')
        .in('user_id', friendIds);

      if (tokensError || !tokens) return [];

      return tokens.map(t => t.token);
    } catch (error) {
      console.error('Error getting friend push tokens:', error);
      return [];
    }
  }

  /**
   * Send push notifications to Expo's push service
   */
  private async sendPushNotifications(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<boolean> {
    if (tokens.length === 0) return true;

    try {
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default' as const,
        title,
        body,
        data: data || {},
      }));

      // Send to Expo's push service
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        console.error('Failed to send push notifications:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending push notifications:', error);
      return false;
    }
  }

  /**
   * Notify friends when user hits a PR (stores in DB + sends push)
   */
  async notifyFriendsOfPR(
    exerciseId: string,
    exerciseName: string,
    newPR: number,
    previousPR: number
  ): Promise<boolean> {
    if (!supabase) return false;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return false;

      // Get current user's username for the notification
      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('id', userId)
        .single();

      const username = userData?.username || 'A friend';

      // Store notification in database for all friends
      const { error } = await supabase.rpc('notify_friends_of_pr', {
        p_user_id: userId,
        p_exercise_id: exerciseId,
        p_exercise_name: exerciseName,
        p_new_pr: newPR,
        p_previous_pr: previousPR,
      });

      if (error) {
        console.error('Error creating PR notifications:', error);
      }

      // Send push notifications to friends
      const friendTokens = await this.getFriendPushTokens();
      if (friendTokens.length > 0) {
        const improvement = previousPR > 0
          ? ` (+${Math.round(newPR - previousPR)} lbs)`
          : '';

        await this.sendPushNotifications(
          friendTokens,
          `${username} hit a new PR! 🎉`,
          `${exerciseName}: ${Math.round(newPR)} lbs${improvement}`,
          {
            type: 'friend_pr',
            exerciseId,
            exerciseName,
            newPR,
            previousPR,
            fromUserId: userId,
          }
        );
      }

      return true;
    } catch (error) {
      console.error('Error notifying friends of PR:', error);
      return false;
    }
  }

  /**
   * Get notifications for the current user
   */
  async getNotifications(limit: number = 50): Promise<Notification[]> {
    if (!supabase) return [];

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          type,
          from_user_id,
          data,
          read,
          created_at,
          from_user:from_user_id (
            id,
            device_id,
            username,
            profile_picture_url,
            country_code
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting notifications:', error);
        return [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        type: row.type,
        from_user: row.from_user as RemoteUser,
        data: row.data as NotificationData,
        read: row.read,
        created_at: new Date(row.created_at),
      }));
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    if (!supabase) return 0;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error getting unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error marking notification read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<boolean> {
    if (!supabase) return false;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return false;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error marking all notifications read:', error);
      return false;
    }
  }

  /**
   * Add notification response listener (when user taps notification)
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Add notification received listener (when notification arrives)
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<boolean> {
    return await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear all delivered notifications
   */
  async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }
}

export const notificationService = new NotificationService();
