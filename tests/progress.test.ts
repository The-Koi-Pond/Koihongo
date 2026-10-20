import assert from "node:assert/strict";
import { test } from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { migrate, SCHEMA_VERSION } from "../src/db/migrations.ts";
import {
  availableLessons,
  dueCards,
  lessonAllowance,
  recordReview,
  startLessons,
  studyDayStart,
  todaySummary,
} from "../src/srs/progress.ts";
import { FIRST_REVIEW_DELAY_MS, PASS_STABILITY_DAYS } from "../src/srs/scheduler.ts";
import { NEW_PER_DAY, PAUSE_LESSONS_AT_DUE } from "../src/srs/settings.ts";
import { openTestDb } from "./nodeDb.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = new Date("2026-03-02T10:00:00").getTime(); // local time, mid-morning

// Tiny path: 木 component → 木 kanji; 化(⺅) + 木 components → 休 kanji → 休み word.
function fixture(content: DatabaseSync) {
  content.exec(`
    INSERT INTO components VALUES ('木', '木', 'tree', 4), ('化', '⺅', 'person', 2);
    INSERT INTO kanji (character, meanings, on_readings, kun_readings, nanori, stroke_count)
      VALUES ('木', '["tree"]', '["モク"]', '["き"]', '[]', 4), ('休', '["rest"]', '["キュウ"]', '["やす.む"]', '[]', 6);
    INSERT INTO words VALUES ('1', '休み', 'やすみ', '[]', '[]', 5, 0);
    INSERT INTO path VALUES (1, 'component:木', 'component'), (2, 'kanji:木', 'kanji'),
      (3, 'component:化', 'component'), (4, 'kanji:休', 'kanji'), (5, 'word:1', 'word');
    INSERT INTO path_requirements VALUES ('kanji:木', 'component:木'),
      ('kanji:休', 'component:化'), ('kanji:休', 'component:木'), ('word:1', 'kanji:休');
  `);
}

async function freshDb() {
  const db = openTestDb(fixture);
  await migrate(db);
  return db;
}

const keys = (lessons: { item_key: string }[]) => lessons.map((l) => l.item_key);

/** Answers every due review correctly until the item has passed. Returns the time it passed. */
async function passItem(db: Awaited<ReturnType<typeof freshDb>>, itemKey: string, from: number): Promise<number> {
  let now = from;
  for (let i = 0; i < 10; i++) {
    const cards = await db.all<{ card_type: "meaning" | "reading"; due: number; stability: number }>(
      "SELECT card_type, due, stability FROM srs_cards WHERE item_key = ?",
      [itemKey],
    );
    if (cards.every((c) => c.stability >= PASS_STABILITY_DAYS)) return now;
    now = Math.max(now, ...cards.map((c) => c.due));
    for (const c of cards) await recordReview(db, itemKey, c.card_type, true, "ok", now);
  }
  throw new Error(`${itemKey} never passed`);
}

test("migrations create the schema once and can run again safely", async () => {
  const db = await freshDb();
  await migrate(db);
  const [{ user_version }] = await db.all<{ user_version: number }>("PRAGMA user_version");
  assert.equal(user_version, SCHEMA_VERSION);
});

test("at the start only components are available, kanji are locked", async () => {
  const db = await freshDb();
  assert.deepEqual(keys(await availableLessons(db)), ["component:木", "component:化"]);
  const [first] = await availableLessons(db);
  assert.equal(first.label, "木");
});

test("lessons only come from the window ahead of the first unstarted item", async () => {
  const db = await freshDb();
  assert.deepEqual(keys(await availableLessons(db, 40, 2)), ["component:木"]);
});

test("a kanji unlocks only after its component has passed", async () => {
  const db = await freshDb();
  await startLessons(db, [{ item_key: "component:木", kind: "component" }], T0);
  assert.ok(!keys(await availableLessons(db)).includes("kanji:木"));

  // One correct review isn't enough to pass...
  await recordReview(db, "component:木", "meaning", true, "tree", T0 + FIRST_REVIEW_DELAY_MS);
  assert.ok(!keys(await availableLessons(db)).includes("kanji:木"));

  // ...a second one, days later, is.
  await passItem(db, "component:木", T0);
  assert.deepEqual(keys(await availableLessons(db)), ["kanji:木", "component:化"]);
});

test("a word needs its kanji passed, and a kanji needs all its components", async () => {
  const db = await freshDb();
  await startLessons(db, [{ item_key: "component:木", kind: "component" }, { item_key: "component:化", kind: "component" }], T0);
  await passItem(db, "component:木", T0);
  assert.ok(!keys(await availableLessons(db)).includes("kanji:休"), "化 not passed yet");

  const t = await passItem(db, "component:化", T0);
  assert.ok(keys(await availableLessons(db)).includes("kanji:休"));
  assert.ok(!keys(await availableLessons(db)).includes("word:1"));

  await startLessons(db, [{ item_key: "kanji:休", kind: "kanji" }], t);
  await passItem(db, "kanji:休", t);
  assert.ok(keys(await availableLessons(db)).includes("word:1"));
});

