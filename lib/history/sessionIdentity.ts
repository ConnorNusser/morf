// Per-session visual identity: reuses the app's canonical Push/Pull/Legs colour
// scheme (lib/data/pplCategories — the same colours the Career profile uses) so the
// feed is scannable and every session gets a memorable "face" consistent with the
// rest of the app. The emblem is a custom generated white pictogram (person
// pressing / hanging from a bar / squatting), shown white on a solid PPL circle.
import { ImageSourcePropType } from 'react-native';
import { MUSCLE_TO_PPL, PPL_COLORS, PPLCategory } from '@/lib/data/pplCategories';
import { MuscleGroup } from '@/types';

export interface SessionIdentity {
  key: PPLCategory;
  color: string;             // the canonical PPL colour, fills the emblem circle
  emblem: ImageSourcePropType; // white movement pictogram
}

const EMBLEMS: Record<PPLCategory, ImageSourcePropType> = {
  push: require('@/assets/emblems/push.png'),
  pull: require('@/assets/emblems/pull.png'),
  legs: require('@/assets/emblems/legs.png'),
};

// Title keyword → category. "Upper"/"Full" and anything unmatched fall through to the
// session's dominant trained muscle (via MUSCLE_TO_PPL), so every session resolves to
// one of the three canonical categories.
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
