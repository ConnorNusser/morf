// Controlled number pad for editing one set's weight or reps: big gym-friendly keys, quick +/- increments, "Next" jumps weight → reps.
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space, track } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';

interface NumberPadProps {
  visible: boolean;
  seedKey: string; // changes when the target field changes → reseed the buffer
  label: string; // "Weight" / "Reps"
  unit?: string; // shown after the value for weight
  value: number;
  allowDecimal: boolean;
  increments: number[]; // quick +/- chips, e.g. [-5, -2.5, 2.5, 5]
  hasNext: boolean;
  onChange: (n: number) => void;
  onLiveChange?: (n: number) => void; // fires on every keystroke, for live preview
  onNext: () => void;
  onDone: () => void; // final "Done" — commits and auto-completes the set
  onClose: () => void; // dismissed (backdrop / hardware back) — commits, no complete
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

// Hoisted to module scope: defined inside NumberPad it'd get a fresh identity each render, unmounting all keys per keystroke and dropping mid-flight touches (digits taking several taps to land).
const Key = React.memo(function Key({
  label,
  onPress,
  hairline,
}: {
  label: React.ReactNode;
  onPress: () => void;
  hairline: string;
}) {
  return (
    <TouchableOpacity style={[styles.key, { backgroundColor: hairline }]} onPress={onPress} activeOpacity={0.6}>
      {typeof label === 'string' ? <Text variant="heading" tone="primary">{label}</Text> : label}
    </TouchableOpacity>
  );
});

export default function NumberPad({ visible, seedKey, label, unit, value, allowDecimal, increments, hasNext, onChange, onLiveChange, onNext, onDone, onClose }: NumberPadProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [buffer, setBuffer] = useState(fmt(value));

  // Reseed only when the field changes (weight↔reps), NOT on mount: the useState initializer already seeds, and a mount-time reseed could land after the first keystroke and wipe it.
  const lastSeed = useRef(seedKey);
  useEffect(() => {
    if (lastSeed.current !== seedKey) {
      lastSeed.current = seedKey;
      setBuffer(fmt(value));
    }
  }, [seedKey, value]);

  // onChange commits on move-on (Next/Done/dismiss); onLiveChange reports every keystroke so the workout behind the pad mirrors targets live (persistence is debounced upstream).
  const flush = () => onChange(parseFloat(buffer) || 0);
  const commitBuffer = (next: string) => {
    setBuffer(next);
    onLiveChange?.(parseFloat(next) || 0);
  };

  const press = (digit: string) => {
    playHapticFeedback('light', false);
    commitBuffer(buffer === '0' && digit !== '.' ? digit : buffer + digit);
  };
  const dot = () => { if (allowDecimal && !buffer.includes('.')) press('.'); };
  const back = () => { playHapticFeedback('light', false); commitBuffer(buffer.length > 1 ? buffer.slice(0, -1) : '0'); };
  const bump = (delta: number) => {
    playHapticFeedback('light', false);
    commitBuffer(fmt(Math.max(0, (parseFloat(buffer) || 0) + delta)));
  };

  // Dismissing (backdrop / hardware back) keeps what was typed.
  const dismiss = () => { flush(); onClose(); };

  // Digit keys are a named exception (keyboard geometry) — only ink colors come from the ramp.
  const keyColor = currentTheme.colors.text;

  return (
    // animationType="none": the native slide (~300ms) eats the first touch, dropping the first digit tap; we slide with Reanimated (UI thread, doesn't block the JS touch handler) instead.
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />
      <Animated.View entering={SlideInDown.duration(220)} style={[styles.sheet, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
        <RNView style={styles.readout}>
          <Text variant="meta" tone="muted" weight="bold" style={styles.label}>{label}</Text>
          <Text tone="primary" style={styles.value}>
            {buffer}{unit ? <Text variant="emphasis" tone="muted"> {unit}</Text> : null}
          </Text>
        </RNView>

        <RNView style={styles.chipRow}>
          {increments.map(inc => (
            <Chip
              key={inc}
              label={inc > 0 ? `+${fmt(inc)}` : fmt(inc)}
              size="small"
              onPress={() => bump(inc)}
              style={styles.chip}
            />
          ))}
        </RNView>

        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, r) => (
          <RNView key={r} style={styles.keyRow}>
            {row.map(d => <Key key={d} label={d} onPress={() => press(d)} hairline={ink.hairline} />)}
          </RNView>
        ))}
        <RNView style={styles.keyRow}>
          <Key label={allowDecimal ? '.' : ''} onPress={dot} hairline={ink.hairline} />
          <Key label="0" onPress={() => press('0')} hairline={ink.hairline} />
          <Key label={<Ionicons name="backspace-outline" size={22} color={keyColor} />} onPress={back} hairline={ink.hairline} />
        </RNView>

        <Button
          title={hasNext ? 'Next: reps' : 'Done'}
          variant="primary"
          hapticType="medium"
          onPress={() => { flush(); if (hasNext) onNext(); else onDone(); }}
          style={styles.done}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    // Clears the home indicator — deliberate sheet geometry, not a spacing token.
    paddingBottom: 34,
    gap: space.sm,
  },
  readout: { alignItems: 'center', paddingBottom: space.sm },
  label: { textTransform: 'uppercase', letterSpacing: track.caps },
  // The 36pt readout is a named exception (the one oversized number here).
  value: { fontSize: 36, marginTop: space.xs },
  chipRow: { flexDirection: 'row', gap: space.sm, paddingBottom: space.xs },
  chip: { flex: 1, alignItems: 'center' },
  keyRow: { flexDirection: 'row', gap: space.sm },
  key: { flex: 1, height: 52, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  done: { marginTop: space.sm, height: 50 },
});
