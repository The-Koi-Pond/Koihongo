import assert from "node:assert/strict";
import { test } from "node:test";
import { splitNotes } from "../src/gloss.ts";

test("splits parenthesised notes, nested ones as a single note", () => {
  assert.deepEqual(splitNotes("dog (Canis (lupus) familiaris)"), [
    { text: "dog ", note: false },
    { text: "(Canis (lupus) familiaris)", note: true },
  ]);
  assert.deepEqual(splitNotes("(the) day"), [
    { text: "(the)", note: true },
    { text: " day", note: false },
  ]);
  assert.deepEqual(splitNotes("forest"), [{ text: "forest", note: false }]);
  assert.deepEqual(splitNotes(""), []);
});

test("stray brackets don't break anything", () => {
  assert.deepEqual(splitNotes("a ) b"), [{ text: "a ) b", note: false }]);
  assert.deepEqual(splitNotes("x (unclosed"), [
    { text: "x ", note: false },
    { text: "(unclosed", note: true },
  ]);
});
