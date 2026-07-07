// Exercise naming/ID utils. Name: "Bench Press (Barbell)" -> ID: "bench-press-barbell"

// "Bench Press (Barbell)" -> "bench-press-barbell"
export function exerciseNameToId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
