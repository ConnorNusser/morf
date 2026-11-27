// Path data for the body graph figure. Coordinates live in a 200×420 viewBox,
// figure centered on x = 100. Bilateral muscles are drawn once on the left
// half (`side`) and mirrored at render time, so the figure is symmetric by
// construction; midline muscles (abs, traps) are drawn whole (`center`).
import { BodyRegion } from '@/lib/data/bodyRegions';

export const BODY_VIEWBOX = { width: 200, height: 420 } as const;

export type FigureView = 'front' | 'back';

export interface RegionShapes {
  side?: string[]; // left half; mirrored across x = 100
  center?: string[];
}

// Ellipse as a path (two arcs), so every shape is a <Path>.
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`;
}

// Rounded rectangle with quadratic corners.
function rounded(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

// ---- Shared limb shapes (identical on both views) ----

const DELTOID = 'M 71 66 C 58 63, 46 70, 43 84 C 41 94, 42 103, 45 110 C 51 103, 57 95, 63 89 C 68 83, 72 75, 71 66 Z';
const UPPER_ARM = 'M 46 115 C 42 125, 40 137, 42 148 C 44 154, 51 156, 56 151 C 60 141, 62 127, 60 113 C 56 107, 50 107, 46 115 Z';
const FOREARM =
  'M 42 160 C 37 172, 33 186, 32 200 C 31 210, 31 217, 33 222 L 42 222 C 46 210, 51 192, 55 176 C 57 168, 57 162, 54 159 C 50 156, 45 156, 42 160 Z';

// ---- Silhouette: the non-region parts (head, neck, hands, knees, feet, pelvis) ----

const HEAD = ellipse(100, 30, 16, 20);
const HAND = ellipse(37, 234, 7, 11);
const KNEE = ellipse(84, 327, 9, 6);
const FOOT = 'M 78 398 C 75 404, 75 410, 79 413 L 93 413 C 96 410, 95 402, 91 397 C 87 395, 81 395, 78 398 Z';

export const SILHOUETTE: Record<FigureView, RegionShapes> = {
  front: {
    center: [
      HEAD,
      'M 91 47 C 94 51, 106 51, 109 47 L 112 66 C 106 69, 94 69, 88 66 Z', // neck
      'M 72 206 C 82 208, 92 212, 100 220 C 108 212, 118 208, 128 206 L 126 214 C 116 216, 106 222, 100 228 C 94 222, 84 216, 74 214 Z', // pelvis
    ],
    side: [HAND, KNEE, FOOT],
  },
  back: {
    center: [
      HEAD,
      'M 91 47 C 94 51, 106 51, 109 47 L 110 58 C 106 60, 94 60, 90 58 Z', // neck (traps cover the base)
    ],
    side: [HAND, KNEE, FOOT],
  },
};

// ---- Regions ----

export const REGION_PATHS: Record<FigureView, Partial<Record<BodyRegion, RegionShapes>>> = {
  front: {
    shoulders: { side: [DELTOID] },
    chest: {
      side: ['M 98 71 L 75 69 C 68 75, 64 85, 64 96 C 64 108, 72 116, 84 117 C 92 117, 98 113, 98 106 Z'],
    },
    biceps: { side: [UPPER_ARM] },
    forearms: { side: [FOREARM] },
    abs: {
      side: [
        rounded(87, 121, 11, 17, 4),
        rounded(87, 141, 11, 17, 4),
        rounded(88, 161, 10, 16, 4),
        'M 89 180 L 98 180 L 98 205 C 94 203, 90 195, 89 187 Z',
      ],
    },
    obliques: {
      side: [
        'M 67 113 C 73 118, 79 120, 84 121 L 84 178 C 84 189, 85 197, 87 203 C 80 202, 74 198, 72 192 C 70 178, 70 162, 68 148 C 66 136, 65 123, 67 113 Z',
      ],
    },
    quads: {
      side: [
        'M 73 216 C 82 219, 92 223, 98 230 C 99 248, 98 272, 96 292 C 95 306, 93 314, 91 319 C 86 321, 80 321, 77 318 C 72 300, 68 272, 68 248 C 68 234, 70 224, 73 216 Z',
      ],
    },
    calves: {
      side: [
        'M 77 335 C 73 349, 73 366, 76 383 C 78 391, 82 395, 86 395 C 90 389, 94 372, 95 356 C 96 345, 94 337, 90 334 C 86 331, 80 331, 77 335 Z',
      ],
    },
  },
  back: {
    traps: {
      center: [
        'M 100 52 C 94 58, 84 63, 72 67 C 80 72, 89 81, 94 98 L 100 120 L 106 98 C 111 81, 120 72, 128 67 C 116 63, 106 58, 100 52 Z',
      ],
    },
    'rear-delts': { side: [DELTOID] },
    'upper-back': {
      side: ['M 70 71 C 77 75, 85 83, 90 98 L 94 113 C 87 116, 79 115, 72 110 C 68 100, 66 89, 66 81 C 66 75, 67 72, 70 71 Z'],
    },
    lats: {
      side: [
        'M 66 113 C 74 118, 82 120, 90 120 C 90 136, 88 152, 85 165 C 83 173, 80 180, 76 186 C 72 174, 69 160, 68 147 C 67 135, 64 123, 66 113 Z',
      ],
    },
    'lower-back': {
      side: ['M 93 123 L 98 123 L 98 201 L 81 201 C 81 193, 83 181, 86 169 C 89 155, 92 139, 93 123 Z'],
    },
    triceps: { side: [UPPER_ARM] },
    forearms: { side: [FOREARM] },
    glutes: {
      side: ['M 98 204 L 98 249 C 92 255, 80 255, 73 247 C 67 239, 66 225, 69 215 C 72 207, 80 204, 98 204 Z'],
    },
    hamstrings: {
      side: [
        'M 71 255 C 80 259, 92 259, 98 255 C 99 271, 98 290, 96 304 C 94 313, 92 318, 90 320 C 85 322, 80 321, 77 318 C 72 302, 69 281, 70 265 Z',
      ],
    },
    calves: {
      side: [
        'M 76 334 C 70 344, 70 360, 74 374 C 77 384, 82 390, 86 392 C 92 386, 96 368, 96 352 C 96 342, 93 335, 89 332 C 84 330, 79 331, 76 334 Z',
      ],
    },
  },
};

export function regionsInView(view: FigureView): BodyRegion[] {
  return Object.keys(REGION_PATHS[view]) as BodyRegion[];
}
