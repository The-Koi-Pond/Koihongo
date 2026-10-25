import assert from "node:assert/strict";
import { test } from "node:test";
import { allKana, kanaTrack, pickExample, type ExampleCandidate } from "./kana.ts";

const kana = allKana();
const by = (c: string) => kana.find((k) => k.character === c)!;
const track = kanaTrack();
const rules = kana.filter((k) => k.examples);

test("covers hiragana, katakana and extended katakana once each, plus 7 rules", () => {
  const count = (script: string, group?: string) => kana.filter((k) => k.script === script && !k.examples && (!group || k.group === group)).length;
  assert.equal(count("hiragana", "basic"), 46);
  assert.equal(count("hiragana", "dakuten"), 25);
  assert.equal(count("hiragana", "combo"), 33);
  assert.equal(count("katakana"), 104 + 16);
  assert.deepEqual(
    rules.map((r) => r.character),
    ["か→が", "は→ぱ", "き→きゃ", "カ→ガ", "ハ→パ", "キ→キャ", "フ→ファ"],
  );
  assert.equal(new Set(kana.map((k) => k.character)).size, kana.length);
});

test("rules cover every kana that isn't basic, once", () => {
  const covered = rules.flatMap((r) => r.examples!);
  assert.equal(new Set(covered).size, covered.length);
  assert.deepEqual(
    covered.toSorted(),
    kana.filter((k) => k.group !== "basic" && !k.examples).map((k) => k.character).toSorted(),
  );
  assert.equal(by("か→が").examples!.length, 20);
  assert.deepEqual(by("は→ぱ").examples, ["ぱ", "ぴ", "ぷ", "ぺ", "ぽ"]);
  assert.ok(by("キ→キャ").examples!.includes("ジョ"));
  assert.equal(by("か→が").counterpart, "カ→ガ");
});

test("the track: basic kana a row per round, then the rules; nothing else", () => {
  const rounds = new Map<number, string[]>();
  for (const t of track) rounds.set(t.round, [...(rounds.get(t.round) ?? []), t.character]);
  const row = (n: number) => rounds.get(n)!.join("");
  assert.equal(row(1), "あいうえお");
  assert.equal(row(9), "やゆよわをん", "や ゆ よ join わ を ん: no round is split");
  assert.equal(row(10), "か→がは→ぱ", "゛ and ゜ together");
  assert.equal(row(11), "き→きゃ");
  assert.equal(row(12), "アイウエオ");
  assert.equal(track.at(-1)!.character, "フ→ファ");
  assert.equal(track.length, 92 + 7);
  for (const r of rounds.values()) assert.ok(r.length <= 6);
});

test("rules wait for their kana; every requirement is earlier on the track", () => {
  const at = new Map(track.map((t, i) => [t.character, i]));
  const req = (c: string) => track.find((t) => t.character === c)!.requires;
  assert.ok(req("か→が").includes("ほ"));
  assert.deepEqual(req("か→が"), req("は→ぱ"), "taught together, so they unlock together");
  assert.ok(req("き→きゃ").includes("か→が") && req("き→きゃ").includes("り"));
  assert.ok(req("フ→ファ").includes("カ→ガ"), "ディ, ジェ and ヴ use ゛");
  assert.deepEqual(req("あ"), []);
  for (const t of track) for (const r of t.requires) assert.ok(at.get(r)! < at.get(t.character)!, `${t.character} needs ${r}, which comes later or is missing`);
});

test("Hepburn romaji, with extras for kana people type differently", () => {
  assert.equal(by("し").romaji, "shi");
  assert.equal(by("つ").romaji, "tsu");
  assert.equal(by("ふ").romaji, "fu");
  assert.equal(by("ぢ").romaji, "ji");
  assert.deepEqual(by("を").accept, ["o"]);
  assert.deepEqual(by("ヲ").accept, ["o"]);
  assert.deepEqual(by("ん").accept, ["nn"]);
  assert.equal(by("しゃ").romaji, "sha");
  assert.equal(by("ファ").romaji, "fa");
  assert.equal(by("ティ").romaji, "ti");
});

test("counterparts link the scripts", () => {
  assert.equal(by("あ").counterpart, "ア");
  assert.equal(by("ア").counterpart, "あ");
  assert.equal(by("ギャ").counterpart, "ぎゃ");
  assert.equal(by("ファ").counterpart, null);
});

test("example words: frequent nouns starting with the sound, not with a combination", () => {
  const w = (id: string, written: string, reading: string, priority: number, isNoun = true): ExampleCandidate => ({ id, written, reading, otherForms: [], priority, isNoun });
  const words = [
    w("1", "今日", "きょう", 1), // starts with きょ, not き
    w("2", "木", "き", 2), // the kana alone is too short to be an example
    w("3", "季節", "きせつ", 5),
    w("4", "聞く", "きく", 3, false), // verb: ranked after nouns
    w("5", "ウナギ", "うなぎ", 9),
    w("6", "歌", "うた", 4),
  ];
  assert.equal(pickExample(by("き"), words)?.word.id, "3");
  assert.equal(pickExample(by("きょ"), words)?.word.id, "1", "the combination gets the きょ word");
  assert.equal(pickExample(by("う"), words)?.word.id, "6");
  assert.equal(pickExample(by("ウ"), words)?.word.id, "5", "katakana wants a katakana word");
  assert.equal(pickExample(by("ん"), words), null);
});

test("hand-picked examples match alternative spellings and show the picked spelling", () => {
  const eel: ExampleCandidate = { id: "9", written: "鰻", reading: "うなぎ", otherForms: ["ウナギ"], priority: 49, isNoun: true };
  assert.deepEqual(pickExample(by("ウ"), [eel]), { word: eel, form: "ウナギ" });
  const digits: ExampleCandidate = { id: "8", written: "６月", reading: "ろくがつ", otherForms: [], priority: 1, isNoun: true };
  assert.equal(pickExample(by("ぷ"), [digits]), null);
});
