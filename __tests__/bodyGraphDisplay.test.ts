import { regionsInView, REGION_PATHS } from '@/components/gamification/bodyGraphPaths';
import { ALL_BODY_REGIONS, BODY_REGIONS } from '@/lib/data/bodyRegions';
import { NextTierTarget } from '@/lib/gamification/bodyGraph';
import {
  formatE1rm,
  formatNextTierLine,
  formatSetsPerWeek,
  formatTierUp,
  laggingLine,
  ordinal,
  regionFill,
  roundDelta,
  setsBar,
  tierUpGraphStates,
  trainRegionRequest,
} from '@/lib/gamification/bodyGraphDisplay';

describe('regionFill', () => {
  it('ranked regions use their tier, regardless of volume', () => {
    expect(regionFill({ tier: 'B+', training: 'none' })).toEqual({ kind: 'tier', tier: 'B+' });
  });
  it('unranked regions with volume are hatched, lighter when light', () => {
    const light = regionFill({ tier: null, training: 'light' });
    const high = regionFill({ tier: null, training: 'high' });
    expect(light.kind).toBe('volume');
    expect(high.kind).toBe('volume');
    if (light.kind === 'volume' && high.kind === 'volume') expect(light.intensity).toBeLessThan(high.intensity);
  });
  it('untrained or missing regions are neutral', () => {
    expect(regionFill({ tier: null, training: 'none' })).toEqual({ kind: 'untrained' });
    expect(regionFill(undefined)).toEqual({ kind: 'untrained' });
  });
});

describe('next-tier line', () => {
  const next: NextTierTarget = { tier: 'A-', exerciseId: 'bench', targetE1rmLbs: 250, deltaLbs: 11.2 };
  it('rounds up to whole lb', () => {
    expect(formatNextTierLine(next, 'Bench Press (Barbell)', 'lbs')).toBe('+12 lb on Bench Press (Barbell) → A-');
  });
  it('converts to kg and rounds up to 0.5', () => {
    // 11.2 lb = 5.08 kg → 5.5
    expect(formatNextTierLine(next, 'Bench Press (Barbell)', 'kg')).toBe('+5.5 kg on Bench Press (Barbell) → A-');
  });
  it('never shows zero', () => {
    expect(roundDelta(0.1, 'lbs')).toBe(1);
    expect(roundDelta(0.1, 'kg')).toBe(0.5);
  });
});

describe('setsBar', () => {
  it('places the 10–20 band on a 25-set scale', () => {
    const bar = setsBar(5);
    expect(bar.scale).toBe(25);
    expect(bar.bandStart).toBeCloseTo(0.4);
    expect(bar.bandEnd).toBeCloseTo(0.8);
    expect(bar.fill).toBeCloseTo(0.2);
    expect(bar.status).toBe('below');
  });
  it('grows the scale past 25 and flags over-target', () => {
    const bar = setsBar(30);
    expect(bar.scale).toBe(30);
    expect(bar.fill).toBe(1);
    expect(bar.status).toBe('above');
    expect(setsBar(15).status).toBe('in');
  });
});

describe('copy', () => {
  it('formats sets/week', () => {
    expect(formatSetsPerWeek(4)).toBe('4');
    expect(formatSetsPerWeek(4.5)).toBe('4.5');
    expect(formatSetsPerWeek(12.3)).toBe('12');
  });
  it('lagging line with verb agreement', () => {
    expect(laggingLine({ region: 'hamstrings', tier: 'C', setsPerWeek: 4 })).toBe(
      'Hamstrings are lagging · C tier · 4 sets/wk',
    );
    expect(laggingLine({ region: 'chest', tier: 'D+', setsPerWeek: 2.5 })).toBe(
      'Chest is lagging · D+ tier · 2.5 sets/wk',
    );
  });
  it('tier-up lines', () => {
    expect(formatTierUp({ region: 'chest', from: 'B', to: 'B+' })).toBe('Chest B → B+');
    expect(formatTierUp({ region: 'quads', from: null, to: 'C' })).toBe('Quads ranked: C');
  });
  it('train request names the muscle group and region', () => {
    expect(trainRegionRequest('hamstrings')).toBe('A legs workout that prioritizes my hamstrings');
    expect(trainRegionRequest('rear-delts')).toBe('A shoulders workout that prioritizes my rear delts');
  });
  it('ordinals and e1RM', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 62, 100].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '62nd', '100th',
    ]);
    expect(formatE1rm(225, 'lbs')).toBe('225 lb');
    expect(formatE1rm(225, 'kg')).toBe('102 kg');
  });
  it('tier-up graph states carry the new tier', () => {
    const [s] = tierUpGraphStates([{ region: 'chest', to: 'B+' }]);
    expect(s).toMatchObject({ region: 'chest', tier: 'B+', fresh: false });
  });
});

describe('body graph paths', () => {
  it('draws every region in the view(s) its metadata names', () => {
    for (const meta of BODY_REGIONS) {
      const front = regionsInView('front').includes(meta.id);
      const back = regionsInView('back').includes(meta.id);
      expect([meta.id, front, back]).toEqual([meta.id, meta.view !== 'back', meta.view !== 'front']);
    }
  });
  it('only draws known regions', () => {
    for (const view of ['front', 'back'] as const) {
      for (const r of Object.keys(REGION_PATHS[view])) expect(ALL_BODY_REGIONS).toContain(r);
    }
  });
});
