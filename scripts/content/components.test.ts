import assert from "node:assert/strict";
import { test } from "node:test";
import { partsOf } from "./components.ts";

test("parts: 口 isn't built from the 囗 enclosure, whatever KRADFILE says", () => {
  assert.deepEqual(partsOf("口", ["囗", "口"]), ["口"]);
  // 国 really does have the enclosure around it.
  assert.deepEqual(partsOf("国", ["王", "囗", "丶"]), ["王", "囗", "丶"]);
});
