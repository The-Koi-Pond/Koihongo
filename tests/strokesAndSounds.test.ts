import assert from "node:assert/strict";
import { test } from "node:test";
import { soundHint } from "../src/kanaSounds.ts";
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

test("vowel hints highlight the vowel", () => {
  assert.deepEqual(soundHint("u"), { asIn: ["p", "u", "t"] });
  assert.deepEqual(soundHint("ka").asIn, ["f", "a", "ther"]);
  assert.match(soundHint("ka").note!, /“k” as in English/);
  assert.deepEqual(soundHint("kya").asIn, ["f", "a", "ther"]);
});

test("special sounds get their own hints", () => {
  assert.deepEqual(soundHint("shi").asIn, ["", "she", ""]);
  assert.match(soundHint("tsu").note!, /cats/);
  assert.match(soundHint("fu").note!, /f.*h/);
  assert.match(soundHint("ri").note!, /tap/);
  assert.match(soundHint("n").note!, /nasal/);
  assert.match(soundHint("wo").note!, /お/);
});

test("stroke start points", () => {
  assert.deepEqual(strokeStart("M53.25,14.62c1,1.12,1.25,3"), [53.25, 14.62]);
  assert.deepEqual(strokeStart("M 26.5 31.25 c1,1"), [26.5, 31.25]);
  assert.equal(strokeStart("c1,1"), null);
});
