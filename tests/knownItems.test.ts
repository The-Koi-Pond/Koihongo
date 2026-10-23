import assert from "node:assert/strict";
import { test } from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { migrate } from "../src/db/migrations.ts";
import { isFastTracked } from "../src/srs/fastTrack.ts";
import { dueCards, kanaGroups, recordReview, startAsKnown, startLessons, todaySummary } from "../src/srs/progress.ts";
import { FIRST_REVIEW_DELAY_MS, PASS_STABILITY_DAYS } from "../src/srs/scheduler.ts";
import { DEFAULT_PACING, savePacing } from "../src/srs/settings.ts";
import { openTestDb } from "./nodeDb.ts";

const T0 = new Date("2026-03-02T10:00:00").getTime();

// Three basic hiragana, one with a ゛, and two basic katakana, on the kana track.
function fixture(content: DatabaseSync) {
  content.exec(`
    INSERT INTO kana (character, romaji, accept, script, grp) VALUES
      ('あ', 'a', '[]', 'hiragana', 'basic'), ('い', 'i', '[]', 'hiragana', 'basic'), ('う', 'u', '[]', 'hiragana', 'basic'),
      ('が', 'ga', '[]', 'hiragana', 'dakuten'), ('ア', 'a', '[]', 'katakana', 'basic'), ('イ', 'i', '[]', 'katakana', 'basic');
    INSERT INTO path (position, item_key, kind, track) VALUES
      (1, 'kana:あ', 'kana', 'kana'), (2, 'kana:い', 'kana', 'kana'), (3, 'kana:う', 'kana', 'kana'),
      (4, 'kana:が', 'kana', 'kana'), (5, 'kana:ア', 'kana', 'kana'), (6, 'kana:イ', 'kana', 'kana');
  `);
}

async function setup() {
  const db = openTestDb(fixture);
  await migrate(db);
  return db;
}

test("kana groups: by script and set, in path order, with what's not started", async () => {
  const db = await setup();
  await startLessons(db, [{ item_key: "kana:あ", kind: "kana" }], T0);
  const groups = await kanaGroups(db);
  assert.deepEqual(
    groups.map((g) => [g.script, g.group, g.total, g.notStarted]),
    [
      ["hiragana", "basic", 3, ["kana:い", "kana:う"]],
      ["hiragana", "dakuten", 1, ["kana:が"]],
      ["katakana", "basic", 2, ["kana:ア", "kana:イ"]],
    ],
  );
});

test("start as known: fast-tracked cards, first review later, one right answer passes", async () => {
  const db = await setup();
  await startAsKnown(db, [{ item_key: "kana:あ", kind: "kana" }, { item_key: "kana:い", kind: "kana" }], T0);
  assert.ok(await isFastTracked(db, "kana:あ"));
  assert.equal((await dueCards(db, T0)).length, 0, "not due straight away");
  const due = await dueCards(db, T0 + FIRST_REVIEW_DELAY_MS);
  assert.equal(due.length, 2);
  const card = await recordReview(db, "kana:あ", "reading", true, "a", T0 + FIRST_REVIEW_DELAY_MS);
  assert.ok(card.stability >= PASS_STABILITY_DAYS, "passes on its first review");
});

test("start as known: skips the daily kana limit, and isn't offered as a lesson again", async () => {
  const db = await setup();
  const before = await todaySummary(db, T0);
  assert.equal(before.lessons.length, 6);
  const all = before.lessons.map((l) => ({ item_key: l.item_key, kind: l.kind }));
  await startAsKnown(db, all, T0);
  assert.equal((await todaySummary(db, T0)).lessons.length, 0);
  assert.deepEqual(
    (await kanaGroups(db)).map((g) => g.notStarted.length),
    [0, 0, 0],
  );
  // Starting them again changes nothing.
  await startAsKnown(db, all, T0 + 1000);
  assert.equal((await db.all("SELECT * FROM srs_cards")).length, 6);
});

test("start as known: doesn't use up today's lessons, nor slow them down before its first review", async () => {
  const db = await setup();
  await savePacing(db, { ...DEFAULT_PACING, kanaPerDay: 2 });
  assert.equal((await todaySummary(db, T0)).lessons.length, 2, "two kana lessons a day");
  // Mark three as known: two lessons are still on offer today.
  await startAsKnown(db, ["kana:あ", "kana:い", "kana:う"].map((item_key) => ({ item_key, kind: "kana" as const })), T0);
  const after = await todaySummary(db, T0);
  assert.deepEqual(after.lessons.map((l) => l.item_key), ["kana:が", "kana:ア"]);
  // A real lesson still counts.
  await startLessons(db, [{ item_key: "kana:が", kind: "kana" }], T0);
  assert.equal((await todaySummary(db, T0)).lessons.length, 1);
  // Once due, the known cards wait for review without throttling lessons.
  const due = await todaySummary(db, T0 + FIRST_REVIEW_DELAY_MS);
  assert.equal(due.reviewsDue, 4);
});

test("start as known is one transaction: flags and cards together", async () => {
  const db = await setup();
  await startAsKnown(db, [{ item_key: "kana:あ", kind: "kana" }], T0);
  const [{ known }] = await db.all<{ known: number }>("SELECT started_known AS known FROM srs_cards WHERE item_key = 'kana:あ'");
  assert.equal(known, 1);
  assert.ok(await isFastTracked(db, "kana:あ"));
});
