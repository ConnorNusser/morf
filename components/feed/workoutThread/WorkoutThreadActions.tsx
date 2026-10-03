import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useLikePop } from '@/hooks/useLikePop';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';

interface WorkoutThreadActionsProps {
  userHasLiked: boolean;
  likeCount: number;
  commentCount: number;
  likeAnimatedStyle: ReturnType<typeof useLikePop>['likeAnimatedStyle'];
  onLike: () => void;
}

export default function WorkoutThreadActions({
  userHasLiked,
  likeCount,
  commentCount,
  likeAnimatedStyle,
  onLike,
}: WorkoutThreadActionsProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.actionsRow, { borderColor: currentTheme.colors.border }]}>
      <View style={styles.actionsLeft}>
        <TouchableOpacity
          style={[
            styles.likeButton,
            userHasLiked && { backgroundColor: currentTheme.colors.primary + '15' }
          ]}
          onPress={onLike}
          activeOpacity={0.6}
        >
          <Animated.View style={likeAnimatedStyle}>
            <Ionicons
              name={userHasLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '70'}
            />
          </Animated.View>
          {likeCount > 0 && (
            <Text style={[styles.likeCount, { color: userHasLiked ? currentTheme.colors.primary : currentTheme.colors.text + '70', fontWeight: '500' }]}>
              {likeCount}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.commentCount}>
        <Ionicons name="chatbubble-outline" size={18} color={currentTheme.colors.text + '60'} />
        <Text style={[styles.commentCountText, { color: currentTheme.colors.text + '60', fontWeight: '500' }]}>
          {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  likeCount: {
    fontSize: 14,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  commentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentCountText: {
    fontSize: 14,
  },
});
