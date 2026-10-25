// Stroke order for a component KanjiVG has no drawing of (𠂉, the top of
// 乞): KanjiVG labels the parts of every character it draws, so the part can
// be cut out of a character that contains it.

/**
 * The part of a KanjiVG drawing labelled `element` (kvg:element="𠂉"), as a
 * drawing of its own, in the same place on the same canvas; null if the
 * drawing has no such part.
 */
export function partSvg(svg: string, element: string): string | null {
  const start = svg.search(new RegExp(`<g\\b[^>]*\\bkvg:element="${element}"`, "u"));
  if (start < 0) return null;
  // Its closing </g>: count the groups opened inside it.
  const tags = /<g\b[^>]*?(\/?)>|<\/g>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let m = tags.exec(svg); m; m = tags.exec(svg)) {
    if (m[0] === "</g>") depth--;
    else if (!m[1]) depth++;
    if (depth === 0) {
      const part = svg.slice(start, tags.lastIndex);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109" xmlns:kvg="https://kanjivg.tagaini.net/">\n${part}\n</svg>`;
    }
  }
  return null;
}
