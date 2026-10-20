// Builds the default learning path: components → kanji → vocabulary.
// Pure functions only, so the ordering rules can be unit-tested.

export type Kind = "component" | "kanji" | "word";

export type PathKanji = {
  character: string;
  jlptOld: number | null; // old JLPT levels in KANJIDIC: 4 (easiest) … 1
  freqRank: number | null; // 1 = most frequent in newspapers
  strokeCount: number;
  components: string[]; // KRADFILE glyphs
};

export type PathWord = {
  id: string;
  kanji: string[]; // distinct kanji the written form uses
  priority: number; // lower = more frequent
  written: string;
};

export type PathEntry = { key: string; kind: Kind; requires: string[] };

export const itemKey = (kind: Kind, id: string) => `${kind}:${id}`;

function jlptBucket(old: number | null): number {
  return old === null ? 5 : 5 - old;
}

export function compareKanji(a: PathKanji, b: PathKanji): number {
  return (
    jlptBucket(a.jlptOld) - jlptBucket(b.jlptOld) ||
    (a.freqRank ?? Infinity) - (b.freqRank ?? Infinity) ||
    a.strokeCount - b.strokeCount ||
    a.character.codePointAt(0)! - b.character.codePointAt(0)!
  );
}

function compareWords(a: PathWord, b: PathWord): number {
  return (
    a.priority - b.priority ||
    a.written.length - b.written.length ||
    Number(a.id) - Number(b.id)
  );
}

/**
 * Walks kanji in teaching order. Each kanji is preceded by any of its
 * components not yet placed, and followed by up to `wordsPerKanji` of the most
 * frequent words that have become readable. Readable words that don't fit wait
 * in a pool for later slots. Words using kanji outside `kanji` never appear.
 */
export function buildPath(
  kanji: PathKanji[],
  componentStrokes: Map<string, number>,
  words: PathWord[],
  wordsPerKanji = 3,
): PathEntry[] {
  const path: PathEntry[] = [];
  const placedComponents = new Set<string>();

  const wordsByKanji = new Map<string, PathWord[]>();
  const missing = new Map<string, number>(); // word id → kanji not yet placed
  for (const w of words) {
    missing.set(w.id, w.kanji.length);
    for (const k of w.kanji) {
      const list = wordsByKanji.get(k) ?? [];
      list.push(w);
      wordsByKanji.set(k, list);
    }
  }
  const pool: PathWord[] = [];

  for (const k of [...kanji].sort(compareKanji)) {
    const components = [...new Set(k.components)].sort(
      (a, b) =>
        (componentStrokes.get(a) ?? 0) - (componentStrokes.get(b) ?? 0) ||
        a.codePointAt(0)! - b.codePointAt(0)!,
    );
    for (const c of components) {
      if (placedComponents.has(c)) continue;
      placedComponents.add(c);
      path.push({ key: itemKey("component", c), kind: "component", requires: [] });
    }
    path.push({
      key: itemKey("kanji", k.character),
      kind: "kanji",
      requires: components.map((c) => itemKey("component", c)),
    });

    for (const w of wordsByKanji.get(k.character) ?? []) {
      const left = missing.get(w.id)! - 1;
      missing.set(w.id, left);
      if (left === 0) pool.push(w);
    }
    pool.sort(compareWords);
    for (const w of pool.splice(0, wordsPerKanji)) {
      path.push({
        key: itemKey("word", w.id),
        kind: "word",
        requires: w.kanji.map((c) => itemKey("kanji", c)),
      });
    }
  }
  return path;
}
