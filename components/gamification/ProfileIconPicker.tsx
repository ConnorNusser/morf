import { useTheme } from '@/contexts/ThemeContext';
import { getProfileIcons } from '@/lib/gamification/profileIcons';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  level: number;
  currentId: string;
  onSelect: (id: string) => void;
}

// Bottom sheet to pick the career emblem. Locked emblems show their unlock level.
export default function ProfileIconPicker({ visible, onClose, level, currentId, onSelect }: Props) {
  const { currentTheme } = useTheme();
  const icons = getProfileIcons(level);
  const accent = currentTheme.colors.primary;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.fill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: currentTheme.colors.background }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: currentTheme.colors.text }]}>Career emblem</Text>
              <Text style={[styles.subtitle, { color: currentTheme.colors.text }]}>Unlock more by leveling up</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {icons.map(ic => {
              const selected = ic.id === currentId;
              return (
                <TouchableOpacity
                  key={ic.id}
                  disabled={!ic.unlocked}
                  activeOpacity={0.7}
                  onPress={() => onSelect(ic.id)}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: selected ? accent : currentTheme.colors.surface,
                        borderColor: selected ? accent : currentTheme.colors.border,
                        opacity: ic.unlocked ? 1 : 0.4,
                      },
                    ]}
                  >
                    <Ionicons
                      name={ic.icon as keyof typeof Ionicons.glyphMap}
                      size={26}
                      color={selected ? currentTheme.colors.surface : ic.unlocked ? currentTheme.colors.text : currentTheme.colors.text + '60'}
                    />
                    {!ic.unlocked && (
                      <View style={[styles.lockBadge, { backgroundColor: currentTheme.colors.background }]}>
                        <Ionicons name="lock-closed" size={10} color={currentTheme.colors.text} />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.cellLabel, { color: currentTheme.colors.text }]} numberOfLines={1}>
                    {ic.unlocked ? ic.label : `Lvl ${ic.unlockLevel}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  fill: { flex: 1 },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, opacity: 0.55, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
  cell: { width: '22%', alignItems: 'center', gap: 6 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: { fontSize: 11, opacity: 0.6 },
});
