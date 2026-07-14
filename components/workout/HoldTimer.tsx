// Full-screen count-up for timed holds (dead hang, plank…). Wall-clock derived
// so backgrounding doesn't drift it; Stop logs the elapsed seconds into the set.
import Button from '@/components/Button';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { space } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface HoldTimerProps {
  visible: boolean;
  exerciseName: string;
  setNumber: number;
  /** Elapsed seconds land in the set (done). */
  onStop: (seconds: number) => void;
  onCancel: () => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function HoldTimer({ visible, exerciseName, setNumber, onStop, onCancel }: HoldTimerProps) {
  const { currentTheme } = useTheme();
  const startRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) return;
    startRef.current = Date.now();
    setElapsed(0);
    playHapticFeedback('medium', false);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [visible]);

  const stop = () => {
    playHapticFeedback('medium', false);
    onStop(Math.max(1, Math.floor((Date.now() - startRef.current) / 1000)));
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <RNView style={styles.center}>
          <Text variant="title" weight="semiBold" tone="secondary" numberOfLines={1}>
            {exerciseName}
          </Text>
          <Text variant="meta" tone="muted">SET {setNumber}</Text>
          <Text
            variant="header"
            weight="bold"
            tone="primary"
            style={[styles.clock, { fontVariant: ['tabular-nums'] }]}
          >
            {fmt(elapsed)}
          </Text>
          <Text variant="meta" tone="muted">hold</Text>
        </RNView>

        <RNView style={styles.actions}>
          <Button title="Stop & log" variant="primary" onPress={stop} />
          <TouchableOpacity onPress={onCancel} style={styles.cancel} activeOpacity={0.7}>
            <Text variant="body" tone="muted">Cancel</Text>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.section,
  },
  clock: {
    fontSize: 88,
    lineHeight: 96,
    marginVertical: space.lg,
  },
  actions: {
    paddingHorizontal: space.section,
    paddingBottom: space.section,
    gap: space.lg,
    alignItems: 'stretch',
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
});
