// Full-screen workout clock — every timer verb in one place (pause/resume,
// start rest, restart), in the HoldTimer grammar. pageSheet = native swipe-down.
import Button from '@/components/Button';
import IconButton from '@/components/IconButton';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { space } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import React from 'react';
import { Modal, SafeAreaView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface WorkoutClockSheetProps {
  visible: boolean;
  formatted: string;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStartRest: () => void;
  onRestart: () => void;
  onClose: () => void;
}

export default function WorkoutClockSheet({
  visible,
  formatted,
  isPaused,
  onPause,
  onResume,
  onStartRest,
  onRestart,
  onClose,
}: WorkoutClockSheetProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <RNView style={styles.header}>
          <RNView style={[styles.grabber, { backgroundColor: ink.ghost }]} />
          <RNView style={styles.closeRow}>
            <IconButton icon="chevron-down" onPress={onClose} />
          </RNView>
        </RNView>

        <RNView style={styles.center}>
          <Text
            variant="meta"
            weight="semiBold"
            style={[styles.label, { color: isPaused ? '#F59E0B' : undefined }]}
            tone={isPaused ? undefined : 'muted'}
          >
            {isPaused ? 'PAUSED' : 'ELAPSED'}
          </Text>
          <Text
            variant="header"
            weight="bold"
            tone="primary"
            style={[styles.clock, { fontVariant: ['tabular-nums'] }, isPaused && styles.pausedClock]}
          >
            {formatted}
          </Text>
        </RNView>

        <RNView style={styles.actions}>
          <Button
            title={isPaused ? 'Resume workout' : 'Pause workout'}
            variant="primary"
            onPress={() => {
              playHapticFeedback('medium', false);
              if (isPaused) onResume();
              else onPause();
            }}
          />
          <Button
            title="Start rest"
            variant="secondary"
            onPress={() => {
              playHapticFeedback('light', false);
              onStartRest();
              onClose();
            }}
          />
          <TouchableOpacity onPress={onRestart} style={styles.restart} activeOpacity={0.7}>
            <Text variant="body" tone="muted">Restart timer</Text>
          </TouchableOpacity>
        </RNView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: space.sm,
    gap: space.xs,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  closeRow: {
    alignItems: 'flex-start',
    paddingHorizontal: space.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.section,
  },
  label: {
    letterSpacing: 3,
  },
  clock: {
    fontSize: 88,
    lineHeight: 96,
  },
  pausedClock: {
    opacity: 0.6,
  },
  actions: {
    paddingHorizontal: space.section,
    paddingBottom: space.section,
    gap: space.md,
  },
  restart: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
});
