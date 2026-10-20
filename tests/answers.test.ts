import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMeaning, checkReading, editDistance, meaningKey, readingKeys } from "../src/srs/answers.ts";

test("meaning keys ignore case, notes, punctuation and leading to/the", () => {
  assert.equal(meaningKey("To Meet"), "meet");
  assert.equal(meaningKey("president (of a society)"), "president");
  assert.equal(meaningKey("one-by-one"), "one by one");
  assert.equal(meaningKey("Japan's best!"), "japan's best");
  assert.equal(meaningKey("  the   Big Dipper "), "big dipper");
});

test("meanings: exact, typo-tolerant, and wrong", () => {
  const meanings = ["forest", "woods"];
  assert.deepEqual(checkMeaning("Forest", meanings, []), { result: "correct", typo: false });
  assert.deepEqual(checkMeaning("forrest", meanings, []), { result: "correct", typo: true });
  assert.deepEqual(checkMeaning("tree", meanings, []), { result: "wrong" });
});

test("short meanings allow no typos", () => {
  assert.deepEqual(checkMeaning("dar", ["day"], []), { result: "wrong" });
  assert.deepEqual(checkMeaning("day", ["day"], []), { result: "correct", typo: false });
});

test("verbs work with or without 'to'", () => {
  assert.deepEqual(checkMeaning("meet", ["to meet"], []), { result: "correct", typo: false });
  assert.deepEqual(checkMeaning("to meet", ["to meet"], []), { result: "correct", typo: false });
});

test("typing the reading for a meaning question asks again instead of failing", () => {
  const v = checkMeaning("mori", ["forest"], ["シン", "もり"]);
  assert.equal(v.result, "retry");
  assert.deepEqual(checkMeaning("", ["forest"], []).result, "retry");
});

test("reading keys strip markers and accept okurigana stems", () => {
  assert.deepEqual(readingKeys("た.べる"), ["たべる", "た"]);
  assert.deepEqual(readingKeys("-び"), ["び"]);
  assert.deepEqual(readingKeys("ショク"), ["しょく"]);
  assert.deepEqual(readingKeys("なま-"), ["なま"]);
});

test("readings: kana, romaji, katakana all compare as hiragana; no typo tolerance", () => {
  const readings = ["ショク", "た.べる"];
  assert.deepEqual(checkReading("しょく", readings), { result: "correct", typo: false });
  assert.deepEqual(checkReading("shoku", readings), { result: "correct", typo: false });
  assert.deepEqual(checkReading("ショク", readings), { result: "correct", typo: false });
  assert.deepEqual(checkReading("たべる", readings), { result: "correct", typo: false });
  assert.deepEqual(checkReading("しょっく", readings), { result: "wrong" });
});

test("trailing n becomes ん on submit", () => {
  assert.deepEqual(checkReading("nin", ["ニン"]), { result: "correct", typo: false });
});

test("non-kana reading answers ask again", () => {
  assert.equal(checkReading("forest", ["もり"]).result, "retry");
  assert.equal(checkReading("  ", ["もり"]).result, "retry");
});

test("edit distance", () => {
  assert.equal(editDistance("forest", "forrest"), 1);
  assert.equal(editDistance("", "abc"), 3);
  assert.equal(editDistance("kitten", "sitting"), 3);
});
