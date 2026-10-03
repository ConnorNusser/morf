import IconButton from '@/components/IconButton';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage/storage';
import { unlockedIds } from '@/lib/gamification/achievements';
import { CareerData, loadCareerData } from '@/lib/gamification/careerData';
import { panelPad, radius, screenGutter, space } from '@/lib/ui/tokens';
import { captureAndShare } from '@/lib/ui/shareUtils';
import AchievementGridView from '@/components/gamification/career/AchievementGridView';
import BestsView from '@/components/gamification/career/BestsView';
import ConsistencyView from '@/components/gamification/career/ConsistencyView';
import MuscleMasteryView from '@/components/gamification/career/MuscleMasteryView';
import NextGoal from '@/components/gamification/career/NextGoal';
import PersonalRecordsView from '@/components/gamification/career/PersonalRecordsView';
import RecentAchievementsView from '@/components/gamification/career/RecentAchievementsView';
import ShareStatStrip from '@/components/gamification/career/ShareStatStrip';
import TierHero from '@/components/gamification/career/TierHero';
import TierLadderView from '@/components/gamification/career/TierLadderView';
import TierTimelineView from '@/components/gamification/career/TierTimelineView';
import UnlockCelebration from '@/components/gamification/career/UnlockCelebration';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Stable empty set so a dismissed celebration doesn't allocate on every render.
const EMPTY_NEW_IDS: Set<string> = new Set();

export default function CareerModal({ visible, onClose }: Props) {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<CareerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedNew, setDismissedNew] = useState(false);
  const shareRef = useRef<ViewShot>(null);

  // The "new" highlights to show this view — cleared instantly when the user
  // dismisses the celebration (already persisted as seen on open).
  const newIds = data && !dismissedNew ? data.newIds : EMPTY_NEW_IDS;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const career = await loadCareerData();
      setData(career);
      // Acknowledge unlocks now that the user is viewing them, so the "new"
      // highlights clear next time.
      await storageService.setSeenAchievements(unlockedIds(career.achievements));
    } catch (err) {
      console.error('CareerModal: failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setDismissedNew(false);
      load();
    }
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <Text variant="screenTitle" tone="primary" weight="bold">Career</Text>
          <View style={styles.headerActions}>
            {data && (
              <IconButton
                icon="share-outline"
                onPress={() => captureAndShare(shareRef as React.RefObject<ViewShot>)}
              />
            )}
            <IconButton icon="close" onPress={onClose} />
          </View>
        </View>

        {loading || !data ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={currentTheme.colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {newIds.size > 0 && (
              <UnlockCelebration
                items={data.achievements.filter(a => newIds.has(a.id))}
                onDismiss={() => setDismissedNew(true)}
              />
            )}
            <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
              <View style={[styles.shareCard, { backgroundColor: currentTheme.colors.background }]}>
                <TierHero overall={data.overall} tier={data.tier} />
                <ShareStatStrip stats={data.stats} />
              </View>
            </ViewShot>
            <NextGoal achievements={data.achievements} />
            {/* Recent achievements — the six you unlocked most recently. (The
                lifetime stats that used to live here moved up into the hero card.) */}
            <RecentAchievementsView achievements={data.achievements} unlockedAt={data.achievementUnlockedAt} />
            <ConsistencyView heatmap={data.heatmap} unit={data.stats.unit} />
            {/* Strength */}
            <BestsView stats={data.stats} />
            <PersonalRecordsView prs={data.prs} />
            <MuscleMasteryView mastery={data.muscleMastery} />
            {/* Tier progression */}
            <TierLadderView ladder={data.ladder} />
            <TierTimelineView timeline={data.timeline} stats={data.stats} />
            <AchievementGridView achievements={data.achievements} newIds={newIds} />
            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenGutter,
    paddingBottom: space.sm,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: screenGutter, paddingTop: space.sm },
  bottomSpacer: { height: space.section },
  shareCard: { borderRadius: radius.card, paddingBottom: panelPad },
});
