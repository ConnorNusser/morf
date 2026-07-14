// Full-screen rest countdown in the HoldTimer's visual grammar. A pageSheet so
// iOS swipe-down dismisses it natively; dismissing never cancels the rest —
// the pill and RestBar keep counting.
import Button from '@/components/Button';
import IconButton from '@/components/IconButton';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import React, { useEffect } from 'react';
import { Modal, SafeAreaView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface RestTimerSheetProps {
  visible: boolean;
  formatted: string;
  remaining: number;
  duration: number;
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function RestTimerSheet({
  visible,
  formatted,
  remaining,
  duration,
  onAdjust,
  onSkip,
  onClose,
}: RestTimerSheetProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  // The rest finishing closes the sheet on its own.
  useEffect(() => {
    if (visible && remaining <= 0) onClose();
  }, [visible, remaining, onClose]);

  const pct = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;

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
          <Text variant="meta" weight="semiBold" tone="muted" style={styles.restLabel}>
            REST
          </Text>
          <Text
            variant="header"
            weight="bold"
            tone="primary"
            style={[styles.clock, { fontVariant: ['tabular-nums'] }]}
          >
            {formatted}
          </Text>

          {/* Draining bar — remaining share of the full rest. */}
          <RNView style={[styles.track, { backgroundColor: ink.ghost }]}>
            <RNView
              style={[
                styles.fill,
                { width: `${Math.round(pct * 100)}%`, backgroundColor: currentTheme.colors.primary },
              ]}
            />
          </RNView>

          <RNView style={styles.adjustRow}>
            {[-15, 15].map(delta => (
              <TouchableOpacity
                key={delta}
                style={[styles.adjustBtn, { borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.surface }]}
                onPress={() => { playHapticFeedback('light', false); onAdjust(delta); }}
                activeOpacity={0.7}
              >
                <Text variant="body" weight="semiBold" tone="primary">
                  {delta > 0 ? `+${delta}s` : `${delta}s`}
                </Text>
              </TouchableOpacity>
            ))}
          </RNView>
        </RNView>

        <RNView style={styles.actions}>
          <Button
            title="Skip rest"
            variant="primary"
            onPress={() => { playHapticFeedback('medium', false); onSkip(); onClose(); }}
          />
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
    gap: space.lg,
    paddingHorizontal: space.section,
  },
  restLabel: {
    letterSpacing: 3,
  },
  clock: {
    fontSize: 88,
    lineHeight: 96,
  },
  track: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: space.lg,
    marginTop: space.sm,
  },
  adjustBtn: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  actions: {
    paddingHorizontal: space.section,
    paddingBottom: space.section,
  },
});
