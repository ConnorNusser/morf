import LevelRing from '@/components/gamification/LevelRing';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { LevelProgress } from '@/lib/gamification/levelCurve';
import { formatXp, nextRankLine, upcomingTitle } from '@/lib/gamification/levelDisplay';
import { rankAccentForLevel } from '@/lib/gamification/ranks';
import { readableInkOn } from '@/lib/ui/contrast';
import { radius, space } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface Props {
  level: LevelProgress | null;
  visible: boolean;
  onDismiss: () => void;
  /** Secondary action: dismiss and open Career. */
  onViewCareer?: () => void;
}

// One-time intro for existing users after the leveling update: their history
// already earned XP retroactively, so they get a single "You're Level N" card
// instead of a chain of level-ups. Same overlay pattern as UnlockNotificationModal.
export default function LevelIntroModal({ level, visible, onDismiss, onViewCareer }: Props) {
  const { currentTheme } = useTheme();
  const show = visible && level !== null;

  useEffect(() => {
    if (show) playHapticFeedback('success', false);
  }, [show]);

  if (!show || !level) return null;
  const next = upcomingTitle(level.level, 10);
  const dark = readableInkOn(currentTheme.colors.surface) === '#FFFFFF';
  const accent = rankAccentForLevel(level.level, dark, level.progress);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              entering={FadeIn.delay(100).duration(400)}
              style={[styles.card, { backgroundColor: currentTheme.colors.surface }]}
            >
              <Text variant="meta" weight="bold" tone="muted" style={styles.kicker}>
                INTRODUCING LEVELS
              </Text>
              <LevelRing level={level.level} progress={level.progress} size={112} emblem="inside" color={accent} />
              <Text variant="heading" weight="bold" tone="primary" style={styles.center}>
                {"You're "}
                <Text variant="heading" weight="bold" style={{ color: accent }}>
                  {level.title}
                </Text>
                {' · Level '}
                {level.level}
              </Text>
              <Text variant="meta" tone="secondary" style={styles.center}>
                Every workout you&apos;ve logged counted: {formatXp(level.totalXp)} XP earned so far.
                {' '}
                {formatXp(level.xpToNext)} XP to Level {level.level + 1}.
              </Text>
              {next && (
                <Text variant="meta" tone="muted" style={styles.center}>
                  {nextRankLine(next)}
                </Text>
              )}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
                  onPress={onDismiss}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Text variant="body" weight="semiBold" style={styles.primaryText}>
                    Let&apos;s go
                  </Text>
                </TouchableOpacity>
                {onViewCareer && (
                  <TouchableOpacity
                    style={[styles.button, styles.secondary, { borderColor: currentTheme.colors.border }]}
                    onPress={() => {
                      onDismiss();
                      onViewCareer();
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Text variant="body" weight="medium" tone="secondary">
                      View career
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.section,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    padding: space.section,
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
  },
  kicker: { letterSpacing: 1 },
  center: { textAlign: 'center' },
  actions: { width: '100%', gap: space.md, marginTop: space.sm },
  button: {
    paddingVertical: space.md,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  secondary: { borderWidth: 1 },
  primaryText: { color: '#fff' }, // on the primary fill, as in EmptyState's CTA
});
