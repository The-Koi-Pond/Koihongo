import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate, SCHEMA_VERSION } from "../src/db/migrations.ts";
import { acceptedAnswers, getItemDetails } from "../src/items.ts";
import { itemPreview, libraryItems } from "../src/library.ts";
import { checkKana } from "../src/srs/answers.ts";
import {
  availableLessons,
  cardTypesFor,
  finishRound,
  firstRound,
  isKanaRule,
  lessonAllowance,
  startLessons,
  todaySummary,
  type Lesson,
} from "../src/srs/progress.ts";
import { DEFAULT_PACING } from "../src/srs/settings.ts";

const { kanaPerDay: KANA_PER_DAY, newPerDay: NEW_PER_DAY } = DEFAULT_PACING;
import { openTestDb } from "./nodeDb.ts";

const T0 = new Date("2026-03-02T10:00:00").getTime();

// Kana track: あ い か が(needs か). Main track: 木 component → 木 kanji.
async function freshDb() {
  const db = openTestDb((content) =>
    content.exec(`
      INSERT INTO kana (character, romaji, accept, script, grp, counterpart, stroke_svg) VALUES ('あ', 'a', '[]', 'hiragana', 'basic', 'ア', '<svg/>'), ('い', 'i', '[]', 'hiragana', 'basic', 'イ', NULL),
        ('か', 'ka', '[]', 'hiragana', 'basic', 'カ', NULL), ('が', 'ga', '[]', 'hiragana', 'dakuten', 'ガ', NULL),
        ('を', 'wo', '["o"]', 'hiragana', 'basic', 'ヲ', NULL);
      INSERT INTO components (glyph, display, name, stroke_count) VALUES ('木', '木', 'tree', 4);
      INSERT INTO kanji (character, meanings, on_readings, kun_readings, nanori, stroke_count) VALUES ('木', '["tree"]', '["モク"]', '["き"]', '[]', 4);
      INSERT INTO path (position, item_key, kind, track) VALUES (1, 'kana:あ', 'kana', 'kana'), (2, 'kana:い', 'kana', 'kana'), (3, 'kana:か', 'kana', 'kana'),
        (4, 'kana:が', 'kana', 'kana'), (5, 'kana:を', 'kana', 'kana'),
        (6, 'component:木', 'component', 'main'), (7, 'kanji:木', 'kanji', 'main');
      INSERT INTO path_requirements VALUES ('kana:が', 'kana:か'), ('kanji:木', 'component:木');
    `),
  );
  await migrate(db);
  return db;
}

const keys = (ls: { item_key: string }[]) => ls.map((l) => l.item_key);

test("kana answers: Hepburn, other romanisations, listed extras; not kana or English", () => {
  assert.equal(checkKana("shi", "し", "shi", []).result, "correct");
  assert.equal(checkKana("si", "し", "shi", []).result, "correct");
  assert.equal(checkKana("SHI ", "し", "shi", []).result, "correct");
  assert.equal(checkKana("sya", "しゃ", "sha", []).result, "correct");
  assert.equal(checkKana("ka", "カ", "ka", []).result, "correct");
  assert.equal(checkKana("o", "を", "wo", ["o"]).result, "correct");
  assert.equal(checkKana("ti", "ティ", "ti", []).result, "correct");
  assert.equal(checkKana("thi", "ティ", "ti", []).result, "correct");
  assert.equal(checkKana("chi", "ティ", "ti", []).result, "wrong");
  assert.equal(checkKana("sa", "し", "shi", []).result, "wrong");
  assert.equal(checkKana("し", "し", "shi", []).result, "retry");
  assert.equal(checkKana("", "し", "shi", []).result, "retry");
});

test("kana have a single reading card", () => {
  assert.deepEqual(cardTypesFor("kana"), ["reading"]);
});

test("each track has its own lesson queue", async () => {
  const db = await freshDb();
  assert.deepEqual(keys(await availableLessons(db)), ["kana:あ", "kana:い", "kana:か", "kana:を", "component:木"]);
  // The window counts from each track's own first unstarted item.
  assert.deepEqual(keys(await availableLessons(db, 40, 1)), ["kana:あ", "component:木"]);
});

test("kana lessons have their own daily limit, and come first", async () => {
  assert.equal(lessonAllowance(0, 0, KANA_PER_DAY), KANA_PER_DAY);
  const db = await freshDb();
  const s = await todaySummary(db, T0);
  assert.deepEqual(keys(s.lessons), ["kana:あ", "kana:い", "kana:か", "kana:を", "component:木"]);

  // Doing kana doesn't use up the main track's allowance.
  await startLessons(db, [{ item_key: "kana:あ", kind: "kana" }, { item_key: "kana:い", kind: "kana" }], T0);
  const after = await todaySummary(db, T0 + 1000);
  assert.ok(keys(after.lessons).includes("component:木"));
  assert.equal(after.lessonsDoneToday, 2);
  assert.ok(NEW_PER_DAY > 0);
});

