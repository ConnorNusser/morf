import AchievementBadge from '@/components/gamification/AchievementBadge';
import AchievementModal, { AchievementModalItem } from '@/components/gamification/AchievementModal';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { emblemFor } from '@/lib/gamification/achievementEmblems';
import { Achievement } from '@/lib/gamification/achievements';
import { toSpotlight } from '@/lib/gamification/careerView';
import { radius, space, tint } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

// ---- Celebration shown at the top when achievements were just earned ----
export default function UnlockCelebration({ items, onDismiss }: { items: Achievement[]; onDismiss: () => void }) {
  const { currentTheme } = useTheme();
  const [spotlight, setSpotlight] = useState<AchievementModalItem | null>(null);
  const accent = currentTheme.colors.primary;
  const title =
    items.length === 1 ? 'Achievement unlocked' : `${items.length} achievements unlocked`;
  // Cap the rows so a first-time user with many unlocked doesn't get a wall.
  const shown = items.slice(0, 4);
  const overflow = items.length - shown.length;
  return (
    <View style={[styles.celebrate, { backgroundColor: tint(accent), borderColor: accent }]}>
      <View style={styles.celebrateHeader}>
        <Text variant="body" weight="bold" style={{ color: accent }}>{title}</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={18} color={accent} />
        </TouchableOpacity>
      </View>
      {shown.map(a => (
        <TouchableOpacity
          key={a.id}
          style={styles.celebrateRow}
          activeOpacity={0.7}
          onPress={() => setSpotlight(toSpotlight(a))}
          accessibilityRole="button"
          accessibilityLabel={a.title}
        >
          <AchievementBadge icon={a.icon} emblem={emblemFor(a.id)} rarity={a.rarity} size={38} />
          <View style={styles.celebrateText}>
            <Text variant="meta" tone="primary" weight="bold">{a.title}</Text>
            <Text variant="meta" tone="muted">{a.description}</Text>
          </View>
        </TouchableOpacity>
      ))}
      {overflow > 0 && (
        <Text variant="meta" tone="muted" style={styles.celebrateOverflow}>
          + {overflow} more
        </Text>
      )}

      <AchievementModal item={spotlight} onClose={() => setSpotlight(null)} featurable />
    </View>
  );
}

const styles = StyleSheet.create({
  celebrate: {
    borderRadius: radius.card,
    borderWidth: 1.5,
    padding: space.lg,
    marginTop: space.xs,
    marginBottom: space.xs,
    gap: space.md,
  },
  celebrateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  celebrateRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  celebrateText: { flex: 1 },
  // Aligns the overflow line with the badge-row text column.
  celebrateOverflow: { marginLeft: 42 },
});
