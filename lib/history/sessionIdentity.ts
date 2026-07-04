// Per-session visual identity: a colour + emblem for each split type so the feed
// becomes scannable and every session gets a memorable "face" (supporting the
// re-livable-memory goal). The icon is a PLACEHOLDER — the slot is designed to be
// swapped for a generated per-split emblem later; the colour does the identity work now.
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface SessionIdentity {
  key: string;
  color: string;   // accent that tints the card + fills the emblem
  icon: IconName;  // placeholder glyph; swap for a generated emblem image later
}

// Keyword → identity. Ordered: the first keyword found in the title wins, so
// "Upper Push" reads as push, "Lower" as legs, etc. Falls back to a muscle group,
// then a neutral default.
const SPLITS: { match: RegExp; id: SessionIdentity }[] = [
  { match: /\bpush\b/i, id: { key: 'push', color: '#FF8A5B', icon: 'barbell' } },
  { match: /\bpull\b/i, id: { key: 'pull', color: '#5B9DFF', icon: 'barbell' } },
  { match: /\b(leg|lower|quad|squat)\b/i, id: { key: 'legs', color: '#B07BFF', icon: 'walk' } },
  { match: /\bupper\b/i, id: { key: 'upper', color: '#4FD1C5', icon: 'body' } },
  { match: /\b(full|total)\b/i, id: { key: 'full', color: '#F6C453', icon: 'flame' } },
  { match: /\b(cardio|run|conditioning)\b/i, id: { key: 'cardio', color: '#FF6B9D', icon: 'heart' } },
  { match: /\b(core|abs?)\b/i, id: { key: 'core', color: '#7CD992', icon: 'flash' } },
  { match: /\b(arm|bicep|tricep)\b/i, id: { key: 'arms', color: '#E9A23B', icon: 'barbell' } },
  { match: /\b(chest)\b/i, id: { key: 'chest', color: '#FF8A5B', icon: 'barbell' } },
  { match: /\b(back)\b/i, id: { key: 'back', color: '#5B9DFF', icon: 'barbell' } },
  { match: /\b(shoulder|delt)\b/i, id: { key: 'shoulders', color: '#4FD1C5', icon: 'body' } },
];

// Muscle-group → colour, for titles that don't name a split (e.g. "Morning Session").
const MUSCLE_COLOR: Record<string, string> = {
  chest: '#FF8A5B', shoulders: '#4FD1C5', arms: '#E9A23B', back: '#5B9DFF',
  legs: '#B07BFF', glutes: '#B07BFF', core: '#7CD992',
};

const DEFAULT: SessionIdentity = { key: 'session', color: '#5B9DFF', icon: 'barbell' };

export function sessionIdentity(title: string, muscles: string[] = []): SessionIdentity {
  for (const { match, id } of SPLITS) {
    if (match.test(title)) return id;
  }
  const topMuscle = muscles[0];
  if (topMuscle && MUSCLE_COLOR[topMuscle]) {
    return { key: topMuscle, color: MUSCLE_COLOR[topMuscle], icon: 'barbell' };
  }
  return DEFAULT;
}
