import { StyleSheet } from 'react-native';

/**
 * Common reusable styles for the app.
 * Use with array syntax: style={[styles.myStyle, common.row]}
 *
 * Based on audit of 50+ components showing most repeated patterns.
 */

// ============================================
// FLEXBOX LAYOUT
// ============================================

export const layout = StyleSheet.create({
  // Flex values
  flex1: {
    flex: 1,
  },
});

// ============================================
// SPACING (GAP)
// ============================================

export const gap = StyleSheet.create({
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  gap20: { gap: 20 },
});
