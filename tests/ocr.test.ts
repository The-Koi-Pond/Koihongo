import assert from "node:assert/strict";
import { test } from "node:test";
import { tidyRead, unmarked, type FoundText } from "../src/reading.ts";

const at = (x: number, y: number, w = 0.05, h = 0.1): FoundText => ({ x, y, w, h, in_bubble: true, score: 0.9 });

test("found text: what you've marked is left out, the rest in manga reading order", () => {
  const found = [at(0.1, 0.1), at(0.8, 0.1), at(0.5, 0.7), at(0.42, 0.42)];
  // A box you drew over the one at the top right.
  const marked = [{ x: 0.79, y: 0.09, w: 0.07, h: 0.12 }];
  assert.deepEqual(
    unmarked(found, marked).map((f) => [f.x, f.y]),
    [
      [0.1, 0.1],
      [0.42, 0.42],
      [0.5, 0.7],
    ],
  );
  // Same row: right to left.
  assert.deepEqual(unmarked([at(0.1, 0.1), at(0.6, 0.12)], []).map((f) => f.x), [0.6, 0.1]);
});

test("found text on a two-page spread: the right page first", () => {
  const found = [at(0.2, 0.05), at(0.7, 0.8), at(0.6, 0.1)];
  assert.deepEqual(unmarked(found, [], true).map((f) => f.x), [0.6, 0.7, 0.2]);
  assert.deepEqual(unmarked(found, [], false).map((f) => f.x), [0.6, 0.2, 0.7]);
});

test("read text: a run of dots becomes an ellipsis, a single one stays", () => {
  assert.equal(tidyRead("私は．．"), "私は…");
  assert.equal(tidyRead("邪魔者はもういないのだから..."), "邪魔者はもういないのだから…");
  assert.equal(tidyRead("え・・・？"), "え…？");
  assert.equal(tidyRead("セフィルノ・リリー。"), "セフィルノ・リリー。");
});
