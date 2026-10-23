import assert from "node:assert/strict";
import { test } from "node:test";
import { japaneseName, NAME_NOTES, NAME_OVERRIDES, type KanjidicNames } from "./componentNames.ts";

// A tiny stand-in for KANJIDIC2: radical names and readings for a few characters.
const KANJIDIC: Record<string, KanjidicNames> = {
  囗: { radicalNames: ["くにがまえ"], kun: [], on: ["イ", "コク"] },
  冖: { radicalNames: ["わかんむり", "べきかんむり", "third name"], kun: [], on: ["ベキ"] },
  心: { radicalNames: ["りっしんべん"], kun: ["こころ", "-ごころ"], on: ["シン"] },
  氵: { radicalNames: ["みず"], kun: [], on: [] },
  日: { radicalNames: [], kun: ["ひ", "-び", "-か"], on: ["ニチ", "ジツ"] },
  大: { radicalNames: [], kun: ["おお-", "おお.きい"], on: ["ダイ", "タイ"] },
  化: { radicalNames: [], kun: ["ば.ける"], on: ["カ", "ケ"] },
};
const look = (ch: string) => KANJIDIC[ch];

test("component names: KANJIDIC's radical names, at most two", () => {
  assert.equal(japaneseName("囗", false, look), "くにがまえ");
  assert.equal(japaneseName("冖", false, look), "わかんむり / べきかんむり");
});

test("component names: overrides win where KANJIDIC names another form", () => {
  assert.equal(japaneseName("心", false, look), "こころ", "りっしんべん is the 忄 form");
  assert.equal(japaneseName("氵", true, look), "さんずい");
  assert.equal(japaneseName("⺅", true, look), "にんべん", "a shape KANJIDIC has no entry for");
});

test("component names: plain kanji go by a noun kun'yomi, else the on'yomi in hiragana", () => {
  assert.equal(japaneseName("日", false, look), "ひ");
  assert.equal(japaneseName("大", false, look), "だい", "おお- and おお.きい aren't nouns");
});

test("component names: none rather than a made-up one", () => {
  assert.equal(japaneseName("化", true, look), null, "a stand-in's own kanji says nothing about the part");
  assert.equal(japaneseName("マ", true, look), null);
  assert.equal(japaneseName("𠂉", true, look), null, "no KANJIDIC entry, no override");
});

test("component names: every note is for a part that has a name", () => {
  const unnamed = Object.keys(NAME_NOTES).filter((k) => NAME_OVERRIDES[k] === null);
  assert.deepEqual(unnamed, []);
});
