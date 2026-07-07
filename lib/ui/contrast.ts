// Pick a readable ink (near-white or near-black) to sit on top of a solid
// fill color. Used for primary buttons: some themes have a light primary
// (e.g. pine's ice blue) where white-on-primary is unreadable, while dark
// themes' saturated primaries need white — so choose per perceived luminance
// rather than hard-wiring to the theme background.
export function readableInkOn(hex: string): string {
  const m = hex.replace('#', '');
  if (m.length < 6) return '#FFFFFF';
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  // Perceived luminance (ITU-R BT.601). Bright fills get dark ink.
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? '#0B0B0F' : '#FFFFFF';
}
