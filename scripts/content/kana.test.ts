import assert from "node:assert/strict";
import { test } from "node:test";
import { allKana } from "./kana.ts";

const kana = allKana();
const by = (c: string) => kana.find((k) => k.character === c)!;

test("covers hiragana, katakana and extended katakana once each", () => {
  const count = (script: string, group?: string) => kana.filter((k) => k.script === script && (!group || k.group === group)).length;
  assert.equal(count("hiragana", "basic"), 46);
  assert.equal(count("hiragana", "dakuten"), 25);
  assert.equal(count("hiragana", "combo"), 33);
  assert.equal(count("katakana"), 104 + 16);
  assert.equal(new Set(kana.map((k) => k.character)).size, kana.length);
});

test("teaching order: basic hiragana first, then dakuten, combos, katakana, extended", () => {
  assert.deepEqual(kana.slice(0, 5).map((k) => k.character), ["あ", "い", "う", "え", "お"]);
  assert.equal(kana[46].character, "が");
  assert.equal(kana[71].character, "きゃ");
  assert.equal(kana[104].character, "ア");
  assert.equal(kana.at(-1)!.character, "ツァ");
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

test("dakuten and combos require their plain kana; counterparts link the scripts", () => {
  assert.deepEqual(by("が").requires, ["か"]);
  assert.deepEqual(by("ぱ").requires, ["は"]);
  assert.deepEqual(by("ぢ").requires, ["ち"]);
  assert.deepEqual(by("ぎゃ").requires, ["ぎ"]);
  assert.deepEqual(by("ガ").requires, ["カ"]);
  assert.deepEqual(by("ファ").requires, ["フ"]);
  assert.deepEqual(by("あ").requires, []);
  assert.equal(by("あ").counterpart, "ア");
  assert.equal(by("ア").counterpart, "あ");
  assert.equal(by("ファ").counterpart, null);
  // Every requirement is itself a kana item.
  for (const k of kana) for (const r of k.requires) assert.ok(by(r), `${k.character} needs missing ${r}`);
});
