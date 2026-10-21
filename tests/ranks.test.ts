import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import { setFastTrack } from "../src/srs/fastTrack.ts";
import { rankFor, rankTally, rankUpFor } from "../src/srs/ranks.ts";
import { PASS_STABILITY_DAYS } from "../src/srs/scheduler.ts";
import { openTestDb } from "./nodeDb.ts";

const DAY = 86_400_000;

test("ranks follow memory strength: B from passing, then A, S and ★", () => {
  assert.equal(rankFor(null), null);
  assert.equal(rankFor(1), null);
  assert.equal(rankFor(PASS_STABILITY_DAYS), "B");
  assert.equal(rankFor(29), "B");
  assert.equal(rankFor(30), "A");
  assert.equal(rankFor(180), "S");
  assert.equal(rankFor(730), "★");
});

async function dbWithCards(cards: { type: "meaning" | "reading"; stability: number; due: number }[]) {
  const db = openTestDb(() => {});
  await migrate(db);
  await db.batch(
    cards.map((c) => ({
      sql: `INSERT INTO srs_cards (item_key, card_type, state, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, last_review, started_at)
            VALUES ('kanji:木', ?, 2, ?, ?, 5, ?, 0, 3, 0, ?, 0)`,
      params: [c.type, c.due, c.stability, Math.round(c.stability), c.due - Math.round(c.stability) * DAY],
    })),
  );
  return db;
}

test("a right answer that strengthens the weaker card is a rank-up; a wrong one never is", async () => {
  const now = 100 * DAY;
  // Meaning is strong (S); reading sits just below A and is due now, so it limits the item to B.
  const db = await dbWithCards([
    { type: "meaning", stability: 200, due: now + 100 * DAY },
    { type: "reading", stability: 25, due: now },
  ]);
  assert.deepEqual(await rankUpFor(db, "kanji:木", "reading", true, now), { from: "B", to: "A" });
  assert.equal(await rankUpFor(db, "kanji:木", "reading", false, now), null, "forgetting drops quietly");
  assert.equal(await rankUpFor(db, "kanji:木", "meaning", true, now + 100 * DAY), null, "the weaker card still limits the rank");
  assert.deepEqual(await rankTally(db), { B: 1, A: 0, S: 0, "★": 0 });
});

test("items still being learned have no rank", async () => {
  const db = await dbWithCards([{ type: "meaning", stability: 0.5, due: 0 }]);
  assert.deepEqual(await rankTally(db), { B: 0, A: 0, S: 0, "★": 0 });
});

test("on fast track, the rank-up prediction uses Easy too", async () => {
  const now = 100 * DAY;
  // Stability 6 and due: Good lands at ~20 days (still B), Easy at ~33 (A).
  const db = await dbWithCards([{ type: "meaning", stability: 6, due: now }]);
  assert.equal(await rankUpFor(db, "kanji:木", "meaning", true, now), null);
  await setFastTrack(db, "kanji:木", true, now);
  assert.deepEqual(await rankUpFor(db, "kanji:木", "meaning", true, now), { from: "B", to: "A" });
});
