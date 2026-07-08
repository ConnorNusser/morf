import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { NotificationPreferences, storageService } from '@/lib/storage/storage';
import { RETENTION_NOTIFICATIONS_ENABLED, retentionNotificationService } from '@/lib/services/retentionNotificationService';
import playHapticFeedback from '@/lib/utils/haptic';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { space } from '@/lib/ui/tokens';
import Card from '../Card';
import { Text } from '../Themed';

const NotificationPreferencesSection = () => {
  const { currentTheme } = useTheme();
  const { play: playSound } = useSound('pop');
  const [isExpanded, setIsExpanded] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    storageService.getNotificationPreferences().then(setPrefs);
  }, []);

  // Hidden until the feature is turned on.
  if (!RETENTION_NOTIFICATIONS_ENABLED || !prefs) return null;

  const toggle = async (key: 'streakReminders' | 'habitReminders' | 'comebackReminders') => {
    playHapticFeedback('selection', false);
    playSound();
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await storageService.saveNotificationPreferences(next);
    await retentionNotificationService.refreshScheduledReminders();
  };

  const allOn = prefs.streakReminders && prefs.habitReminders && prefs.comebackReminders;
  const allOff = !prefs.streakReminders && !prefs.habitReminders && !prefs.comebackReminders;
  const summary = allOn ? 'On' : allOff ? 'Off' : 'Custom';

  const Toggle = ({ value, onPress }: { value: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.track,
        {
          backgroundColor: value ? currentTheme.colors.primary : currentTheme.colors.border,
          justifyContent: value ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View style={styles.knob} />
    </TouchableOpacity>
  );

  return (
    <Card style={styles.card}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.7}>
        <View style={[styles.sectionHeaderContent, { backgroundColor: 'transparent' }]}>
          <Text variant="title" weight="bold" tone="primary" style={styles.sectionTitle}>Reminders</Text>
          <Text variant="meta" tone={isExpanded ? 'secondary' : undefined} style={styles.subtitle}>
            {isExpanded ? 'Nudges to keep you training — on your terms' : summary}
          </Text>
        </View>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={currentTheme.colors.text} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.rows}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text variant="body" weight="semiBold" tone="primary" style={styles.rowTitle}>Streak reminders</Text>
              <Text variant="meta" tone="secondary" style={styles.rowDesc}>
                A nudge when your streak is about to break
              </Text>
            </View>
            <Toggle value={prefs.streakReminders} onPress={() => toggle('streakReminders')} />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text variant="body" weight="semiBold" tone="primary" style={styles.rowTitle}>Workout-day reminders</Text>
              <Text variant="meta" tone="secondary" style={styles.rowDesc}>
                A reminder on the days you usually train
              </Text>
            </View>
            <Toggle value={prefs.habitReminders} onPress={() => toggle('habitReminders')} />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text variant="body" weight="semiBold" tone="primary" style={styles.rowTitle}>Comeback nudges</Text>
              <Text variant="meta" tone="secondary" style={styles.rowDesc}>
                A gentle nudge if it&apos;s been a while since you trained
              </Text>
            </View>
            <Toggle value={prefs.comebackReminders} onPress={() => toggle('comebackReminders')} />
          </View>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: space.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
  },
  subtitle: {
    marginTop: space.xs,
  },
  rows: {
    gap: space.xl,
    paddingTop: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
  },
  rowDesc: {
    marginTop: space.xs,
    lineHeight: 18,
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
});

export default NotificationPreferencesSection;
