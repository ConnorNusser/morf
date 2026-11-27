import {
  AURA_CLOCK_MS,
  auraGeometry,
  auraTierForLevel,
  cyclesPerClock,
  rankAura,
  sparkleAngles,
} from '@/lib/ui/rankAura';

describe('auraTierForLevel', () => {
  it('steps up at 10 / 30 / 60 / 80', () => {
    expect(auraTierForLevel(1)).toBe(0);
    expect(auraTierForLevel(9)).toBe(0);
    expect(auraTierForLevel(10)).toBe(1);
    expect(auraTierForLevel(29)).toBe(1);
    expect(auraTierForLevel(30)).toBe(2);
    expect(auraTierForLevel(59)).toBe(2);
    expect(auraTierForLevel(60)).toBe(3);
    expect(auraTierForLevel(79)).toBe(3);
    expect(auraTierForLevel(80)).toBe(4);
    expect(auraTierForLevel(500)).toBe(4);
  });

  it('treats junk as the bottom tier', () => {
    expect(auraTierForLevel(NaN)).toBe(0);
    expect(auraTierForLevel(-3)).toBe(0);
  });
});

describe('rankAura', () => {
  const tiers = [1, 10, 30, 60, 80].map(rankAura);

  it('gets thicker and faster with rank', () => {
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].ringWidth).toBeGreaterThan(tiers[i - 1].ringWidth);
      expect(tiers[i].orbitMs).toBeLessThan(tiers[i - 1].orbitMs);
      expect(tiers[i].highlight).toBeGreaterThanOrEqual(tiers[i - 1].highlight);
    }
  });

  it('keeps low ranks glow-free and sparkles for the top ranks only', () => {
    expect(tiers[0].glow).toBe(false);
    expect(tiers[1].glow).toBe(false);
    expect(tiers[2].glow).toBe(true);
    expect(tiers[2].sparkles).toBe(0);
    expect(tiers[3].sparkles).toBeGreaterThan(0);
    expect(tiers[4].sparkles).toBeGreaterThan(tiers[3].sparkles);
  });

  it('uses periods that divide the shared clock so it loops seamlessly', () => {
    for (const a of tiers) {
      for (const p of [a.orbitMs, a.pulseMs, a.sparkleOrbitMs]) {
        expect(AURA_CLOCK_MS % p).toBe(0);
        expect(cyclesPerClock(p) * p).toBe(AURA_CLOCK_MS);
      }
    }
  });
});

describe('auraGeometry', () => {
  it('scales the ring with size within a clamp', () => {
    const top = rankAura(80);
    const small = auraGeometry(44, top);
    const hero = auraGeometry(112, top);
    expect(small.ring).toBe(4);
    expect(hero.ring).toBe(7); // clamped at 1.75x
    expect(auraGeometry(20, top).ring).toBe(3); // floored at 0.75x
    expect(hero.pad).toBeCloseTo(hero.ring + hero.gap, 5);
  });

  it('reserves glow room only when the aura glows', () => {
    expect(auraGeometry(44, rankAura(1)).glowPad).toBe(0);
    expect(auraGeometry(44, rankAura(30)).glowPad).toBeGreaterThan(0);
  });
});

describe('sparkleAngles', () => {
  it('spaces sparkles evenly around the ring', () => {
    const a = sparkleAngles(4);
    expect(a).toHaveLength(4);
    expect(a[1] - a[0]).toBeCloseTo(Math.PI / 2, 5);
    expect(sparkleAngles(0)).toEqual([]);
  });
});
