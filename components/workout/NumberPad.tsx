// Custom number pad for editing a set's weight or reps — replaces the OS
// keyboard with big gym-friendly buttons and quick +/- increments. Controlled:
// the parent owns which field is being edited; this just edits one number and
// reports changes live. "Next" jumps weight → reps within the same set.
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space, track } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

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

export default function NumberPad({ visible, seedKey, label, unit, value, allowDecimal, increments, hasNext, onChange, onLiveChange, onNext, onDone, onClose }: NumberPadProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [buffer, setBuffer] = useState(fmt(value));

  // Reseed whenever the target field changes (new set / weight↔reps).
  useEffect(() => { setBuffer(fmt(value)); }, [seedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The committed value is pushed on move-on (Next/Done/dismiss); `onLiveChange`
  // additionally reports every keystroke so the workout behind the pad can mirror
  // targets live as you type. Storage persistence is debounced upstream, so the
  // per-keystroke updates stay cheap.
  const flush = () => onChange(parseFloat(buffer) || 0);
  // Set the buffer and report the live value in one place.
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

  // Dismissing (backdrop / hardware back) still keeps what was typed.
  const dismiss = () => { flush(); onClose(); };

  // Digit keys are a named exception (keyboard geometry) — only their ink
  // colors come from the ramp.
  const keyColor = currentTheme.colors.text;
  const Btn = ({ label: l, onPress, flex = 1 }: { label: React.ReactNode; onPress: () => void; flex?: number }) => (
    <TouchableOpacity style={[styles.key, { flex, backgroundColor: ink.hairline }]} onPress={onPress} activeOpacity={0.6}>
      {typeof l === 'string' ? <Text variant="heading" tone="primary">{l}</Text> : l}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />
      <RNView style={[styles.sheet, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
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
            {row.map(d => <Btn key={d} label={d} onPress={() => press(d)} />)}
          </RNView>
        ))}
        <RNView style={styles.keyRow}>
          <Btn label={allowDecimal ? '.' : ''} onPress={dot} />
          <Btn label="0" onPress={() => press('0')} />
          <Btn label={<Ionicons name="backspace-outline" size={22} color={keyColor} />} onPress={back} />
        </RNView>

        <Button
          title={hasNext ? 'Next: reps' : 'Done'}
          variant="primary"
          hapticType="medium"
          onPress={() => { flush(); if (hasNext) onNext(); else onDone(); }}
          style={styles.done}
        />
      </RNView>
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
  key: { height: 52, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  done: { marginTop: space.sm, height: 50 },
});
