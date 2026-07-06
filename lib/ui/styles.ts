import { StyleSheet } from 'react-native';

/**
 * Common reusable styles for the app.
 * Use with array syntax: style={[styles.myStyle, layout.flex1]}
 *
 * Spacing values come from lib/ui/tokens (`space`) — inline `gap: space.<x>`
 * in local styles rather than sharing gap styles from here.
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
