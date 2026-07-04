// Per-session visual identity: reuses the app's canonical Push/Pull/Legs colour
// scheme (lib/data/pplCategories — the same colours the Career profile uses) so the
// feed is scannable and every session gets a memorable "face" consistent with the
// rest of the app. The icon is a PLACEHOLDER — the slot is designed to be swapped for
// a generated per-category emblem later; the colour does the identity work now.
import { Ionicons } from '@expo/vector-icons';
import { MUSCLE_TO_PPL, PPL_COLORS, PPLCategory } from '@/lib/data/pplCategories';
import { MuscleGroup } from '@/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface SessionIdentity {
  key: PPLCategory;
  color: string;   // the canonical PPL colour, tints the card + fills the emblem
  icon: IconName;  // placeholder glyph; swap for a generated emblem image later
}

const ICONS: Record<PPLCategory, IconName> = {
  push: 'barbell',
  pull: 'barbell',
  legs: 'walk',
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
  return { key: cat, color: PPL_COLORS[cat], icon: ICONS[cat] };
}
