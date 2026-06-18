// Custom number pad for editing a set's weight or reps — replaces the OS
// keyboard with big gym-friendly buttons and quick +/- increments. Controlled:
// the parent owns which field is being edited; this just edits one number and
// reports changes live. "Next" jumps weight → reps within the same set.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
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
  onNext: () => void;
  onClose: () => void;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

export default function NumberPad({ visible, seedKey, label, unit, value, allowDecimal, increments, hasNext, onChange, onNext, onClose }: NumberPadProps) {
  const { currentTheme } = useTheme();
  const [buffer, setBuffer] = useState(fmt(value));

  // Reseed whenever the target field changes (new set / weight↔reps).
  useEffect(() => { setBuffer(fmt(value)); }, [seedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: string) => {
    setBuffer(next);
    onChange(parseFloat(next) || 0);
  };

  const press = (digit: string) => {
    playHapticFeedback('light', false);
    commit(buffer === '0' && digit !== '.' ? digit : buffer + digit);
  };
  const dot = () => { if (allowDecimal && !buffer.includes('.')) press('.'); };
  const back = () => { playHapticFeedback('light', false); commit(buffer.length > 1 ? buffer.slice(0, -1) : '0'); };
  const bump = (delta: number) => {
    playHapticFeedback('light', false);
    commit(fmt(Math.max(0, (parseFloat(buffer) || 0) + delta)));
  };

  const keyColor = currentTheme.colors.text;
  const Btn = ({ label: l, onPress, flex = 1 }: { label: React.ReactNode; onPress: () => void; flex?: number }) => (
    <TouchableOpacity style={[styles.key, { flex, backgroundColor: currentTheme.colors.text + '0D' }]} onPress={onPress} activeOpacity={0.6}>
      {typeof l === 'string' ? <Text style={[styles.keyText, { color: keyColor, fontFamily: currentTheme.fonts.medium }]}>{l}</Text> : l}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <RNView style={[styles.sheet, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
        <RNView style={styles.readout}>
          <Text style={[styles.label, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.medium }]}>{label}</Text>
          <Text style={[styles.value, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
            {buffer}{unit ? <Text style={[styles.valueUnit, { color: currentTheme.colors.text + '66' }]}> {unit}</Text> : null}
          </Text>
        </RNView>

        <RNView style={styles.chipRow}>
          {increments.map(inc => (
            <TouchableOpacity key={inc} style={[styles.chip, { borderColor: currentTheme.colors.border }]} onPress={() => bump(inc)} activeOpacity={0.6}>
              <Text style={[styles.chipText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>{inc > 0 ? `+${fmt(inc)}` : fmt(inc)}</Text>
            </TouchableOpacity>
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

        <TouchableOpacity
          style={[styles.done, { backgroundColor: currentTheme.colors.primary }]}
          onPress={() => { playHapticFeedback('medium', false); if (hasNext) onNext(); else onClose(); }}
        >
          <Text style={[styles.doneText, { fontFamily: currentTheme.fonts.semiBold }]}>{hasNext ? 'Next: reps' : 'Done'}</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 34,
    gap: 8,
  },
  readout: { alignItems: 'center', paddingBottom: 6 },
  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 36, marginTop: 2 },
  valueUnit: { fontSize: 18 },
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chip: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  chipText: { fontSize: 14 },
  keyRow: { flexDirection: 'row', gap: 8 },
  key: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 22 },
  done: { marginTop: 6, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#fff', fontSize: 16 },
});
