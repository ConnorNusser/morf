// Full-screen spotlight for one achievement; tap anywhere (or the X) to dismiss.
import AchievementBadge from '@/components/gamification/AchievementBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { Rarity, RARITY_META } from '@/lib/gamification/rarity';
import { userSyncService } from '@/lib/services/userSyncService';
import { storageService } from '@/lib/storage/storage';
import { type as typeScale } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface AchievementModalItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
  /** Where/when it was earned, already formatted (e.g. "Pull Day · Jun 24"). */
  earnedLabel?: string;
  /** Locked achievements render muted, with progress instead of an earned line. */
  unlocked?: boolean;
  /** Secret achievement — rarity reads SECRET. */
  masked?: boolean;
  /** Standing toward the target, already formatted (e.g. "12.4k / 100k · 12%"). */
  progressLabel?: string;
}

interface Props {
  item: AchievementModalItem | null;
  onClose: () => void;
  /** Own, earned achievements can be featured on the public profile. */
  featurable?: boolean;
}

export default function AchievementModal({ item, onClose, featurable }: Props) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const canFeature = !!featurable && (item?.unlocked ?? true);

  useEffect(() => {
    if (item && canFeature) storageService.getFeaturedAchievementId().then(setFeaturedId);
  }, [item, canFeature]);

  if (!item) return null;
  const accent = RARITY_META[item.rarity].accent;
  const isFeatured = featuredId === item.id;

  const toggleFeature = () => {
    const next = isFeatured ? null : item.id;
    setFeaturedId(next);
    storageService.setFeaturedAchievementId(next);
    // Fire-and-forget: the badge shows on the public profile via user_data.
    userSyncService.syncFeaturedAchievement(next).catch(() => {});
  };

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
            unlocked={item.unlocked ?? true}
            size={132}
          />
          <Text style={[styles.rarity, { color: accent }]}>
            {item.masked ? 'SECRET' : RARITY_META[item.rarity].label.toUpperCase()}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.desc, { color: colors.text + 'B0' }]}>{item.description}</Text>
          {!!item.earnedLabel && (
            <Text style={[styles.earned, { color: colors.text + '66' }]}>
              Earned · {item.earnedLabel}
            </Text>
          )}
          {!!item.progressLabel && (
            <Text style={[styles.earned, { color: colors.text + '66' }]}>{item.progressLabel}</Text>
          )}

          {canFeature && (
            <TouchableOpacity
              style={[
                styles.featureBtn,
                isFeatured
                  ? { backgroundColor: accent + '1A', borderColor: accent }
                  : { backgroundColor: 'transparent', borderColor: colors.text + '33' },
              ]}
              onPress={toggleFeature}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isFeatured ? 'star' : 'star-outline'}
                size={15}
                color={isFeatured ? accent : colors.text + '99'}
              />
              <Text style={[styles.featureText, { color: isFeatured ? accent : colors.text + '99' }]}>
                {isFeatured ? 'Featured on your profile' : 'Feature on profile'}
              </Text>
            </TouchableOpacity>
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
  featureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 26,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
  },
  featureText: { fontSize: typeScale.meta, fontWeight: '600' },
  hint: { fontSize: typeScale.meta, fontWeight: '600', textAlign: 'center', marginBottom: 48 },
});
