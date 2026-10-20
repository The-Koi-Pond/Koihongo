// Stroke paths from KanjiVG SVGs, for step-by-step stroke order.

/** The SVG path data of each stroke, in stroke order. */
export function strokePaths(svg: string): string[] {
  const strokes: [number, string][] = [];
  for (const m of svg.matchAll(/<path\b[^>]*?\bid="[^"]*-s(\d+)"[^>]*?\sd="([^"]+)"/g)) {
    strokes.push([Number(m[1]), m[2]]);
  }
  return strokes.sort((a, b) => a[0] - b[0]).map(([, d]) => d);
}

/** Where a stroke starts (its first "M x,y"), to mark it with a dot. */
export function strokeStart(d: string): [number, number] | null {
  const m = /^\s*M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/i.exec(d);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
