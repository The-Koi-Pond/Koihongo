import assert from "node:assert/strict";
import { test } from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { migrate, SCHEMA_VERSION } from "../src/db/migrations.ts";
import {
  availableLessons,
  reviewForecast,
  dueCards,
  catchUpPlan,
  lessonAllowance,
  recordReview,
  startLessons,
  studyDayStart,
  todaySummary,
} from "../src/srs/progress.ts";
import { FIRST_REVIEW_DELAY_MS, PASS_STABILITY_DAYS } from "../src/srs/scheduler.ts";
import { DEFAULT_PACING, loadPacing, savePacing } from "../src/srs/settings.ts";
import { isFastTracked, setFastTrack } from "../src/srs/fastTrack.ts";

const { newPerDay: NEW_PER_DAY, pauseLessonsAtDue: PAUSE_LESSONS_AT_DUE } = DEFAULT_PACING;
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
    INSERT INTO path (position, item_key, kind) VALUES (1, 'component:木', 'component'), (2, 'kanji:木', 'kanji'),
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

test("forecast buckets upcoming reviews by hour and summary knows the next one", async () => {
  const db = await freshDb();
  assert.deepEqual(await reviewForecast(db, T0, 3), [0, 0, 0]);
  assert.equal((await todaySummary(db, T0)).nextReviewAt, null);

  await startLessons(db, [{ item_key: "component:木", kind: "component" }, { item_key: "component:化", kind: "component" }], T0);
  // Both first reviews land FIRST_REVIEW_DELAY_MS (4h) after the lesson.
  const forecast = await reviewForecast(db, T0, 6);
  assert.deepEqual(forecast, [0, 0, 0, 0, 2, 0], "exactly 4h away = the 4–5h bucket");
  assert.equal((await todaySummary(db, T0)).nextReviewAt, T0 + FIRST_REVIEW_DELAY_MS);
  // Once due, they leave the forecast (they're counted as due instead).
  assert.deepEqual(await reviewForecast(db, T0 + FIRST_REVIEW_DELAY_MS, 6), [0, 0, 0, 0, 0, 0]);
});

test("pacing: defaults until you save your own; invalid numbers are refused", async () => {
  const db = await freshDb();
  assert.deepEqual(await loadPacing(db), DEFAULT_PACING);
  const mine = { newPerDay: 1, kanaPerDay: 5, pauseLessonsAtDue: 50, catchUpPerDay: 60, dayStartsAtHour: 6 };
  await savePacing(db, mine);
  assert.deepEqual(await loadPacing(db), mine);
  await assert.rejects(savePacing(db, { ...mine, newPerDay: 2.5 }), /newPerDay/);
  await assert.rejects(savePacing(db, { ...mine, dayStartsAtHour: 13 }), /dayStartsAtHour/);
  assert.deepEqual(await loadPacing(db), mine, "a refused save changes nothing");
  // A stored value that's out of range (say, edited by hand) falls back to the default.
  await db.batch([{ sql: "UPDATE settings SET value = '-3' WHERE key = 'pacing.kanaPerDay'" }]);
  assert.equal((await loadPacing(db)).kanaPerDay, DEFAULT_PACING.kanaPerDay);
});

test("today summary uses your pacing", async () => {
  const db = await freshDb();
  await savePacing(db, { ...DEFAULT_PACING, newPerDay: 1 });
  const s = await todaySummary(db, T0);
  assert.deepEqual(keys(s.lessons), ["component:木"]);
  assert.equal(s.lessonsWaiting, 1);
  assert.equal(s.pacing.newPerDay, 1);
});

test("catch-up: a pile bigger than today's share is spread over days", () => {
  assert.equal(catchUpPlan(80, 0, 150), null, "a normal day: everything due fits");
  assert.deepEqual(catchUpPlan(400, 0, 150), { todayLeft: 150, waiting: 250, moreDays: 2 });
  assert.deepEqual(catchUpPlan(400, 100, 150), { todayLeft: 50, waiting: 350, moreDays: 3 });
  assert.deepEqual(catchUpPlan(10, 150, 150), { todayLeft: 0, waiting: 10, moreDays: 1 }, "share done: the rest waits");
});

test("today summary offers only today's catch-up share", async () => {
  const db = await freshDb();
  await savePacing(db, { ...DEFAULT_PACING, catchUpPerDay: 30 });
  // 40 due cards, all overdue (fake items: only the counts matter here).
  await db.batch(
    Array.from({ length: 40 }, (_, i) => ({
      sql: `INSERT INTO srs_cards (item_key, card_type, state, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, started_at)
            VALUES (?, 'meaning', 2, ?, 5, 5, 1, 0, 1, 0, 0)`,
      params: [`kanji:x${i}`, T0 - DAY],
    })),
  );
  const s = await todaySummary(db, T0);
  assert.equal(s.reviewsDue, 40);
  assert.equal(s.reviewsToday, 30);
  assert.deepEqual(s.catchUp, { todayLeft: 30, waiting: 10, moreDays: 1 });
});

test("fast track: right answers count as Easy, so an item passes on its first review; a miss ends it", async () => {
  const db = await freshDb();
  await startLessons(db, [{ item_key: "component:木", kind: "component" }, { item_key: "component:化", kind: "component" }], T0);
  await setFastTrack(db, "component:木", true, T0);
  const due = T0 + FIRST_REVIEW_DELAY_MS;

  const fast = await recordReview(db, "component:木", "meaning", true, "tree", due);
  const normal = await recordReview(db, "component:化", "meaning", true, "person", due);
  assert.ok(fast.stability >= PASS_STABILITY_DAYS, `fast-tracked item passes at once (${fast.stability})`);
  assert.ok(normal.stability < PASS_STABILITY_DAYS, "a normal item needs another review");
  const [log] = await db.all<{ rating: number }>("SELECT rating FROM review_log WHERE item_key = 'component:木'");
  assert.equal(log.rating, 4, "logged as Easy");

  await recordReview(db, "component:木", "meaning", false, "wood", fast.due);
  assert.equal(await isFastTracked(db, "component:木"), false, "one miss takes it off fast track");
});
