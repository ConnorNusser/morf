// Card camos: level-gated cosmetic finishes for the Home rank card. You grind
// account levels (XP) to unlock them, weapon-camo style. Pure data + lookup —
// the pattern geometry lives in lib/ui/camoPatterns.ts and rendering in
// components/home/CardCamo.tsx. Nothing derived is stored: unlocks are a pure
// function of level; only the *equipped* id is persisted.

export type CardCamoId =
  | 'standard'
  | 'woodland'
  | 'digital'
  | 'tiger'
  | 'carbon'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'nebula';

export type CamoPattern =
  | 'none' // the plain translucent tier tint
  | 'blobs' // organic woodland blobs
  | 'pixels' // stepped digital blocks
  | 'stripes' // tapered tiger stripes
  | 'weave' // carbon-fiber twill
  | 'brushed' // brushed metal streaks over a metal gradient
  | 'facets' // triangulated prism facets
  | 'cosmic'; // drifting nebula clouds + stars

// Palette colors are mixed toward the lifter's tier hue by `tierMix` (0 = fixed
// colors, 1 = pure tier hue), so pattern camos stay on-palette with the tier
// wash while metals keep their own identity.
export interface CamoPalette {
  colors: string[];
  tierMix: number;
}

// Pattern-layer opacity per theme. Kept low so theme ink stays legible; light
// themes take a touch less because dark shapes read stronger on white.
export interface CamoOpacity {
  dark: number;
  light: number;
}

// Overrides for the card's diagonal Sheen sweep. Omitted fields keep the tier's.
export interface CamoSheen {
  mode?: 'none' | 'once' | 'loop';
  ms?: number;
  restMs?: number;
  tint?: string | 'prism'; // sweep color; 'prism' = rainbow bands
  intensity?: number; // peak alpha of the sweep (tier default 0.2)
}

export interface CardCamo {
  id: CardCamoId;
  name: string;
  requiredLevel: number;
  description: string;
  pattern: CamoPattern;
  palette: CamoPalette;
  opacity: CamoOpacity;
  sheen?: CamoSheen;
  animated?: boolean; // slow drift (UI-thread only; off under Reduce Motion)
}

export const DEFAULT_CAMO_ID: CardCamoId = 'standard';

// Tier-default sweep alpha (matches HoloRankCard's Sheen).
export const BASE_SHEEN_INTENSITY = 0.2;

// Ordered by unlock level — keep `standard` first and requiredLevel ascending.
export const CARD_CAMOS: CardCamo[] = [
  {
    id: 'standard',
    name: 'Field Issue',
    requiredLevel: 1,
    description: 'The standard tier tint',
    pattern: 'none',
    palette: { colors: [], tierMix: 0 },
    opacity: { dark: 0, light: 0 },
  },
  {
    id: 'woodland',
    name: 'Timberline',
    requiredLevel: 5,
    description: 'Organic woodland blots in muted greens and browns',
    pattern: 'blobs',
    palette: { colors: ['#4B5A32', '#6B5236', '#2F3A24', '#7C7A4E'], tierMix: 0.25 },
    opacity: { dark: 0.3, light: 0.2 },
  },
  {
    id: 'digital',
    name: 'Bitfield',
    requiredLevel: 10,
    description: 'Stepped pixel blocks',
    pattern: 'pixels',
    palette: { colors: ['#3E4A55', '#6A7782', '#24303A', '#8A949C'], tierMix: 0.35 },
    opacity: { dark: 0.3, light: 0.2 },
  },
  {
    id: 'tiger',
    name: 'Clawmark',
    requiredLevel: 15,
    description: 'Tapered tiger stripes',
    pattern: 'stripes',
    palette: { colors: ['#1C1A17', '#2B241C'], tierMix: 0.2 },
    opacity: { dark: 0.4, light: 0.16 },
  },
  {
    id: 'carbon',
    name: 'Black Weave',
    requiredLevel: 20,
    description: 'Carbon-fiber twill',
    pattern: 'weave',
    palette: { colors: ['#0E0F11', '#2A2D31', '#4A4F55'], tierMix: 0.1 },
    opacity: { dark: 0.4, light: 0.14 },
    sheen: { tint: '#C8D2DC', intensity: 0.16 },
  },
  {
    id: 'gold',
    name: 'Gilt Edge',
    requiredLevel: 30,
    description: 'Brushed gold with a warm glint',
    pattern: 'brushed',
    palette: { colors: ['#7A5A12', '#E8C25A', '#FFE7A1', '#B8892A'], tierMix: 0 },
    opacity: { dark: 0.32, light: 0.32 },
    sheen: { mode: 'loop', ms: 1300, restMs: 2200, tint: '#FFE3A0', intensity: 0.42 },
  },
  {
    id: 'platinum',
    name: 'Frost Plate',
    requiredLevel: 40,
    description: 'Cool brushed platinum',
    pattern: 'brushed',
    palette: { colors: ['#5D6672', '#C9D2DC', '#F2F6FA', '#8E99A6'], tierMix: 0 },
    opacity: { dark: 0.32, light: 0.38 },
    sheen: { mode: 'loop', ms: 1500, restMs: 2400, tint: '#EAF3FF', intensity: 0.4 },
  },
  {
    id: 'diamond',
    name: 'Prismcut',
    requiredLevel: 50,
    description: 'Faceted prism with a rainbow sweep',
    pattern: 'facets',
    palette: { colors: ['#9AD8FF', '#D6B8FF', '#FFC6E4', '#B8FFE6', '#FFF1B8'], tierMix: 0 },
    opacity: { dark: 0.3, light: 0.34 },
    sheen: { mode: 'loop', ms: 1600, restMs: 1800, tint: 'prism', intensity: 0.3 },
  },
  {
    id: 'nebula',
    name: 'Deep Drift',
    requiredLevel: 60,
    description: 'A slow-drifting nebula full of stars',
    pattern: 'cosmic',
    palette: { colors: ['#5B2A86', '#1F6E8C', '#B3478F', '#FFFFFF'], tierMix: 0.2 },
    opacity: { dark: 0.42, light: 0.28 },
    sheen: { mode: 'loop', ms: 2400, restMs: 3600, tint: '#D9C8FF', intensity: 0.22 },
    animated: true,
  },
];

