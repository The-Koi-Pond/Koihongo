import assert from "node:assert/strict";
import { test } from "node:test";
import { kanjiNeeded, planLevels, type LevelItem } from "./levels.ts";

test("clearing a level allows one stubborn kanji, or 10% of a big one", () => {
  assert.equal(kanjiNeeded(1), 1);
  assert.equal(kanjiNeeded(2), 1);
  assert.equal(kanjiNeeded(8), 7);
  assert.equal(kanjiNeeded(20), 18);
});

/** n kanji with the given old JLPT level, each needing one component and unlocking one word. */
function band(prefix: string, n: number, old: number | null, jlpt: Map<string, number | null>): LevelItem[] {
  return Array.from({ length: n }, (_, i) => {
    const k = `kanji:${prefix}${i}`;
    jlpt.set(k, old);
    return [
      { key: `component:${prefix}${i}`, kind: "component", requires: [] },
      { key: k, kind: "kanji", requires: [`component:${prefix}${i}`] },
      { key: `word:${prefix}${i}`, kind: "word", requires: [k] },
    ];
  }).flat();
}

test("levels split each region into runs of about 8 kanji, numbered along the path", () => {
  const jlpt = new Map<string, number | null>();
  const path = [...band("a", 20, 4, jlpt), ...band("b", 9, 3, jlpt), ...band("c", 32, 2, jlpt), ...band("d", 5, null, jlpt)];
  const { levels, itemLevel } = planLevels(path, (k) => jlpt.get(k) ?? null);

  assert.deepEqual(
    levels.map((l) => `${l.level}:${l.region}${l.regionLevel}/${l.regionLevels}:${l.kanjiCount}`),
    // 20 → 3 levels (7, 7, 6); 9 → 1; old 2's 32 split 16/16 into N3 and N2 (2 levels each); 5 → 1.
    ["1:N51/3:7", "2:N52/3:7", "3:N53/3:6", "4:N41/1:9", "5:N31/2:8", "6:N32/2:8", "7:N21/2:8", "8:N22/2:8", "9:N11/1:5"],
  );
  assert.equal(levels[3].needed, 8);
  // A component joins its kanji's level, a word follows its kanji.
  assert.equal(itemLevel.get("component:a7"), 2);
  assert.equal(itemLevel.get("word:a7"), 2);
  assert.equal(itemLevel.get("word:d4"), 9);
  assert.equal(itemLevel.size, path.length);
});

test("a component shared by two kanji belongs to the earlier level; a word to its last kanji's", () => {
  const jlpt = new Map<string, number | null>();
  const path = band("a", 16, 4, jlpt);
  // kanji:a12 (level 2) also uses component:a0 (level 1); a word using a1 and a12 waits for level 2.
  path.find((p) => p.key === "kanji:a12")!.requires.push("component:a0");
  path.push({ key: "word:both", kind: "word", requires: ["kanji:a1", "kanji:a12"] });
  const { itemLevel } = planLevels(path, (k) => jlpt.get(k) ?? null);
  assert.equal(itemLevel.get("component:a0"), 1);
  assert.equal(itemLevel.get("word:both"), 2);
});
