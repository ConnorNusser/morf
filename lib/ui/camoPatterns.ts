// Deterministic pattern geometry for card camos (see lib/gamification/cardCamos.ts).
// Everything is generated in a fixed virtual canvas (CAMO_W × CAMO_H) from a
// seeded PRNG, so a camo looks identical on every render, every device, and at
// every size (the SVG scales it with a viewBox). Pure + cached; shape counts are
// bounded (≤ MAX_CAMO_SHAPES) so the SVG stays cheap to draw.
import { CamoPattern } from '@/lib/gamification/cardCamos';

export const CAMO_W = 360;
export const CAMO_H = 240;
export const MAX_CAMO_SHAPES = 150;

// Colors are palette indexes, resolved at render against the tier-mixed palette.
export type CamoShape =
  | { kind: 'path'; d: string; color: number; opacity: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: number; opacity: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; color: number; opacity: number }
  | { kind: 'cloud'; cx: number; cy: number; rx: number; ry: number; color: number; opacity: number };

export interface CamoGeometry {
  shapes: CamoShape[]; // drawn in canvas space
  tile?: { size: number; shapes: CamoShape[] }; // repeating <Pattern> tile (weave)
  stars?: CamoShape[]; // cosmic: drawn on a separate, slower layer
}

// mulberry32 — tiny, fast, good enough for visuals.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// Closed smooth blob: jittered radial points joined by quadratic curves through midpoints.
function blobPath(rand: () => number, cx: number, cy: number, r: number): string {
  const n = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.5;
    const rr = r * (0.55 + rand() * 0.65);
    pts.push([cx + Math.cos(a) * rr * 1.35, cy + Math.sin(a) * rr]);
  }
  const mid = (i: number): [number, number] => {
    const p = pts[i % n];
    const q = pts[(i + 1) % n];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const m0 = mid(0);
  let d = `M${r1(m0[0])} ${r1(m0[1])}`;
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    const m = mid(i);
    d += ` Q${r1(p[0])} ${r1(p[1])} ${r1(m[0])} ${r1(m[1])}`;
  }
  return `${d} Z`;
}

function blobs(rand: () => number): CamoGeometry {
  const shapes: CamoShape[] = [];
  // Three passes, large → small, so blots overlap like printed woodland.
  const passes = [
    { count: 14, r: 34 },
    { count: 18, r: 22 },
    { count: 20, r: 13 },
  ];
  passes.forEach((p, pi) => {
    for (let i = 0; i < p.count; i++) {
      shapes.push({
        kind: 'path',
        d: blobPath(rand, rand() * (CAMO_W + 40) - 20, rand() * (CAMO_H + 40) - 20, p.r),
        color: (i + pi) % 4,
        opacity: 0.7 + rand() * 0.3,
      });
    }
  });
  return { shapes };
}

function pixels(rand: () => number): CamoGeometry {
  const shapes: CamoShape[] = [];
  const cell = 12;
  // 36 clusters × ≤3 stepped blocks — reads as digital camo without a per-cell grid.
  for (let i = 0; i < 36; i++) {
    const cx = Math.floor(rand() * (CAMO_W / cell)) * cell;
    const cy = Math.floor(rand() * (CAMO_H / cell)) * cell;
    const color = i % 4;
    const blocks = 1 + Math.floor(rand() * 3);
    for (let b = 0; b < blocks; b++) {
      const w = (2 + Math.floor(rand() * 4)) * cell;
      const h = (1 + Math.floor(rand() * 3)) * cell;
      const dx = (Math.floor(rand() * 5) - 2) * cell;
      const dy = (Math.floor(rand() * 3) - 1) * cell;
      shapes.push({ kind: 'rect', x: cx + dx, y: cy + dy, w, h, color, opacity: 0.75 + rand() * 0.25 });
    }
  }
  return { shapes };
}

// Tapered stripe swept diagonally across the card, with a ragged edge.
function stripes(rand: () => number): CamoGeometry {
  const shapes: CamoShape[] = [];
  const count = 26;
  for (let i = 0; i < count; i++) {
    const x0 = -60 + (i / count) * (CAMO_W + 120) + (rand() - 0.5) * 14;
    const len = 90 + rand() * 140;
    const y0 = rand() * CAMO_H * 0.6 - 30;
    const ang = 1.05 + (rand() - 0.5) * 0.3; // steep diagonal
    const w = 5 + rand() * 9;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    // Normal for the stripe's width.
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    const segs = 4;
    const left: string[] = [];
    const right: string[] = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const taper = Math.sin(Math.PI * t) * w * (0.7 + rand() * 0.6);
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      left.push(`${r1(px + nx * taper)} ${r1(py + ny * taper)}`);
      right.unshift(`${r1(px - nx * taper * 0.6)} ${r1(py - ny * taper * 0.6)}`);
    }
    shapes.push({ kind: 'path', d: `M${left.join(' L')} L${right.join(' L')} Z`, color: i % 2, opacity: 0.8 + rand() * 0.2 });
  }
  return { shapes };
}

