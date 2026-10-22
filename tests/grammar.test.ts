import assert from "node:assert/strict";
import { test } from "node:test";
import { GRAMMAR, grammarPoint, markedParts, patternParts } from "../src/grammar/points.ts";

test("grammar: keys are unique and related points exist", () => {
  const keys = GRAMMAR.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const p of GRAMMAR) {
    for (const r of p.related) assert.ok(grammarPoint(r), `${p.key} links to missing ${r}`);
    assert.ok(!p.related.includes(p.key), `${p.key} links to itself`);
  }
});

test("grammar: every example highlights its grammar, with balanced braces", () => {
  for (const p of GRAMMAR) {
    assert.ok(p.examples.length > 0, `${p.key} has no examples`);
    for (const ex of p.examples) {
      const opens = [...ex.ja].filter((c) => c === "{").length;
      const closes = [...ex.ja].filter((c) => c === "}").length;
      assert.equal(opens, closes, `unbalanced braces in ${ex.ja}`);
      assert.ok(markedParts(ex.ja).some((part) => part.mark), `${ex.ja} highlights nothing`);
      // The reading, when given, must not carry markup.
      assert.ok(!ex.kana || !/[{}]/.test(ex.kana), `markup in the reading of ${ex.ja}`);
    }
  }
});

test("grammar: markup splits into highlighted and plain parts", () => {
  assert.deepEqual(markedParts("わたし{は}学生{です}。"), [
    { text: "わたし", mark: false },
    { text: "は", mark: true },
    { text: "学生", mark: false },
    { text: "です", mark: true },
    { text: "。", mark: false },
  ]);
  assert.deepEqual(patternParts("[Noun] は [Noun] です"), [
    { text: "Noun", slot: true },
    { text: "は", slot: false },
    { text: "Noun", slot: true },
    { text: "です", slot: false },
  ]);
});
