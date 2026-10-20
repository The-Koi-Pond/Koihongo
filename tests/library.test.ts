import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import { itemPreview, itemProgress, libraryItems } from "../src/library.ts";
import { recordReview, startLessons } from "../src/srs/progress.ts";
import { FIRST_REVIEW_DELAY_MS } from "../src/srs/scheduler.ts";
import { openTestDb } from "./nodeDb.ts";

const T0 = new Date("2026-03-02T10:00:00").getTime();

async function freshDb() {
  const db = openTestDb((content) =>
    content.exec(`
      INSERT INTO components VALUES ('木', '木', 'tree', 4), ('化', '⺅', 'person', 2);
      INSERT INTO kanji (character, meanings, on_readings, kun_readings, nanori, stroke_count)
        VALUES ('木', '["tree","wood"]', '["モク"]', '["き"]', '[]', 4), ('休', '["rest"]', '["キュウ"]', '["やす.む"]', '[]', 6);
      INSERT INTO words VALUES ('1', '休み', 'やすみ', '[]', '[{"pos":["n"],"glosses":["rest","holiday"],"misc":[],"info":[]}]', 5, 0);
      INSERT INTO path VALUES (1, 'component:木', 'component'), (2, 'kanji:木', 'kanji'),
        (3, 'component:化', 'component'), (4, 'kanji:休', 'kanji'), (5, 'word:1', 'word');
      INSERT INTO path_requirements VALUES ('kanji:木', 'component:木'),
        ('kanji:休', 'component:化'), ('kanji:休', 'component:木'), ('word:1', 'kanji:休');
    `),
  );
  await migrate(db);
  return db;
}

const statuses = async (db: Awaited<ReturnType<typeof freshDb>>) =>
  Object.fromEntries((await libraryItems(db)).map((i) => [i.item_key, i.status]));

test("a new learner sees components available and everything else locked", async () => {
  const db = await freshDb();
  assert.deepEqual(await statuses(db), {
    "component:木": "available",
    "kanji:木": "locked",
    "component:化": "available",
    "kanji:休": "locked",
    "word:1": "locked",
  });
});

test("statuses move through learning and passed, unlocking dependants", async () => {
  const db = await freshDb();
  await startLessons(db, [{ item_key: "component:木", kind: "component" }], T0);
  assert.equal((await statuses(db))["component:木"], "learning");

  let now = T0 + FIRST_REVIEW_DELAY_MS;
  for (let i = 0; i < 2; i++) {
    const card = await recordReview(db, "component:木", "meaning", true, "tree", now);
    now = card.due;
  }
  const s = await statuses(db);
  assert.equal(s["component:木"], "passed");
  assert.equal(s["kanji:木"], "available");
  assert.equal(s["kanji:休"], "locked", "still needs 化");
});

test("items carry labels, a meaning, and searchable text", async () => {
  const items = await libraryItems(await freshDb());
  const byKey = Object.fromEntries(items.map((i) => [i.item_key, i]));
  assert.equal(byKey["component:化"].label, "⺅");
  assert.equal(byKey["component:化"].meaning, "person");
  assert.equal(byKey["kanji:木"].meaning, "tree");
  assert.match(byKey["kanji:木"].search, /wood/);
  assert.match(byKey["kanji:木"].search, /モク|もく/);
  assert.match(byKey["word:1"].search, /holiday/);
  assert.match(byKey["word:1"].search, /やすみ/);
  assert.deepEqual(items.map((i) => i.position), [1, 2, 3, 4, 5]);
});

test("item progress lists requirements with their status", async () => {
  const p = await itemProgress(await freshDb(), "kanji:休");
  assert.equal(p.status, "locked");
  assert.deepEqual(p.cards, []);
  assert.deepEqual(
    p.requires.map((r) => [r.label, r.status]),
    [["木", "available"], ["⺅", "available"]],
  );
});

test("previews summarise kanji, words and components with status", async () => {
  const db = await freshDb();
  assert.deepEqual(await itemPreview(db, "kanji:木"), {
    item_key: "kanji:木",
    kind: "kanji",
    status: "locked",
    label: "木",
    meanings: ["tree", "wood"],
    readings: ["モク", "き"],
  });
  const word = await itemPreview(db, "word:1");
  assert.deepEqual([word.label, word.readings, word.meanings], ["休み", ["やすみ"], ["rest, holiday"]]);
  assert.deepEqual((await itemPreview(db, "component:化")).meanings, ["person"]);
});

test("previews work for kanji that aren't on the path", async () => {
  const db = openTestDb((content) =>
    content.exec(`INSERT INTO kanji (character, meanings, on_readings, kun_readings, nanori, stroke_count)
                  VALUES ('龍', '["dragon"]', '["リュウ"]', '["たつ"]', '[]', 16)`),
  );
  await migrate(db);
  const p = await itemPreview(db, "kanji:龍");
  assert.equal(p.status, null);
  assert.deepEqual(p.meanings, ["dragon"]);
});

test("item progress includes card details once started", async () => {
  const db = await freshDb();
  await startLessons(db, [{ item_key: "component:木", kind: "component" }], T0);
  const p = await itemProgress(db, "component:木");
  assert.equal(p.cards.length, 1);
  assert.equal(p.cards[0].due, T0 + FIRST_REVIEW_DELAY_MS);
  await assert.rejects(itemProgress(db, "kanji:龍"), /isn't on the path/);
});
