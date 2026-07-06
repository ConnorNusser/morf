// Full-screen spotlight for one earned achievement — the same calm presentation
// grammar as the WorkoutLaunch interstitial: theme background, the badge art
// large and centered, rarity as the accent, then title / description / where it
// was earned. Tap anywhere (or the X) to dismiss.
import AchievementBadge from '@/components/gamification/AchievementBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { Rarity, RARITY_META } from '@/lib/gamification/rarity';
import { type as typeScale } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface AchievementModalItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
  /** Where/when it was earned, already formatted (e.g. "Pull Day · Jun 24"). */
  earnedLabel?: string;
}

interface Props {
  item: AchievementModalItem | null;
  onClose: () => void;
}

export default function AchievementModal({ item, onClose }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  if (!item) return null;
  const accent = RARITY_META[item.rarity].accent;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.fill, { backgroundColor: colors.background }]} onPress={onClose}>
        <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text + '99'} />
        </TouchableOpacity>

        <View style={styles.center}>
          <AchievementBadge
            icon={item.icon}
            emblem={emblemFor(item.id)}
            rarity={item.rarity}
            size={132}
          />
          <Text style={[styles.rarity, { color: accent }]}>
            {RARITY_META[item.rarity].label.toUpperCase()}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.desc, { color: colors.text + 'B0' }]}>{item.description}</Text>
          {!!item.earnedLabel && (
            <Text style={[styles.earned, { color: colors.text + '66' }]}>
              Earned · {item.earnedLabel}
            </Text>
          )}
        </View>

        <Text style={[styles.hint, { color: colors.text + '4D' }]}>Tap to close</Text>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  close: { position: 'absolute', top: 64, right: 24, zIndex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  rarity: { fontSize: typeScale.meta, fontWeight: '800', letterSpacing: 2, marginTop: 24 },
  title: { fontSize: typeScale.screenTitle, fontWeight: '700', letterSpacing: -0.4, marginTop: 8, textAlign: 'center' },
  desc: { fontSize: typeScale.body, fontWeight: '500', lineHeight: 22, marginTop: 10, textAlign: 'center' },
  earned: { fontSize: typeScale.meta, fontWeight: '600', marginTop: 18 },
  hint: { fontSize: typeScale.meta, fontWeight: '600', textAlign: 'center', marginBottom: 48 },
});
