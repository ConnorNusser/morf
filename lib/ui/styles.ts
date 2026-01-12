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

// ============================================
// PADDING
// ============================================

export const padding = StyleSheet.create({
  // All sides
  p4: { padding: 4 },
  p8: { padding: 8 },
  p12: { padding: 12 },
  p16: { padding: 16 },
  p20: { padding: 20 },
  p24: { padding: 24 },

  // Horizontal
  px4: { paddingHorizontal: 4 },
  px8: { paddingHorizontal: 8 },
  px12: { paddingHorizontal: 12 },
  px16: { paddingHorizontal: 16 },
  px20: { paddingHorizontal: 20 },
  px24: { paddingHorizontal: 24 },

  // Vertical
  py4: { paddingVertical: 4 },
  py8: { paddingVertical: 8 },
  py12: { paddingVertical: 12 },
  py16: { paddingVertical: 16 },
  py20: { paddingVertical: 20 },
  py24: { paddingVertical: 24 },
});

// ============================================
// MARGIN
// ============================================

export const margin = StyleSheet.create({
  // All sides
  m4: { margin: 4 },
  m8: { margin: 8 },
  m12: { margin: 12 },
  m16: { margin: 16 },

  // Horizontal
  mx4: { marginHorizontal: 4 },
  mx8: { marginHorizontal: 8 },
  mx12: { marginHorizontal: 12 },
  mx16: { marginHorizontal: 16 },

  // Vertical
  my4: { marginVertical: 4 },
  my8: { marginVertical: 8 },
  my12: { marginVertical: 12 },
  my16: { marginVertical: 16 },

  // Top
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },

  // Bottom
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
});

// ============================================
// BORDER RADIUS
// ============================================

export const rounded = StyleSheet.create({
  rounded4: { borderRadius: 4 },
  rounded6: { borderRadius: 6 },
  rounded8: { borderRadius: 8 },
  rounded10: { borderRadius: 10 },
  rounded12: { borderRadius: 12 },
  rounded16: { borderRadius: 16 },
  rounded20: { borderRadius: 20 },
  roundedFull: { borderRadius: 9999 },
});

// ============================================
// TEXT
// ============================================

export const text = StyleSheet.create({
  // Alignment
  textCenter: { textAlign: 'center' },
  textLeft: { textAlign: 'left' },
  textRight: { textAlign: 'right' },

  // Common font sizes
  text10: { fontSize: 10 },
  text11: { fontSize: 11 },
  text12: { fontSize: 12 },
  text13: { fontSize: 13 },
  text14: { fontSize: 14 },
  text15: { fontSize: 15 },
  text16: { fontSize: 16 },
  text18: { fontSize: 18 },
  text20: { fontSize: 20 },
  text22: { fontSize: 22 },
  text24: { fontSize: 24 },
});

// ============================================
// DIMENSIONS
// ============================================

export const size = StyleSheet.create({
  // Full width/height
  fullWidth: { width: '100%' },
  fullHeight: { height: '100%' },
  full: { width: '100%', height: '100%' },

  // Common avatar/icon sizes
  size20: { width: 20, height: 20 },
  size24: { width: 24, height: 24 },
  size32: { width: 32, height: 32 },
  size40: { width: 40, height: 40 },
  size44: { width: 44, height: 44 },
  size48: { width: 48, height: 48 },
  size56: { width: 56, height: 56 },
});

// ============================================
// POSITIONING
// ============================================

export const position = StyleSheet.create({
  relative: { position: 'relative' },
  absolute: { position: 'absolute' },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  absoluteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  absoluteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});

// ============================================
// MISC
// ============================================

export const misc = StyleSheet.create({
  hidden: { overflow: 'hidden' },
  visible: { overflow: 'visible' },
  opacity50: { opacity: 0.5 },
  opacity70: { opacity: 0.7 },
});

// ============================================
// COMBINED EXPORT (for convenience)
// ============================================

export const common = {
  ...layout,
  ...gap,
  ...padding,
  ...margin,
  ...rounded,
  ...text,
  ...size,
  ...position,
  ...misc,
};

// Default export for easy importing
export default common;
