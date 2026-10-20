import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanName, describeComponent } from "./components.ts";
import { buildPath, compareKanji, type PathKanji, type PathWord } from "./path.ts";
import { NEWS_ONLY_PENALTY, NO_PRIORITY, parsePriorities, priorityScore } from "./priority.ts";

const kanji = (character: string, components: string[], extra: Partial<PathKanji> = {}): PathKanji => ({
  character,
  components,
  jlptOld: 4,
  freqRank: null,
  strokeCount: 4,
  ...extra,
});
const word = (id: string, written: string, kanji: string[], priority = 10): PathWord => ({ id, written, kanji, priority });
const keys = (path: { key: string }[]) => path.map((p) => p.key);

test("orders kanji by JLPT level, then frequency, then strokes", () => {
  const sorted = [
    kanji("A", [], { jlptOld: 1, freqRank: 1 }),
    kanji("B", [], { jlptOld: 4, freqRank: null }),
    kanji("C", [], { jlptOld: 4, freqRank: 50 }),
    kanji("D", [], { jlptOld: null, freqRank: 1 }),
    kanji("E", [], { jlptOld: 4, freqRank: 50, strokeCount: 2 }),
  ].sort(compareKanji);
  assert.deepEqual(sorted.map((k) => k.character), ["E", "C", "B", "A", "D"]);
});

test("components come before the kanji that need them, once each", () => {
  const path = buildPath(
    [kanji("木", ["木"], { freqRank: 1 }), kanji("林", ["木"], { freqRank: 2 }), kanji("休", ["化", "木"], { freqRank: 3 })],
    new Map([["木", 4], ["化", 2]]),
    [],
  );
  assert.deepEqual(keys(path), [
    "component:木",
    "kanji:木",
    "kanji:林",
    "component:化",
    "kanji:休",
  ]);
  assert.deepEqual(path[4].requires, ["component:化", "component:木"]);
});

test("words appear only after all their kanji, most frequent first", () => {
  const path = buildPath(
    [kanji("日", [], { freqRank: 1 }), kanji("本", [], { freqRank: 2 })],
    new Map(),
    [word("1", "日本", ["日", "本"], 5), word("2", "日", ["日"], 20), word("3", "本", ["本"], 1)],
  );
  assert.deepEqual(keys(path), ["kanji:日", "word:2", "kanji:本", "word:3", "word:1"]);
  assert.deepEqual(path.at(-1)!.requires, ["kanji:日", "kanji:本"]);
});

test("caps words per kanji and carries the rest to later slots", () => {
  const path = buildPath(
    [kanji("一", [], { freqRank: 1 }), kanji("二", [], { freqRank: 2 })],
    new Map(),
    [word("1", "一a", ["一"], 1), word("2", "一b", ["一"], 2), word("3", "一c", ["一"], 3)],
    2,
  );
  assert.deepEqual(keys(path), ["kanji:一", "word:1", "word:2", "kanji:二", "word:3"]);
});

test("words with kanji outside the path never appear", () => {
  const path = buildPath([kanji("日", [])], new Map(), [word("1", "日曜", ["日", "曜"])]);
  assert.deepEqual(keys(path), ["kanji:日"]);
});

test("stand-in components show the real radical", () => {
  assert.deepEqual(describeComponent("化", () => "change"), { display: "⺅", name: "person" });
  assert.deepEqual(describeComponent("木", () => "tree"), { display: "木", name: "tree" });
  assert.deepEqual(describeComponent("彳", () => "stop"), { display: "彳", name: "step" });
});

test("strips radical numbering from KANJIDIC names", () => {
  assert.equal(cleanName("short thread radical (no. 52)"), "short thread");
  assert.equal(cleanName("box-on-side enclosure radical (no. 22)"), "box-on-side enclosure");
  assert.equal(cleanName("tree"), "tree");
});

test("priority scores from JMdict tags", () => {
  assert.equal(priorityScore("nf01"), 1);
  assert.equal(priorityScore("nf48"), 48);
  assert.equal(priorityScore("ichi1"), 49);
  assert.equal(priorityScore("gai2"), 60);
  const xml = `
<entry><ent_seq>100</ent_seq><k_ele><keb>a</keb><ke_pri>ichi1</ke_pri><ke_pri>nf12</ke_pri></k_ele>
<r_ele><reb>b</reb><re_pri>nf03</re_pri></r_ele></entry>
<entry><ent_seq>200</ent_seq><r_ele><reb>c</reb></r_ele></entry>
<entry><ent_seq>300</ent_seq><k_ele><keb>d</keb><ke_pri>news1</ke_pri><ke_pri>nf09</ke_pri></k_ele></entry>`;
  assert.deepEqual(
    parsePriorities(xml),
    new Map([["100", 3], ["200", NO_PRIORITY], ["300", 9 + NEWS_ONLY_PENALTY]]),
  );
});