// Carbon twill: a 16px tile of light/dark half-cells, repeated by an SVG Pattern.
function weave(): CamoGeometry {
  const s = 8;
  const tile: CamoShape[] = [
    { kind: 'rect', x: 0, y: 0, w: s, h: s / 2, color: 2, opacity: 0.9 },
    { kind: 'rect', x: 0, y: s / 2, w: s, h: s / 2, color: 1, opacity: 0.9 },
    { kind: 'rect', x: s, y: 0, w: s / 2, h: s, color: 1, opacity: 0.9 },
    { kind: 'rect', x: s + s / 2, y: 0, w: s / 2, h: s, color: 0, opacity: 0.9 },
    { kind: 'rect', x: 0, y: s, w: s / 2, h: s, color: 1, opacity: 0.9 },
    { kind: 'rect', x: s / 2, y: s, w: s / 2, h: s, color: 0, opacity: 0.9 },
    { kind: 'rect', x: s, y: s, w: s, h: s / 2, color: 2, opacity: 0.9 },
    { kind: 'rect', x: s, y: s + s / 2, w: s, h: s / 2, color: 1, opacity: 0.9 },
  ];
  return { shapes: [], tile: { size: s * 2, shapes: tile } };
}

// Brushed metal: thin horizontal streaks at varied tone over the metal gradient.
function brushed(rand: () => number): CamoGeometry {
  const shapes: CamoShape[] = [];
  for (let i = 0; i < 110; i++) {
    const w = 40 + rand() * 220;
    shapes.push({
      kind: 'rect',
      x: rand() * (CAMO_W + w) - w,
      y: r1(rand() * CAMO_H),
      w,
      h: 0.6 + rand() * 0.9,
      color: rand() < 0.5 ? 0 : 2, // dark grain + bright grain
      opacity: 0.25 + rand() * 0.45,
    });
  }
  return { shapes };
}

// Faceted prism: a jittered grid split into triangles, each a palette tint.
function facets(rand: () => number): CamoGeometry {
  const cols = 8;
  const rows = 5;
  const pts: [number, number][][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: [number, number][] = [];
    for (let c = 0; c <= cols; c++) {
      const edgeX = c === 0 || c === cols;
      const edgeY = r === 0 || r === rows;
      const jx = edgeX ? 0 : (rand() - 0.5) * (CAMO_W / cols) * 0.7;
      const jy = edgeY ? 0 : (rand() - 0.5) * (CAMO_H / rows) * 0.7;
      row.push([(c / cols) * CAMO_W + jx, (r / rows) * CAMO_H + jy]);
    }
    pts.push(row);
  }
  const shapes: CamoShape[] = [];
  const tri = (a: [number, number], b: [number, number], c: [number, number]) =>
    `M${r1(a[0])} ${r1(a[1])} L${r1(b[0])} ${r1(b[1])} L${r1(c[0])} ${r1(c[1])} Z`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = pts[r][c];
      const b = pts[r][c + 1];
      const d = pts[r + 1][c];
      const e = pts[r + 1][c + 1];
      const flip = rand() < 0.5;
      const [t1, t2] = flip ? [tri(a, b, e), tri(a, e, d)] : [tri(a, b, d), tri(b, e, d)];
      shapes.push({ kind: 'path', d: t1, color: (r + c) % 5, opacity: 0.35 + rand() * 0.65 });
      shapes.push({ kind: 'path', d: t2, color: (r + c + 2) % 5, opacity: 0.35 + rand() * 0.65 });
    }
  }
  return { shapes };
}

// Nebula: a few soft radial clouds + a sparse star field on its own layer.
function cosmic(rand: () => number): CamoGeometry {
  const shapes: CamoShape[] = [];
  for (let i = 0; i < 5; i++) {
    shapes.push({
      kind: 'cloud',
      cx: rand() * CAMO_W,
      cy: rand() * CAMO_H,
      rx: 90 + rand() * 110,
      ry: 60 + rand() * 70,
      color: i % 3,
      opacity: 0.6 + rand() * 0.4,
    });
  }
  const stars: CamoShape[] = [];
  for (let i = 0; i < 64; i++) {
    stars.push({
      kind: 'circle',
      cx: r1(rand() * CAMO_W),
      cy: r1(rand() * CAMO_H),
      r: r1(0.4 + rand() * rand() * 1.4),
      color: 3,
      opacity: 0.35 + rand() * 0.65,
    });
  }
  return { shapes, stars };
}

const cache = new Map<string, CamoGeometry>();

export function camoGeometry(pattern: CamoPattern, seedKey: string = pattern): CamoGeometry {
  const key = `${pattern}:${seedKey}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = seededRandom(hashSeed(key));
  let g: CamoGeometry;
  switch (pattern) {
    case 'blobs':
      g = blobs(rand);
      break;
    case 'pixels':
      g = pixels(rand);
      break;
    case 'stripes':
      g = stripes(rand);
      break;
    case 'weave':
      g = weave();
      break;
    case 'brushed':
      g = brushed(rand);
      break;
    case 'facets':
      g = facets(rand);
      break;
    case 'cosmic':
      g = cosmic(rand);
      break;
    default:
      g = { shapes: [] };
  }
  cache.set(key, g);
  return g;
}

export function shapeCount(g: CamoGeometry): number {
  return g.shapes.length + (g.tile?.shapes.length ?? 0) + (g.stars?.length ?? 0);
}

// ---- sheen stops ----

// "#RRGGBB" + alpha → "#RRGGBBAA" (same as tierFoil.hexAlpha; local to avoid a cycle).
function withA(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

export const PRISM_BANDS = ['#FF7A7A', '#FFD36B', '#7DFFB2', '#6BC8FF', '#C98BFF'];

// Gradient stops for the card's Sheen sweep: transparent → tint → transparent,
// or rainbow bands for 'prism'.
export function sheenStops(tint: string, intensity: number): string[] {
  if (tint === 'prism') {
    return ['#FFFFFF00', ...PRISM_BANDS.map(c => withA(c, intensity)), '#FFFFFF00'];
  }
  return [withA(tint, 0), withA(tint, intensity), withA(tint, 0)];
}
