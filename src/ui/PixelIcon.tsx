/**
 * Tiny pixel-art icons for the title bar's tabs, drawn on an 8×8 grid ("#" is
 * a pixel) and shown at 2× (16px), the same 2px pixel as the 16px pixel text.
 */
export const PIXEL_ICONS = {
  house: ["...##...", "..####..", ".######.", "########", ".##..##.", ".##..##.", ".##..##.", ".######."],
  books: ["#.......", "#..##...", "##.##..#", "##.##.##", "##.##.#.", "##.##.##", "##.##.##", "########"],
  dictionary: [".######.", "#......#", "#.####.#", "#......#", "#.###..#", "#......#", "########", "#######."],
  puzzle: ["..##....", "..##....", "######..", "########", "########", "######..", "##..##..", "##..##.."],
  openBook: ["........", "##....##", "###..###", "###..###", "###..###", "###..###", "########", "...##..."],
} satisfies Record<string, string[]>;

export type PixelIconName = keyof typeof PIXEL_ICONS;

/** One icon, in the current text colour. */
export function PixelIcon({ name }: { name: PixelIconName }) {
  const rows = PIXEL_ICONS[name];
  return (
    <svg className="pixel-icon" width={16} height={16} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (ch === "#" ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} /> : null)),
      )}
    </svg>
  );
}
