import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import { acceptedAnswers, addSynonym, getItemDetails, removeSynonym, saveNote, sentenceWords } from "../src/items.ts";
import { openTestDb } from "./nodeDb.ts";

async function freshDb() {
  const db = openTestDb((content) =>
    content.exec(`
      INSERT INTO components (glyph, display, name, stroke_count) VALUES ('木', '木', 'tree', 4), ('化', '⺅', 'person', 2);
      INSERT INTO kanji (character, meanings, on_readings, kun_readings, nanori, stroke_count, stroke_svg)
        VALUES ('木', '["tree","wood"]', '["ボク","モク"]', '["き","こ-"]', '[]', 4, '<svg/>'),
               ('休', '["rest"]', '["キュウ"]', '["やす.む"]', '[]', 6, NULL);
      INSERT INTO kanji_components VALUES ('木', '木'), ('休', '化'), ('休', '木');
      INSERT INTO words VALUES ('1', '休み', 'やすみ', '["やすみ","ヤスミ","休"]',
        '[{"pos":["n"],"glosses":["rest","break"],"misc":[],"info":[]},{"pos":["n"],"glosses":["holiday"],"misc":[],"info":[]}]', 5, 0);
      INSERT INTO word_kanji VALUES ('1', '休');
      INSERT INTO sentences VALUES ('9', '休みが欲しい。', 'I want a break.', '["1"]', 0);
      INSERT INTO word_sentences VALUES ('1', '9', '休み', 1);
      INSERT INTO path (position, item_key, kind) VALUES (1, 'component:木', 'component'), (2, 'kanji:木', 'kanji'), (3, 'component:化', 'component'),
        (4, 'kanji:休', 'kanji'), (5, 'word:1', 'word');
      INSERT INTO mnemonics VALUES ('kanji:木', 'meaning', 'A TREE with branches.');
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
  assert.deepEqual(d.sentences, [{ japanese: "休みが欲しい。", id: "9", english: "I want a break.", form: "休み", newWords: 0 }]);
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

test("Koihongo's default mnemonic shows until you save your own", async () => {
  const db = await freshDb();
  let d = await getItemDetails(db, "kanji:木");
  assert.deepEqual(d.notes.mnemonic_meaning, { text: "A TREE with branches.", author: "default", created_at: 0 });
  assert.equal(d.notes.mnemonic_reading, undefined);
  await saveNote(db, "kanji:木", "mnemonic_meaning", "My own tree story.", "you", 5);
  d = await getItemDetails(db, "kanji:木");
  assert.deepEqual(d.notes.mnemonic_meaning, { text: "My own tree story.", author: "you", created_at: 5 });
});

test("example sentences you can read come first, and change as you learn words", async () => {
  const db = openTestDb((content) =>
    content.exec(`
      INSERT INTO words VALUES ('1', '休み', 'やすみ', '[]', '[{"pos":["n"],"glosses":["rest"],"misc":[],"info":[]}]', 5, 0),
                               ('2', '今日', 'きょう', '[]', '[{"pos":["n"],"glosses":["today"],"misc":[],"info":[]}]', 5, 0);
      INSERT INTO sentences VALUES ('a', '今日は休み。', 'Today is a day off.', '["2","1"]', 0),
                                   ('b', '休みがほしいです。', 'I want a break.', '["1"]', 0),
                                   ('c', '休みだ。', 'It''s a day off.', '["1"]', 1);
      INSERT INTO word_sentences VALUES ('1', 'a', '休み', 0), ('1', 'b', '休み', 0), ('1', 'c', '休み', 0);
    `),
  );
  await migrate(db);
  const order = async () => {
    const d = await getItemDetails(db, "word:1");
    return d.kind === "word" ? d.sentences.map((s) => `${s.japanese}:${s.newWords}`) : [];
  };
  // b uses only the word itself; a needs 今日; c has a word that isn't in the dictionary (a tie: shorter first).
  assert.deepEqual(await order(), ["休みがほしいです。:0", "休みだ。:1", "今日は休み。:1"]);
  await db.batch([
    {
      sql: `INSERT INTO srs_cards (item_key, card_type, state, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, started_at)
            VALUES ('word:2', 'meaning', 2, 0, 5, 5, 1, 0, 1, 0, 0)`,
    },
  ]);
  // Once 今日 is started, the shorter sentence with it is just as readable.
  assert.deepEqual(await order(), ["今日は休み。:0", "休みがほしいです。:0", "休みだ。:1"]);
});

test("a sentence's words come with readings, meanings and whether you've started them", async () => {
  const db = await freshDb();
  assert.deepEqual(await sentenceWords(db, "9"), [{ written: "休み", reading: "やすみ", meaning: "rest; break", started: false }]);
});

test("a component that's also a kanji lists itself first, even when it comes late on the path", async () => {
  // 王: six kanji built from it come before the 王 kanji itself on the path.
  const others = ["国", "金", "業", "理", "主", "住", "望"];
  const db = openTestDb((content) =>
    content.exec(`
      INSERT INTO components (glyph, display, name, stroke_count) VALUES ('王', '王', 'king', 4);
      INSERT INTO kanji (character, meanings, on_readings, kun_readings, nanori, stroke_count) VALUES
        ${[...others, "王"].map((k) => `('${k}', '["${k === "王" ? "king" : "x"}"]', '[]', '[]', '[]', 1)`).join(", ")};
      INSERT INTO kanji_components VALUES ${[...others, "王"].map((k) => `('${k}', '王')`).join(", ")};
      INSERT INTO path (position, item_key, kind) VALUES (1, 'component:王', 'component'),
        ${others.map((k, i) => `(${i + 2}, 'kanji:${k}', 'kanji')`).join(", ")}, (99, 'kanji:王', 'kanji');
    `),
  );
  await migrate(db);
  const d = await getItemDetails(db, "component:王");
  if (d.kind !== "component") return assert.fail("not a component");
  assert.equal(d.usedIn.length, 6);
  assert.deepEqual(d.usedIn[0], { character: "王", meaning: "king" });
  assert.deepEqual(
    d.usedIn.slice(1).map((k) => k.character),
    others.slice(0, 5),
    "then the others in path order",
  );
});
