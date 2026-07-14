import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { analyticsService } from './analytics';
import { storageService } from '@/lib/storage/storage';
import { dateKey, formatCompact } from '@/lib/utils/utils';

// How notifications present while the app is foregrounded.
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

  async registerForPushNotifications(): Promise<string | null> {
    // Push only works on physical devices.
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('No EAS project ID found');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      this.expoPushToken = tokenData.data;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
        });
      }

      await this.savePushToken(this.expoPushToken);

      return this.expoPushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

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

  private async getFriendPushTokens(): Promise<string[]> {
    if (!supabase) return [];

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      const { data: friends, error: friendsError } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId);

      if (friendsError || !friends || friends.length === 0) return [];

      const friendIds = friends.map(f => f.friend_id);

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

  /** Notify friends of a PR: stores in DB + sends push. */
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

      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('id', userId)
        .single();

      const username = userData?.username || 'A friend';

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

  private async getUserPushTokens(userId: string): Promise<string[]> {
    if (!supabase) return [];

    try {
      const { data: tokens, error } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', userId);

      if (error || !tokens) return [];

      return tokens.map(t => t.token);
    } catch (error) {
      console.error('Error getting user push tokens:', error);
      return [];
    }
  }

  /** Push-only: notify the post author when someone likes their post. */
  async notifyPostLike(
    authorId: string,
    fromUserId: string,
    fromUsername: string,
    postText: string
  ): Promise<boolean> {
    if (authorId === fromUserId) return true; // don't notify self-likes

    try {
      const authorTokens = await this.getUserPushTokens(authorId);
      if (authorTokens.length === 0) return true;

      const truncatedText = postText.length > 50
        ? postText.substring(0, 50) + '...'
        : postText;

      await this.sendPushNotifications(
        authorTokens,
        `${fromUsername} liked your post`,
        truncatedText || 'Your post',
        {
          type: 'post_like',
          fromUserId,
        }
      );

      return true;
    } catch (error) {
      console.error('Error notifying post like:', error);
      return false;
    }
  }

  /** Push-only: notify the post author when someone comments on their post. */
  async notifyPostComment(
    authorId: string,
    fromUserId: string,
    fromUsername: string,
    commentText: string
  ): Promise<boolean> {
    if (authorId === fromUserId) return true; // don't notify self-comments

    try {
      const authorTokens = await this.getUserPushTokens(authorId);
      if (authorTokens.length === 0) return true;

      const truncatedComment = commentText.length > 100
        ? commentText.substring(0, 100) + '...'
        : commentText;

      await this.sendPushNotifications(
        authorTokens,
        `${fromUsername} commented on your post`,
        truncatedComment,
        {
          type: 'post_comment',
          fromUserId,
        }
      );

      return true;
    } catch (error) {
      console.error('Error notifying post comment:', error);
      return false;
    }
  }

  /**
   * Push-only: tell friends the viewer just moved ahead of them on the weekly
   * league (docs/leagues-v1-spec.md). Friend-scoped by construction — callers
   * pass ids from detectOvertakes, which only returns friends. Rate-limited to
   * one push per friend per local day via LEAGUE_OVERTAKES_SENT markers.
   */
  async notifyLeagueOvertakes(
    overtaken: { userId: string; points: number }[],
    myUsername: string,
    myPoints: number,
    daysLeft: number
  ): Promise<void> {
    if (overtaken.length === 0) return;

    try {
      const today = dateKey(new Date());
      const sent = await storageService.getLeagueOvertakesSent();
      const fresh = overtaken.filter(o => !sent.includes(`${o.userId}:${today}`));
      if (fresh.length === 0) return;

      const dayWord = daysLeft === 1 ? 'day' : 'days';
      await Promise.all(
        fresh.map(async o => {
          const tokens = await this.getUserPushTokens(o.userId);
          if (tokens.length === 0) return;
          await this.sendPushNotifications(
            tokens,
            `${myUsername} just passed you in the weekly league`,
            `${formatCompact(myPoints)} pts to your ${formatCompact(o.points)}. ${daysLeft} ${dayWord} left this week.`,
            { type: 'league_overtake' }
          );
        })
      );

      await storageService.setLeagueOvertakesSent([
        ...sent,
        ...fresh.map(o => `${o.userId}:${today}`),
      ]);
    } catch (error) {
      console.error('Error sending league overtake pushes:', error);
    }
  }

  /** Fires when the user taps a notification. */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /** Fires when a notification arrives. */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

}

export const notificationService = new NotificationService();
