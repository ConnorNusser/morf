// Copy for the Profile tab hero (avatar + name + rank). Pure.

// 1 → "1st", 22 → "22nd", 13 → "13th".
export function formatOrdinal(n: number): string {
  const v = Math.round(n);
  const mod100 = Math.abs(v) % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (Math.abs(v) % 10) {
    case 1: return `${v}st`;
    case 2: return `${v}nd`;
    case 3: return `${v}rd`;
    default: return `${v}th`;
  }
}

// "Gold II · Level 23".
export function heroRankLine(rankName: string, level: number): string {
  return `${rankName} · Level ${level}`;
}

// "B+ tier · 64th percentile"; null when the lifter is still unranked (no
// visible lifts → overall 0), so the hero simply omits the line.
export function heroStrengthLine(tier: string | null | undefined, overallPercentile: number): string | null {
  if (!tier || !Number.isFinite(overallPercentile) || overallPercentile <= 0) return null;
  return `${tier} tier · ${formatOrdinal(overallPercentile)} percentile`;
}