test("kana details, answers, preview and library entry", async () => {
  const db = await freshDb();
  const d = await getItemDetails(db, "kana:を");
  if (d.kind !== "kana") return assert.fail("not kana");
  assert.deepEqual([d.romaji, d.accept, d.script, d.group, d.counterpart], ["wo", ["o"], "hiragana", "basic", "ヲ"]);
  assert.deepEqual(acceptedAnswers(d), { meanings: [], readings: ["wo", "o"] });

  const p = await itemPreview(db, "kana:あ");
  assert.deepEqual([p.label, p.meanings, p.readings, p.status], ["あ", ["a"], ["ア"], "available"]);

  const lib = Object.fromEntries((await libraryItems(db)).map((i) => [i.item_key, i]));
  assert.equal(lib["kana:が"].status, "locked");
  assert.equal(lib["kana:が"].meaning, "ga");
  assert.match(lib["kana:を"].search, /wo/);
});

test("a lesson round is a whole row of kana: the daily limit finishes it, the main track goes 5 at a time", () => {
  const l = (item_key: string, round: number | null): Lesson => ({ item_key, kind: "kana", track: "kana", position: 0, label: "", round });
  const kana = [l("kana:や", 9), l("kana:ゆ", 9), l("kana:よ", 9), l("kana:わ", 9), l("kana:を", 9), l("kana:ん", 9), l("kana:か→が", 10)];
  assert.equal(finishRound(kana, 2), 6, "2 allowed, but the row finishes");
  assert.equal(finishRound(kana, 6), 6);
  assert.equal(finishRound(kana, 0), 0, "none allowed: none, not a whole row");
  assert.equal(finishRound(kana, 99), 7);
  assert.deepEqual(keys(firstRound(kana, 5)), ["kana:や", "kana:ゆ", "kana:よ", "kana:わ", "kana:を", "kana:ん"]);
  const main = ["a", "b", "c", "d", "e", "f"].map((x): Lesson => ({ ...l(`kanji:${x}`, null), track: "main", kind: "kanji" }));
  assert.equal(finishRound(main, 2), 2);
  assert.equal(firstRound(main, 5).length, 5);
  assert.ok(isKanaRule("kana:か→が") && !isKanaRule("kana:か"));
});

test("a kana rule loads the kana it covers, each with its own answers and hint", async () => {
  const db = openTestDb((content) =>
    content.exec(`
      INSERT INTO kana (character, romaji, accept, script, grp, counterpart, examples, hint) VALUES
        ('か→が', 'k→g, s→z, t→d, h→b', '[]', 'hiragana', 'dakuten', 'カ→ガ', '["が","ぢ"]', NULL),
        ('が', 'ga', '[]', 'hiragana', 'dakuten', 'ガ', NULL, 'GAsp! (GA)'),
        ('ぢ', 'ji', '["ji","di"]', 'hiragana', 'dakuten', 'ヂ', NULL, 'Rare (JI)');
      INSERT INTO path (position, item_key, kind, track, lesson_round) VALUES (1, 'kana:か→が', 'kana', 'kana', 1);
    `),
  );
  await migrate(db);
  const d = await getItemDetails(db, "kana:か→が");
  if (d.kind !== "kana") return assert.fail("not kana");
  assert.deepEqual(d.examples, [
    { character: "が", romaji: "ga", accept: [], hint: "GAsp! (GA)" },
    { character: "ぢ", romaji: "ji", accept: ["ji", "di"], hint: "Rare (JI)" },
  ]);
  assert.equal(checkKana("di", "ぢ", "ji", d.examples[1].accept).result, "correct");
  assert.deepEqual(
    (await availableLessons(db)).map((l) => [l.item_key, l.round]),
    [["kana:か→が", 1]],
  );
});

test("updating retires review cards for kana that left the path (が is now part of the か→が rule)", async () => {
  const db = openTestDb((content) =>
    content.exec(`
      INSERT INTO kana (character, romaji, accept, script, grp, counterpart) VALUES ('か', 'ka', '[]', 'hiragana', 'basic', 'カ'), ('が', 'ga', '[]', 'hiragana', 'dakuten', 'ガ');
      INSERT INTO path (position, item_key, kind, track) VALUES (1, 'kana:か', 'kana', 'kana');
    `),
  );
  await migrate(db, SCHEMA_VERSION - 1);
  await startLessons(db, [{ item_key: "kana:か", kind: "kana" }, { item_key: "kana:が", kind: "kana" }], T0);
  await db.batch([{ sql: "INSERT INTO fast_track (item_key, since) VALUES ('kana:が', 0), ('kana:か', 0)" }]);
  await migrate(db);
  assert.deepEqual(await db.all("SELECT item_key FROM srs_cards"), [{ item_key: "kana:か" }]);
  assert.deepEqual(await db.all("SELECT item_key FROM fast_track"), [{ item_key: "kana:か" }]);
});
