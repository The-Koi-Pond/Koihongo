import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMark, CHART } from "../src/kanaKeys.ts";

test("kana keyboard: ゛ voices a kana and toggles back", () => {
  assert.equal(applyMark("か", "dakuten"), "が");
  assert.equal(applyMark("が", "dakuten"), "か");
  assert.equal(applyMark("つ", "dakuten"), "づ");
  assert.equal(applyMark("う", "dakuten"), "ゔ");
  assert.equal(applyMark("ぱ", "dakuten"), "ば");
  assert.equal(applyMark("あ", "dakuten"), null);
});

test("kana keyboard: ゜ only for the は row, and it swaps with ゛", () => {
  assert.equal(applyMark("は", "handakuten"), "ぱ");
  assert.equal(applyMark("ば", "handakuten"), "ぱ");
  assert.equal(applyMark("ぱ", "handakuten"), "は");
  assert.equal(applyMark("か", "handakuten"), null);
});

test("kana keyboard: 小 makes small kana and back", () => {
  assert.equal(applyMark("つ", "small"), "っ");
  assert.equal(applyMark("っ", "small"), "つ");
  assert.equal(applyMark("よ", "small"), "ょ");
  assert.equal(applyMark("か", "small"), null);
});

test("kana keyboard: katakana stays katakana", () => {
  assert.equal(applyMark("カ", "dakuten"), "ガ");
  assert.equal(applyMark("ハ", "handakuten"), "パ");
  assert.equal(applyMark("ツ", "small"), "ッ");
  assert.equal(applyMark("ウ", "dakuten"), "ヴ");
  assert.equal(applyMark("ヴ", "dakuten"), "ウ");
});

test("kana keyboard: the chart has all 46 basic kana plus ー", () => {
  const keys = CHART.flat().filter(Boolean);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.length, 47);
});
