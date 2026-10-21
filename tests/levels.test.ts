import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import { kanaTally, levelStatus, levelUpToShow, markLevelSeen } from "../src/levels.ts";
import { PASS_STABILITY_DAYS } from "../src/srs/scheduler.ts";
import { openTestDb } from "./nodeDb.ts";

// Two N5 levels and one N4 level, two kanji each (one needed to clear), plus a
// component, a word, and two kana.
async function freshDb() {
  const db = openTestDb((content) =>
    content.exec(`
      INSERT INTO levels VALUES (1, 'N5', 1, 2, 1), (2, 'N5', 2, 2, 1), (3, 'N4', 1, 1, 1);
      INSERT INTO path (position, item_key, kind, track, level) VALUES
        (1, 'kana:あ', 'kana', 'kana', NULL), (2, 'kana:い', 'kana', 'kana', NULL),
        (3, 'component:木', 'component', 'main', 1),
        (4, 'kanji:木', 'kanji', 'main', 1), (5, 'kanji:林', 'kanji', 'main', 1), (6, 'word:1', 'word', 'main', 1),
        (7, 'kanji:森', 'kanji', 'main', 2), (8, 'kanji:休', 'kanji', 'main', 2),
        (9, 'kanji:体', 'kanji', 'main', 3), (10, 'kanji:本', 'kanji', 'main', 3);
    `),
  );
  await migrate(db);
  return db;
}

/** Gives an item a card that has passed, or one still being learned. */
async function card(db: Awaited<ReturnType<typeof freshDb>>, itemKey: string, passed: boolean) {
  await db.batch([
    {
      sql: `INSERT INTO srs_cards (item_key, card_type, state, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, started_at)
            VALUES (?, 'meaning', 2, 0, ?, 5, 1, 0, 1, 0, 0)`,
      params: [itemKey, passed ? PASS_STABILITY_DAYS : 0.5],
    },
  ]);
}

test("the current level is the first not cleared, with its items tallied", async () => {
  const db = await freshDb();
  let s = await levelStatus(db);
  assert.equal(s?.level, 1);
  assert.deepEqual(s?.kanji, { passed: 0, learning: 0, total: 2, needed: 1 });

  await card(db, "component:木", true);
  await card(db, "kanji:木", false);
  s = await levelStatus(db);
  assert.equal(s?.level, 1, "a kanji still learning doesn't clear the level");
  assert.deepEqual(s?.kanji, { passed: 0, learning: 1, total: 2, needed: 1 });
  assert.deepEqual(s?.components, { passed: 1, learning: 0, total: 1 });
  assert.deepEqual(s?.words, { passed: 0, learning: 0, total: 1 });

  await db.batch([{ sql: "UPDATE srs_cards SET stability = ? WHERE item_key = 'kanji:木'", params: [PASS_STABILITY_DAYS] }]);
  s = await levelStatus(db);
  assert.deepEqual([s?.level, s?.region, s?.regionLevel, s?.regionLevels, s?.complete], [2, "N5", 2, 2, false]);
});

test("after the last level, the status says every level is cleared", async () => {
  const db = await freshDb();
  for (const k of ["kanji:木", "kanji:森", "kanji:体"]) await card(db, k, true);
  const s = await levelStatus(db);
  assert.deepEqual([s?.level, s?.complete], [3, true]);
});

test("kana show until every kana has passed", async () => {
  const db = await freshDb();
  assert.deepEqual(await kanaTally(db), { passed: 0, learning: 0, total: 2 });
  await card(db, "kana:あ", true);
  await card(db, "kana:い", false);
  assert.deepEqual(await kanaTally(db), { passed: 1, learning: 1, total: 2 });
  await db.batch([{ sql: "UPDATE srs_cards SET stability = ?", params: [PASS_STABILITY_DAYS] }]);
  assert.equal(await kanaTally(db), null);
});

test("a level-up shows once, with the new region when one starts", async () => {
  const db = await freshDb();
  // The first time, the current level is just recorded.
  assert.equal(await levelUpToShow(db, 1), null);
  assert.equal(await levelUpToShow(db, 1), null);
  assert.deepEqual(await levelUpToShow(db, 2), { from: 1, to: 2, newRegion: undefined });
  await markLevelSeen(db, 2);
  assert.equal(await levelUpToShow(db, 2), null);
  assert.deepEqual(await levelUpToShow(db, 3), { from: 2, to: 3, newRegion: "N4" });
  // Going down (say, after restoring a backup) just records the lower level.
  assert.equal(await levelUpToShow(db, 1), null);
  assert.deepEqual(await levelUpToShow(db, 2), { from: 1, to: 2, newRegion: undefined });
});