test("kanji get meaning and reading cards, components only meaning", async () => {
  const db = await freshDb();
  await startLessons(db, [{ item_key: "component:木", kind: "component" }, { item_key: "kanji:休", kind: "kanji" }], T0);
  const cards = await db.all<{ item_key: string; card_type: string }>(
    "SELECT item_key, card_type FROM srs_cards ORDER BY item_key, card_type",
  );
  assert.deepEqual(cards, [
    { item_key: "component:木", card_type: "meaning" },
    { item_key: "kanji:休", card_type: "meaning" },
    { item_key: "kanji:休", card_type: "reading" },
  ]);
});

test("first review is due a few hours after the lesson, not immediately", async () => {
  const db = await freshDb();
  await startLessons(db, [{ item_key: "component:木", kind: "component" }], T0);
  assert.equal((await dueCards(db, T0 + FIRST_REVIEW_DELAY_MS - 1)).length, 0);
  assert.equal((await dueCards(db, T0 + FIRST_REVIEW_DELAY_MS)).length, 1);
});

test("starting the same lesson twice changes nothing", async () => {
  const db = await freshDb();
  const lesson = { item_key: "component:木", kind: "component" as const };
  await startLessons(db, [lesson], T0);
  await startLessons(db, [lesson], T0 + DAY);
  const [card] = await db.all<{ started_at: number }>("SELECT started_at FROM srs_cards");
  assert.equal(card.started_at, T0);
});

test("a wrong answer brings the card back within about a day and is logged", async () => {
  const db = await freshDb();
  await startLessons(db, [{ item_key: "component:木", kind: "component" }], T0);
  const now = T0 + FIRST_REVIEW_DELAY_MS;
  const card = await recordReview(db, "component:木", "meaning", false, "wood", now);
  assert.ok(card.due > now && card.due <= now + 2 * DAY, `due in ${(card.due - now) / DAY} days`);
  const log = await db.all<{ rating: number; answer: string }>("SELECT rating, answer FROM review_log");
  assert.deepEqual(log, [{ rating: 1, answer: "wood" }]);
});

test("due cards come most-at-risk first", async () => {
  const db = await freshDb();
  await startLessons(db, [{ item_key: "component:木", kind: "component" }, { item_key: "component:化", kind: "component" }], T0);
  // 化 gets reviewed (so it's fresh in memory); 木 is still a never-reviewed card.
  await recordReview(db, "component:化", "meaning", true, "person", T0 + FIRST_REVIEW_DELAY_MS);
  const later = T0 + 30 * DAY;
  assert.deepEqual(keys(await dueCards(db, later)), ["component:木", "component:化"]);
});

test("reviewing a card that doesn't exist is an error", async () => {
  const db = await freshDb();
  await assert.rejects(recordReview(db, "kanji:木", "meaning", true, "tree", T0), /No review card/);
});

test("lesson allowance shrinks with the review backlog", () => {
  assert.equal(lessonAllowance(0, 0), NEW_PER_DAY);
  assert.equal(lessonAllowance(PAUSE_LESSONS_AT_DUE / 2, 0), Math.floor(NEW_PER_DAY / 2));
  assert.equal(lessonAllowance(PAUSE_LESSONS_AT_DUE / 2, NEW_PER_DAY), 0);
  assert.equal(lessonAllowance(PAUSE_LESSONS_AT_DUE * 3, 0), 0);
  assert.equal(lessonAllowance(0, NEW_PER_DAY + 5), 0);
});

test("the study day rolls over at 4 am", () => {
  const at = (s: string) => new Date(s).getTime();
  assert.equal(studyDayStart(at("2026-03-02T10:00:00")), at("2026-03-02T04:00:00"));
  assert.equal(studyDayStart(at("2026-03-03T02:30:00")), at("2026-03-02T04:00:00"));
  assert.equal(studyDayStart(at("2026-03-02T04:00:00")), at("2026-03-02T04:00:00"));
});

test("today summary counts due reviews and today's lessons", async () => {
  const db = await freshDb();
  const start = await todaySummary(db, T0);
  assert.equal(start.reviewsDue, 0);
  assert.deepEqual(keys(start.lessons), ["component:木", "component:化"]);

  await startLessons(db, [{ item_key: "component:木", kind: "component" }], T0);
  const after = await todaySummary(db, T0 + HOUR);
  assert.equal(after.lessonsDoneToday, 1);
  assert.equal(after.reviewsDue, 0);
  assert.equal(after.reviewsNext24h, 1);
  assert.deepEqual(keys(after.lessons), ["component:化"]);
});
