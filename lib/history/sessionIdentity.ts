// Per-session visual identity: reuses the canonical PPL colour scheme (lib/data/pplCategories)
// so the feed is scannable, each session a white pictogram on a solid PPL circle.
import { ImageSourcePropType } from 'react-native';
import { MUSCLE_TO_PPL, PPL_COLORS, PPLCategory } from '@/lib/data/pplCategories';
import { MuscleGroup } from '@/types';

export interface SessionIdentity {
  key: PPLCategory;
  color: string; // fills the emblem circle
  emblem: ImageSourcePropType; // white movement pictogram
}

const EMBLEMS: Record<PPLCategory, ImageSourcePropType> = {
  push: require('@/assets/emblems/push.png'),
  pull: require('@/assets/emblems/pull.png'),
  legs: require('@/assets/emblems/legs.png'),
};

// Title keyword → category; unmatched titles fall through to the dominant trained muscle.
const TITLE_MATCH: { re: RegExp; cat: PPLCategory }[] = [
  { re: /\bpush\b/i, cat: 'push' },
  { re: /\bpull\b/i, cat: 'pull' },
  { re: /\b(leg|lower|quad|squat|glute)\b/i, cat: 'legs' },
];

export function sessionIdentity(title: string, muscles: string[] = []): SessionIdentity {
  let cat: PPLCategory | undefined = TITLE_MATCH.find(t => t.re.test(title))?.cat;
  if (!cat) {
    const top = muscles[0] as MuscleGroup | undefined;
    cat = (top && MUSCLE_TO_PPL[top]) || 'push';
  }
  return { key: cat, color: PPL_COLORS[cat], emblem: EMBLEMS[cat] };
}