const BY_ID = new Map<string, CardCamo>(CARD_CAMOS.map(c => [c.id, c]));

export function getCamo(id: string | null | undefined): CardCamo | null {
  return (id && BY_ID.get(id)) || null;
}

export function isCamoUnlocked(id: string, level: number): boolean {
  const camo = getCamo(id);
  return !!camo && level >= camo.requiredLevel;
}

export function unlockedCamos(level: number): CardCamo[] {
  return CARD_CAMOS.filter(c => level >= c.requiredLevel);
}

// Next camo still locked at `level`, or null once everything is unlocked.
export function nextCamoUnlock(level: number): CardCamo | null {
  return CARD_CAMOS.find(c => c.requiredLevel > level) ?? null;
}

// Camos whose gate was crossed going from `beforeLevel` to `afterLevel`
// (exclusive → inclusive), ascending. Empty when the level didn't rise.
export function camosUnlockedBetween(beforeLevel: number, afterLevel: number): CardCamo[] {
  if (!(afterLevel > beforeLevel)) return [];
  return CARD_CAMOS.filter(c => c.requiredLevel > beforeLevel && c.requiredLevel <= afterLevel);
}

// Stored pick → camo to render. Unknown or locked ids fall back to standard.
// `level` null = still loading: render standard rather than flash a locked camo.
// `enabled` false = camos switched off: plain tier tint, but the stored pick is
// left alone so it comes back when they're switched on again.
export function resolveEquippedCamo(
  storedId: string | null | undefined,
  level: number | null,
  enabled: boolean = true,
): CardCamo {
  const camo = getCamo(storedId);
  if (!enabled || !camo || level === null || level < camo.requiredLevel) return BY_ID.get(DEFAULT_CAMO_ID)!;
  return camo;
}

// ---- color helpers (pure) ----

function parseHex(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// Linear blend a → b by t (0..1).
export function mixHex(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex([ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k]);
}

// The camo's palette resolved against the lifter's tier hue.
export function camoPalette(camo: CardCamo, tierColor: string): string[] {
  if (camo.palette.tierMix <= 0) return camo.palette.colors.map(c => c.toUpperCase());
  return camo.palette.colors.map(c => mixHex(c, tierColor, camo.palette.tierMix));
}

export interface ResolvedSheen {
  mode: 'none' | 'once' | 'loop';
  ms: number;
  restMs: number;
  tint: string | 'prism';
  intensity: number;
}

// Tier sheen with the camo's overrides layered on top. A camo that forces a
// loop on a matte (D/E) tier gets its own cadence, never a 0ms sweep.
export function camoSheen(
  tier: { sheen: 'none' | 'once' | 'loop'; sheenMs: number; sheenRestMs: number },
  camo: CardCamo,
): ResolvedSheen {
  const o = camo.sheen ?? {};
  const mode = o.mode ?? tier.sheen;
  return {
    mode,
    ms: o.ms ?? (tier.sheenMs || 1600),
    restMs: o.restMs ?? (tier.sheenRestMs || 3000),
    tint: o.tint ?? '#FFFFFF',
    intensity: o.intensity ?? BASE_SHEEN_INTENSITY,
  };
}
