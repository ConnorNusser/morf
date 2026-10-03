// Shared kit for the routine generator steps: the flow's step ids, the modal
// palette shape, the two-up card metrics, and the title-block styles every
// input step opens with.
import { radius, screenGutter, space, track } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { Dimensions, StyleSheet } from 'react-native';

export type FlowStep = 'goal' | 'focus' | 'experience' | 'days' | 'duration' | 'exercises' | 'generating' | 'preview';

export const INPUT_STEPS: FlowStep[] = ['goal', 'focus', 'experience', 'days', 'duration', 'exercises'];

export interface GeneratorColors {
  bg: string;
  surface: string;
  surfaceLight: string;
  accent: string;
  text: string;
  textDim: string;
  textMuted: string;
  border: string;
  success: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const CARD_GAP = space.md;
export const CARD_WIDTH = (SCREEN_WIDTH - screenGutter * 2 - CARD_GAP) / 2;

export const stepStyles = StyleSheet.create({
  stepContent: {
    flex: 1,
  },
  titleBlock: {
    marginBottom: space.section,
  },
  stepLabel: {
    letterSpacing: track.caps,
    marginBottom: space.sm,
  },
  title: {
    lineHeight: lineHeightFor(type.screenTitle),
    marginBottom: space.xs,
  },
  subtitle: {
    marginTop: space.sm,
    lineHeight: lineHeightFor(type.body),
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    borderRadius: radius.pill,
  },
});
