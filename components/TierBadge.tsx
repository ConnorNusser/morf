import { useAlert } from '@/components/CustomAlert';
import { getStrengthTier, getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TierBadgeSize = 'tiny' | 'small' | 'medium' | 'large';
type TierBadgeVariant = 'badge' | 'text';

interface TierBadgeProps {
  tier?: StrengthTier;
  percentile?: number;
  size?: TierBadgeSize;
  variant?: TierBadgeVariant;
  showTooltip?: boolean;
}

// Tier descriptions for the tooltip
const TIER_DESCRIPTIONS: Record<string, { title: string; description: string; percentileRange: string }> = {
  'S': {
    title: 'S Tier - Elite',
    description: 'You are among the strongest in the world. This level typically requires years of dedicated training and exceptional genetics.',
    percentileRange: '85th - 99th+ percentile',
  },
  'A': {
    title: 'A Tier - Advanced',
    description: 'Excellent strength level. You\'re stronger than most regular gym-goers and have developed significant muscle and technique.',
    percentileRange: '70th - 84th percentile',
  },
  'B': {
    title: 'B Tier - Intermediate',
    description: 'Solid strength foundation. You\'ve moved beyond beginner gains and are making consistent progress.',
    percentileRange: '47th - 69th percentile',
  },
  'C': {
    title: 'C Tier - Developing',
    description: 'Building strength steadily. Keep training consistently and you\'ll see significant improvements.',
    percentileRange: '23rd - 46th percentile',
  },
  'D': {
    title: 'D Tier - Novice',
    description: 'Early stages of strength development. Focus on proper form and progressive overload.',
    percentileRange: '6th - 22nd percentile',
  },
  'E': {
    title: 'E Tier - Beginner',
    description: 'Just starting your strength journey. Everyone starts here - consistency is key!',
    percentileRange: '0 - 5th percentile',
  },
};

function getBaseTierLetter(tier: StrengthTier): string {
  return tier.charAt(0);
}

export default function TierBadge({
  tier,
  percentile,
  size = 'medium',
  variant = 'badge',
  showTooltip = true,
}: TierBadgeProps) {
  const { showAlert } = useAlert();

  // Calculate tier from percentile if not provided directly
  const displayTier = tier ?? (percentile !== undefined ? getStrengthTier(percentile) : 'C');
  const tierColor = getTierColor(displayTier);
  const baseTier = getBaseTierLetter(displayTier);

  const sizeStyles = SIZE_STYLES[size];

  const handlePress = () => {
    if (!showTooltip) return;

    const tierInfo = TIER_DESCRIPTIONS[baseTier];
    if (tierInfo) {
      showAlert({
        title: tierInfo.title,
        message: `${tierInfo.description}\n\n${tierInfo.percentileRange}`,
        type: 'info',
        buttons: [{ text: 'Got it', style: 'default' }],
      });
    }
  };

  // Text-only variant (minimal style)
  if (variant === 'text') {
    const textContent = (
      <Text style={[sizeStyles.text, { color: tierColor }]}>
        {displayTier}
      </Text>
    );

    if (showTooltip) {
      return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
          {textContent}
        </TouchableOpacity>
      );
    }

    return textContent;
  }

  // Badge variant (default)
  const badgeContent = (
    <View
      style={[
        styles.badge,
        sizeStyles.badge,
        {
          backgroundColor: tierColor + '20',
          borderColor: tierColor,
        }
      ]}
    >
      <Text
        style={[
          styles.text,
          sizeStyles.text,
          { color: tierColor }
        ]}
      >
        {displayTier}
      </Text>
    </View>
  );

  if (showTooltip) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        {badgeContent}
      </TouchableOpacity>
    );
  }

  return badgeContent;
}

const SIZE_STYLES = {
  tiny: StyleSheet.create({
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    text: {
      fontSize: 10,
      fontWeight: '700',
    },
  }),
  small: StyleSheet.create({
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1.5,
    },
    text: {
      fontSize: 14,
      fontWeight: '700',
    },
  }),
  medium: StyleSheet.create({
    badge: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1.5,
    },
    text: {
      fontSize: 18,
      fontWeight: '800',
    },
  }),
  large: StyleSheet.create({
    badge: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 2,
    },
    text: {
      fontSize: 36,
      fontWeight: 'bold',
      lineHeight: 40,
    },
  }),
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  text: {
    textAlign: 'center',
  },
});
