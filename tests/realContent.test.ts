// Checks the real content.db (skipped if it hasn't been built): every item on
// the path loads, and its obvious answers are accepted by the answer checker.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import { acceptedAnswers, getItemDetails } from "../src/items.ts";
import { checkKana, checkMeaning, checkReading, readingKeys } from "../src/srs/answers.ts";
import { availableLessons } from "../src/srs/progress.ts";
import { openDbWithContent } from "./nodeDb.ts";

const CONTENT = join(import.meta.dirname, "..", "src-tauri", "resources", "content.db");

test("every path item loads and accepts its own answers", { skip: !existsSync(CONTENT) && "content.db not built" }, async () => {
  const db = openDbWithContent(CONTENT);
  await migrate(db);
  const path = await db.all<{ item_key: string; kind: string }>("SELECT item_key, kind FROM content.path ORDER BY position");
  const failures: string[] = [];

  for (const { item_key, kind } of path) {
    const item = await getItemDetails(db, item_key);
    const { meanings, readings } = acceptedAnswers(item);
    if (item.kind === "kana") {
      for (const r of readings) {
        if (checkKana(r, item.character, item.romaji, item.accept).result !== "correct") failures.push(`${item_key}: "${r}" not accepted`);
      }
      if (!item.strokeSvg !== ([...item.character].length > 1)) failures.push(`${item_key}: stroke order should exist only for single kana`);
      continue;
    }
    if (meanings.length === 0 || checkMeaning(meanings[0], meanings, readings).result !== "correct") {
      failures.push(`${item_key}: meaning "${meanings[0]}" not accepted`);
    }
    if (kind === "component") continue;
    if (readings.length === 0) failures.push(`${item_key}: no readings`);
    for (const r of readings.flatMap(readingKeys)) {
      if (checkReading(r, readings).result !== "correct") failures.push(`${item_key}: reading "${r}" not accepted`);
    }
  }
  assert.deepEqual(failures.slice(0, 20), [], `${failures.length} problems`);
  assert.ok(path.length > 7000);
});

test("a brand-new learner starts with あ on the kana track and components on the main track", { skip: !existsSync(CONTENT) && "content.db not built" }, async () => {
  const db = openDbWithContent(CONTENT);
  await migrate(db);
  const lessons = await availableLessons(db);
  const kana = lessons.filter((l) => l.track === "kana");
  const main = lessons.filter((l) => l.track === "main");
  assert.deepEqual(kana.slice(0, 5).map((l) => l.label), ["あ", "い", "う", "え", "お"]);
  assert.ok(main.length > 0 && main.every((l) => l.kind === "component"));
});
