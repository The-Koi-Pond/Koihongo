import assert from "node:assert/strict";
import { test } from "node:test";
import { allKana } from "../scripts/content/kana.ts";
import { HINTED, soundHint } from "../src/kanaSounds.ts";
import { strokePaths, strokeStart } from "../src/strokes.ts";

test("stroke paths come out in stroke order, with or without extra attributes", () => {
  const svg = `<svg>
    <path id="kvg:030a6-s2" d="M2"/>
    <path id="kvg:068ee-s10" kvg:type="㇐" d="M10"/>
    <path id="kvg:030a6-s1" d="M1"/>
    <path id="kvg:StrokePaths_x" d="ignored"/>
    <text>1</text></svg>`;
  assert.deepEqual(strokePaths(svg), ["M1", "M2", "M10"]);
  assert.deepEqual(strokePaths(""), []);
});

test("every kana sound has a hand-written one-line hint", () => {
  const missing = [...new Set(allKana().map((k) => k.romaji))].filter((r) => !HINTED.includes(r));
  assert.deepEqual(missing, []);
  for (const r of HINTED) {
    const h = soundHint(r);
    assert.ok(Boolean(h.word) !== Boolean(h.say), `${r}: needs exactly one of word or say`);
  }
});

test("hints highlight the whole syllable, with tips for tricky sounds", () => {
  assert.deepEqual(soundHint("ka").word, ["", "ca", "lm"]);
  assert.deepEqual(soundHint("kyo").word, ["To", "kyo", ""]);
  assert.equal(soundHint("kya").say, "kyah");
  assert.match(soundHint("tsu").tip!, /cats/);
  assert.match(soundHint("fu").tip!, /f and h/);
  assert.match(soundHint("ri").tip!, /tap/);
  assert.match(soundHint("n").tip!, /nasal/);
  assert.match(soundHint("wo").tip!, /お/);
});

test("stroke start points", () => {
  assert.deepEqual(strokeStart("M53.25,14.62c1,1.12,1.25,3"), [53.25, 14.62]);
  assert.deepEqual(strokeStart("M 26.5 31.25 c1,1"), [26.5, 31.25]);
  assert.equal(strokeStart("c1,1"), null);
});
