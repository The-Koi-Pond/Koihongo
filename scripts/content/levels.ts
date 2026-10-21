// Game-style levels over the main path, grouped into regions named after
// (approximate) JLPT bands. The JLPT stopped publishing official lists in 2010,
// so bands come from the pre-2010 levels kept in KANJIDIC2: old 4 ≈ N5,
// old 3 ≈ N4, old 2 split in path order into N3 and N2, old 1 and unlisted ≈ N1.

export type LevelItem = { key: string; kind: string; requires: string[] };

export type Level = {
  level: number;
  region: string;
  /** Position within the region, from 1, and the region's number of levels. */
  regionLevel: number;
  regionLevels: number;
  kanjiCount: number;
  /** Kanji that must pass to clear the level. */
  needed: number;
};

/** About a week per level at the default pace (10 lessons a day passes ~7 kanji a week). */
export const KANJI_PER_LEVEL = 8;

const REGIONS = ["N5", "N4", "N3", "N2", "N1"] as const;

/**
 * Kanji needed to clear a level: 90%, but always allowing one stubborn kanji
 * (90% of 8 would round up to all 8).
 */
export function kanjiNeeded(count: number): number {
  return count <= 1 ? count : Math.min(Math.ceil(count * 0.9), count - 1);
}

/** Splits `items` into `parts` runs whose sizes differ by at most one (bigger ones first). */
function split<T>(items: T[], parts: number): T[][] {
  const out: T[][] = [];
  let start = 0;
  for (let i = 0; i < parts; i++) {
    const size = Math.floor(items.length / parts) + (i < items.length % parts ? 1 : 0);
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}

/**
 * Assigns every item on the main path a level. Kanji are split into levels of
 * about `perLevel` within each region; a component belongs to the first level
 * whose kanji use it, and a word to the level of its last kanji (when it unlocks).
 */
export function planLevels(
  path: LevelItem[],
  oldJlpt: (kanjiKey: string) => number | null,
  perLevel = KANJI_PER_LEVEL,
): { levels: Level[]; itemLevel: Map<string, number> } {
  const kanji = path.filter((p) => p.kind === "kanji");
  const byRegion = new Map<string, LevelItem[]>(REGIONS.map((r) => [r, []]));
  const old2 = kanji.filter((k) => oldJlpt(k.key) === 2);
  const n3 = new Set(old2.slice(0, Math.ceil(old2.length / 2)).map((k) => k.key));
  for (const k of kanji) {
    const old = oldJlpt(k.key);
    const region = old === 4 ? "N5" : old === 3 ? "N4" : old === 2 ? (n3.has(k.key) ? "N3" : "N2") : "N1";
    byRegion.get(region)!.push(k);
  }

  const levels: Level[] = [];
  const itemLevel = new Map<string, number>();
  for (const region of REGIONS) {
    const list = byRegion.get(region)!;
    if (list.length === 0) continue;
    const runs = split(list, Math.max(1, Math.round(list.length / perLevel)));
    runs.forEach((run, i) => {
      const level = levels.length + 1;
      levels.push({ level, region, regionLevel: i + 1, regionLevels: runs.length, kanjiCount: run.length, needed: kanjiNeeded(run.length) });
      for (const k of run) itemLevel.set(k.key, level);
    });
  }

  // Components: the first level whose kanji need them.
  for (const k of kanji) {
    for (const r of k.requires) {
      const current = itemLevel.get(r);
      if (r.startsWith("component:") && (current === undefined || itemLevel.get(k.key)! < current)) itemLevel.set(r, itemLevel.get(k.key)!);
    }
  }
  // Words: the level of their last kanji. Anything left over takes the level of the kanji before it.
  let lastKanjiLevel = 1;
  for (const p of path) {
    if (p.kind === "kanji") lastKanjiLevel = itemLevel.get(p.key)!;
    if (itemLevel.has(p.key)) continue;
    const kanjiLevels = p.requires.flatMap((r) => itemLevel.get(r) ?? []);
    itemLevel.set(p.key, kanjiLevels.length ? Math.max(...kanjiLevels) : lastKanjiLevel);
  }
  return { levels, itemLevel };
}
