import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import { acceptedAnswers, addSynonym, getItemDetails, removeSynonym, saveNote } from "../src/items.ts";
import { openTestDb } from "./nodeDb.ts";

async function freshDb() {
  const db = openTestDb((content) =>
    content.exec(`
      INSERT INTO components VALUES ('木', '木', 'tree', 4), ('化', '⺅', 'person', 2);
      INSERT INTO kanji (character, meanings, on_readings, kun_readings, nanori, stroke_count, stroke_svg)
        VALUES ('木', '["tree","wood"]', '["ボク","モク"]', '["き","こ-"]', '[]', 4, '<svg/>'),
               ('休', '["rest"]', '["キュウ"]', '["やす.む"]', '[]', 6, NULL);
      INSERT INTO kanji_components VALUES ('木', '木'), ('休', '化'), ('休', '木');
      INSERT INTO words VALUES ('1', '休み', 'やすみ', '["やすみ","ヤスミ","休"]',
        '[{"pos":["n"],"glosses":["rest","break"],"misc":[],"info":[]},{"pos":["n"],"glosses":["holiday"],"misc":[],"info":[]}]', 5, 0);
      INSERT INTO word_kanji VALUES ('1', '休');
      INSERT INTO sentences VALUES ('9', '休みが欲しい。', 'I want a break.');
      INSERT INTO word_sentences VALUES ('1', '9', '休み');
      INSERT INTO path (position, item_key, kind) VALUES (1, 'component:木', 'component'), (2, 'kanji:木', 'kanji'), (3, 'component:化', 'component'),
        (4, 'kanji:休', 'kanji'), (5, 'word:1', 'word');
    `),
  );
  await migrate(db);
  return db;
}

test("component details list the kanji that use it, in path order", async () => {
  const d = await getItemDetails(await freshDb(), "component:木");
  assert.equal(d.kind, "component");
  if (d.kind !== "component") return;
  assert.equal(d.name, "tree");
  assert.deepEqual(d.usedIn, [{ character: "木", meaning: "tree" }, { character: "休", meaning: "rest" }]);
  assert.deepEqual(acceptedAnswers(d), { meanings: ["tree"], readings: [] });
});

test("kanji details include components, words and accepted answers", async () => {
  const d = await getItemDetails(await freshDb(), "kanji:休");
  if (d.kind !== "kanji") return assert.fail("not a kanji");
  assert.deepEqual(d.components, [{ glyph: "化", display: "⺅", name: "person" }, { glyph: "木", display: "木", name: "tree" }]);
  assert.deepEqual(d.words, [{ id: "1", written: "休み", reading: "やすみ", meaning: "rest" }]);
  assert.deepEqual(acceptedAnswers(d), { meanings: ["rest"], readings: ["キュウ", "やす.む"] });
});

test("word details include kanji, sentences, and kana alternatives as readings", async () => {
  const d = await getItemDetails(await freshDb(), "word:1");
  if (d.kind !== "word") return assert.fail("not a word");
  assert.deepEqual(d.kanji, [{ character: "休", meaning: "rest" }]);
  assert.deepEqual(d.sentences, [{ japanese: "休みが欲しい。", english: "I want a break." }]);
  assert.deepEqual(acceptedAnswers(d), { meanings: ["rest", "break", "holiday"], readings: ["やすみ", "やすみ", "ヤスミ"] });
});

test("notes keep every version and show the newest; synonyms are accepted", async () => {
  const db = await freshDb();
  await saveNote(db, "kanji:木", "mnemonic_meaning", "A tree.", "you", 1);
  await saveNote(db, "kanji:木", "mnemonic_meaning", "  A tall tree.  ", "ai", 2);
  await addSynonym(db, "kanji:木", " timber ", 3);
  await addSynonym(db, "kanji:木", "timber", 4);
  const d = await getItemDetails(db, "kanji:木");
  assert.deepEqual(d.notes.mnemonic_meaning, { text: "A tall tree.", author: "ai", created_at: 2 });
  assert.equal(d.notes.mnemonic_reading, undefined);
  assert.deepEqual(d.synonyms, ["timber"]);
  assert.ok(acceptedAnswers(d).meanings.includes("timber"));
  const [{ n }] = await db.all<{ n: number }>("SELECT count(*) AS n FROM notes");
  assert.equal(n, 2);

  await removeSynonym(db, "kanji:木", "timber");
  assert.deepEqual((await getItemDetails(db, "kanji:木")).synonyms, []);
});

test("unknown items are an error", async () => {
  await assert.rejects(getItemDetails(await freshDb(), "kanji:龍"), /Unknown kanji/);
  await assert.rejects(getItemDetails(await freshDb(), "nope:1"), /Bad item key/);
});
