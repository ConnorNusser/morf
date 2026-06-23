import { useTheme } from '@/contexts/ThemeContext';
import { useSound } from '@/hooks/useSound';
import { NotificationPreferences, storageService } from '@/lib/storage/storage';
import { RETENTION_NOTIFICATIONS_ENABLED, retentionNotificationService } from '@/lib/services/retentionNotificationService';
import playHapticFeedback from '@/lib/utils/haptic';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
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
    <Card style={styles.card} variant="clean">
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setIsExpanded(!isExpanded)} activeOpacity={0.7}>
        <View style={[styles.sectionHeaderContent, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.text }]}>Reminders</Text>
          <Text style={[styles.subtitle, { color: isExpanded ? currentTheme.colors.text : currentTheme.colors.primary }]}>
            {isExpanded ? 'Nudges to keep you training — on your terms' : summary}
          </Text>
        </View>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={currentTheme.colors.text} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.rows}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: currentTheme.colors.text }]}>Streak reminders</Text>
              <Text style={[styles.rowDesc, { color: currentTheme.colors.text + '80' }]}>
                A nudge when your streak is about to break
              </Text>
            </View>
            <Toggle value={prefs.streakReminders} onPress={() => toggle('streakReminders')} />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: currentTheme.colors.text }]}>Workout-day reminders</Text>
              <Text style={[styles.rowDesc, { color: currentTheme.colors.text + '80' }]}>
                A reminder on the days you usually train
              </Text>
            </View>
            <Toggle value={prefs.habitReminders} onPress={() => toggle('habitReminders')} />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: currentTheme.colors.text }]}>Comeback nudges</Text>
              <Text style={[styles.rowDesc, { color: currentTheme.colors.text + '80' }]}>
                A gentle nudge if it's been a while since you trained
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
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  rows: {
    gap: 20,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 13,
    marginTop: 2,
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
