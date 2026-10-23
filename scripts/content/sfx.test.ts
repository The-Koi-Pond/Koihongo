import assert from "node:assert/strict";
import test from "node:test";
import { SFX_EXTRAS, sfxKeys, sfxWords } from "./sfx.ts";
import { textKey } from "../../src/textKey.ts";
import { sfxDictionary } from "../../src/reading.ts";
import { openTestDb } from "../../tests/nodeDb.ts";

const finds = (form: string, marked: string) => sfxKeys(form).find((k) => k.key === textKey(marked, "sfx"));

test("SFX keys: a box's text finds the dictionary form however it's written", () => {
  assert.deepEqual(finds("どきっと", "ドキッ"), { key: "どき", loose: false }, "the adverb's と drops");
  assert.deepEqual(finds("がたり", "ガタッ"), { key: "がた", loose: false }, "and its り");
  assert.deepEqual(finds("どきどき", "ドキドキドキ"), { key: "どきどき", loose: false });
  assert.deepEqual(finds("どきどき", "ドキッ"), { key: "どき", loose: true }, "half a doubled word is related");
  assert.deepEqual(finds("すっと", "スッ"), { key: "す", loose: false }, "one sound is enough");
  assert.equal(finds("ごごご", "ゴゴゴゴ")?.loose, false);
  assert.equal(finds("ばたん", "ガタッ"), undefined);
});

test("SFX words: JMdict's on-mim senses only, and the extras first", () => {
  const words = sfxWords(
    [
      { id: "1", kana: [{ text: "ドキッ" }, { text: "どきっ" }], sense: [{ misc: ["on-mim"], gloss: [{ text: "being startled" }, { text: "heart skipping" }] }] },
      { id: "2", kana: [{ text: "あっさり" }], sense: [{ misc: [], gloss: [{ text: "easily" }] }] },
    ],
    () => 5,
  );
  assert.equal(words.length, SFX_EXTRAS.length + 1);
  assert.equal(words[0].source, "koihongo");
  assert.deepEqual(words.at(-1), { forms: ["ドキッ", "どきっ"], meanings: ["being startled; heart skipping"], source: "jmdict", rank: 5 });
  const keys = new Set(SFX_EXTRAS.map(([form]) => form));
  assert.equal(keys.size, SFX_EXTRAS.length, "no extra listed twice");
});

test("SFX dictionary lookup: the same word before related ones", async () => {
  const db = openTestDb((c) => {
    c.exec(`INSERT INTO sfx_words (id, forms, meanings, source, rank) VALUES
      (1, '["どきどき"]', '["thump-thump"]', 'jmdict', 3),
      (2, '["どきっと"]', '["with a start"]', 'jmdict', 9)`);
    c.exec(`INSERT INTO sfx_keys (key, word_id, loose) VALUES ('どきどき', 1, 0), ('どき', 1, 1), ('どき', 2, 0)`);
  });
  const found = await sfxDictionary(db, textKey("ドキッ", "sfx"));
  assert.deepEqual(
    found.map((f) => [f.forms[0], f.loose]),
    [
      ["どきっと", false],
      ["どきどき", true],
    ],
  );
  assert.deepEqual(await sfxDictionary(db, ""), []);
});
