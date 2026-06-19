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

  // Direction
  row: {
    flexDirection: 'row',
  },
  column: {
    flexDirection: 'column',
  },

  // Common row combinations (most used)
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowBetweenCenter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowCenterBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Alignment
  itemsCenter: {
    alignItems: 'center',
  },
  itemsStart: {
    alignItems: 'flex-start',
  },
  itemsEnd: {
    alignItems: 'flex-end',
  },
  justifyCenter: {
    justifyContent: 'center',
  },
  justifyBetween: {
    justifyContent: 'space-between',
  },
  justifyAround: {
    justifyContent: 'space-around',
  },
  justifyEnd: {
    justifyContent: 'flex-end',
  },

  // Center both axes
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Self alignment
  selfCenter: {
    alignSelf: 'center',
  },
  selfStart: {
    alignSelf: 'flex-start',
  },
  selfEnd: {
    alignSelf: 'flex-end',
  },

  // Wrap
  wrap: {
    flexWrap: 'wrap',
  },
});

// ============================================
// SPACING (GAP)
// ============================================

export const gap = StyleSheet.create({
  gap4: { gap: 4 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  gap20: { gap: 20 },
  gap24: { gap: 24 },
});
