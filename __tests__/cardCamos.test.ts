import {
  CARD_CAMOS,
  camoPalette,
  camoSheen,
  camosUnlockedBetween,
  getCamo,
  isCamoUnlocked,
  mixHex,
  nextCamoUnlock,
  resolveEquippedCamo,
  unlockedCamos,
} from '@/lib/gamification/cardCamos';
import { MAX_CAMO_SHAPES, camoGeometry, seededRandom, shapeCount, sheenStops } from '@/lib/ui/camoPatterns';
import { tierFoil } from '@/lib/ui/tierFoil';

describe('card camo catalog', () => {
  it('has the expected gates, standard first and ascending', () => {
    expect(CARD_CAMOS.map(c => [c.id, c.requiredLevel])).toEqual([
      ['standard', 1],
      ['woodland', 5],
      ['digital', 10],
      ['tiger', 15],
      ['carbon', 20],
      ['gold', 30],
      ['platinum', 40],
      ['diamond', 50],
      ['nebula', 60],
    ]);
  });

  it('has unique ids and names, and copy on every entry', () => {
    expect(new Set(CARD_CAMOS.map(c => c.id)).size).toBe(CARD_CAMOS.length);
    expect(new Set(CARD_CAMOS.map(c => c.name)).size).toBe(CARD_CAMOS.length);
    for (const c of CARD_CAMOS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps pattern layers low-alpha for legibility', () => {
    for (const c of CARD_CAMOS) {
      expect(c.opacity.dark).toBeLessThanOrEqual(0.45);
      expect(c.opacity.light).toBeLessThanOrEqual(0.45);
    }
  });

  it('only the final camo animates', () => {
    expect(CARD_CAMOS.filter(c => c.animated).map(c => c.id)).toEqual(['nebula']);
  });
});

describe('unlocks', () => {
  it('isCamoUnlocked gates on level and rejects unknown ids', () => {
    expect(isCamoUnlocked('standard', 1)).toBe(true);
    expect(isCamoUnlocked('gold', 29)).toBe(false);
    expect(isCamoUnlocked('gold', 30)).toBe(true);
    expect(isCamoUnlocked('nope', 99)).toBe(false);
  });

  it('unlockedCamos / nextCamoUnlock', () => {
    expect(unlockedCamos(1).map(c => c.id)).toEqual(['standard']);
    expect(unlockedCamos(12).map(c => c.id)).toEqual(['standard', 'woodland', 'digital']);
    expect(unlockedCamos(100)).toHaveLength(CARD_CAMOS.length);
    expect(nextCamoUnlock(1)?.id).toBe('woodland');
    expect(nextCamoUnlock(30)?.id).toBe('platinum');
    expect(nextCamoUnlock(60)).toBeNull();
  });

  it('camosUnlockedBetween is exclusive of before, inclusive of after', () => {
    expect(camosUnlockedBetween(29, 30).map(c => c.id)).toEqual(['gold']);
    expect(camosUnlockedBetween(30, 31)).toEqual([]);
    expect(camosUnlockedBetween(4, 11).map(c => c.id)).toEqual(['woodland', 'digital']);
    expect(camosUnlockedBetween(1, 1)).toEqual([]);
    expect(camosUnlockedBetween(40, 30)).toEqual([]);
    // Level 1 itself is never a "new" unlock.
    expect(camosUnlockedBetween(1, 4)).toEqual([]);
  });
});

describe('resolveEquippedCamo', () => {
  it('returns the stored camo when unlocked', () => {
    expect(resolveEquippedCamo('gold', 35).id).toBe('gold');
  });
  it('falls back to standard when locked, unknown, empty or loading', () => {
    expect(resolveEquippedCamo('gold', 10).id).toBe('standard');
    expect(resolveEquippedCamo('dark-whatever', 99).id).toBe('standard');
    expect(resolveEquippedCamo(null, 99).id).toBe('standard');
    expect(resolveEquippedCamo('gold', null).id).toBe('standard');
  });
  it('renders standard when camos are switched off', () => {
    expect(resolveEquippedCamo('gold', 35, false).id).toBe('standard');
    expect(resolveEquippedCamo('gold', 35, true).id).toBe('gold');
  });
});

describe('palette + sheen', () => {
  it('mixHex blends linearly', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('tier-mixed palettes follow the tier; metals do not', () => {
    const woodland = getCamo('woodland')!;
    expect(camoPalette(woodland, '#3558C0')).not.toEqual(camoPalette(woodland, '#FFD700'));
    const gold = getCamo('gold')!;
    expect(camoPalette(gold, '#3558C0')).toEqual(camoPalette(gold, '#FFD700'));
  });

  it('standard keeps the tier sheen untouched', () => {
    const foil = tierFoil(95);
    const s = camoSheen(foil, getCamo('standard')!);
    expect(s).toEqual({ mode: foil.sheen, ms: foil.sheenMs, restMs: foil.sheenRestMs, tint: '#FFFFFF', intensity: 0.2 });
    expect(sheenStops(s.tint, s.intensity)).toEqual(['#FFFFFF00', '#FFFFFF33', '#FFFFFF00']);
  });

  it('metals force a stronger loop even on a matte tier', () => {
    const matte = tierFoil(5); // E/D: no sheen
    const s = camoSheen(matte, getCamo('gold')!);
    expect(s.mode).toBe('loop');
    expect(s.ms).toBeGreaterThan(0);
    expect(s.intensity).toBeGreaterThan(0.2);
  });

  it('prism sheen yields rainbow bands', () => {
    expect(sheenStops('prism', 0.3).length).toBeGreaterThan(3);
  });
});

describe('camo geometry', () => {
  it('is deterministic', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
    // Different seed keys → different (fresh) geometry; same key → identical.
    expect(JSON.stringify(camoGeometry('blobs', 'x'))).toBe(JSON.stringify(camoGeometry('blobs', 'x')));
    expect(JSON.stringify(camoGeometry('blobs', 'x'))).not.toBe(JSON.stringify(camoGeometry('blobs', 'y')));
  });

  it('keeps every camo within the shape budget', () => {
    for (const c of CARD_CAMOS) {
      const g = camoGeometry(c.pattern);
      expect(shapeCount(g)).toBeLessThanOrEqual(MAX_CAMO_SHAPES);
      if (c.pattern !== 'none') expect(shapeCount(g)).toBeGreaterThan(0);
    }
  });

  it('only references palette colors that exist', () => {
    for (const c of CARD_CAMOS) {
      const g = camoGeometry(c.pattern);
      const all = [...g.shapes, ...(g.tile?.shapes ?? []), ...(g.stars ?? [])];
      for (const s of all) expect(s.color).toBeLessThan(c.palette.colors.length);
    }
  });
});
