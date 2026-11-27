// Rank aura: how loud a lifter's avatar ring is, from their level alone (never
// rank names, so the ladder can be renamed freely). Pure data + math; the
// RankAvatar component renders it.
//
// Every animated period divides AURA_CLOCK_MS, so one shared 0→1 clock can drive
// every ring on screen and still loop seamlessly when it wraps.

export const AURA_CLOCK_MS = 72000;

export type AuraTier = 0 | 1 | 2 | 3 | 4;

export interface RankAura {
  tier: AuraTier;
  /** Ring stroke at the 44px reference size (scaled by auraGeometry). */
  ringWidth: number;
  /** One full orbit of the highlight, in ms. */
  orbitMs: number;
  /** Peak opacity of the highlight arc that orbits the ring. */
  highlight: number;
  /** Soft outer glow in the rank accent. */
  glow: boolean;
  /** Glow pulse period, ms (only meaningful with glow). */
  pulseMs: number;
  /** Sparkle particles orbiting the ring (0 = none). */
  sparkles: number;
  /** Sparkles orbit the opposite way, slower than the ring. */
  sparkleOrbitMs: number;
}

// Level thresholds where the aura steps up.
export const AURA_THRESHOLDS = [10, 30, 60, 80] as const;

const TIERS: Omit<RankAura, 'tier'>[] = [
  { ringWidth: 2, orbitMs: 12000, highlight: 0.45, glow: false, pulseMs: 3600, sparkles: 0, sparkleOrbitMs: 24000 },
  { ringWidth: 2.5, orbitMs: 9000, highlight: 0.6, glow: false, pulseMs: 3600, sparkles: 0, sparkleOrbitMs: 18000 },
  { ringWidth: 3, orbitMs: 6000, highlight: 0.75, glow: true, pulseMs: 3600, sparkles: 0, sparkleOrbitMs: 12000 },
  { ringWidth: 3.5, orbitMs: 4500, highlight: 0.85, glow: true, pulseMs: 3000, sparkles: 3, sparkleOrbitMs: 9000 },
  { ringWidth: 4, orbitMs: 3600, highlight: 0.95, glow: true, pulseMs: 2400, sparkles: 5, sparkleOrbitMs: 7200 },
];

export function auraTierForLevel(level: number): AuraTier {
  const lv = Number.isFinite(level) ? level : 1;
  let tier = 0;
  for (const t of AURA_THRESHOLDS) if (lv >= t) tier++;
  return tier as AuraTier;
}

export function rankAura(level: number): RankAura {
  const tier = auraTierForLevel(level);
  return { tier, ...TIERS[tier] };
}

export const AURA_REFERENCE_SIZE = 44;

export interface AuraGeometry {
  /** Stroke width in px at this avatar size. */
  ring: number;
  /** Clear space between the photo and the ring. */
  gap: number;
  /** ring + gap: how far the ring box extends past the photo on each side. */
  pad: number;
  /** Extra room past the ring for the glow (0 without glow). */
  glowPad: number;
  /** Sparkle dot radius. */
  sparkleR: number;
}

// Ring scales with the avatar, clamped so tiny avatars keep a visible ring and
// the 112px profile hero doesn't get a tire.
export function auraGeometry(size: number, aura: RankAura): AuraGeometry {
  const scale = Math.max(0.75, Math.min(1.75, size / AURA_REFERENCE_SIZE));
  const ring = round1(aura.ringWidth * scale);
  const gap = round1(Math.max(1.5, 1.5 * scale));
  const pad = round1(ring + gap);
  const glowPad = aura.glow ? round1(Math.max(6, size * 0.16)) : 0;
  const sparkleR = round1(Math.max(1.25, ring * 0.45));
  return { ring, gap, pad, glowPad, sparkleR };
}

// Turns of a period per full clock cycle (integer by construction, see test).
export function cyclesPerClock(periodMs: number): number {
  return Math.round(AURA_CLOCK_MS / periodMs);
}

// Evenly spaced sparkle angles (radians), offset so they don't line up with
// the highlight's start.
export function sparkleAngles(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2 + Math.PI / 5);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
