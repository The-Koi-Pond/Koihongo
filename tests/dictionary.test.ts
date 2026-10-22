import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import { kanjiByParts, listParts, searchDictionary } from "../src/dictionary.ts";
import { entryTerms, meaningTerm, meaningWords, normalizeTerm } from "../src/searchTerms.ts";
import { openDbWithContent } from "./nodeDb.ts";

test("search terms: katakana, full-width and case all normalize the same way", () => {
  assert.equal(normalizeTerm("テレビ"), normalizeTerm("てれび"));
  assert.equal(normalizeTerm("ＣＤ"), "cd");
  assert.equal(normalizeTerm("  Big   Cat "), "big cat");
});

test("search terms: meanings drop notes and the verb's 'to'", () => {
  assert.equal(meaningTerm("to eat"), "eat");
  assert.equal(meaningTerm("pine tree (Pinus spp.)"), "pine tree");
  assert.deepEqual(meaningWords("pine tree"), ["pine", "tree"]);
  assert.deepEqual(meaningWords("tree"), []);
  assert.deepEqual(meaningWords("go to the store"), ["go", "store"]);
});

test("search terms: one row per term and field, at the best weight", () => {
  const terms = entryTerms({ forms: ["猫"], readings: ["ねこ"], meanings: [["cat"], ["cat", "shamisen"]] });
  assert.deepEqual(
    terms.filter((t) => t.field === "meaning"),
    [
      { term: "cat", field: "meaning", weight: 0 },
      { term: "shamisen", field: "meaning", weight: 1 },
    ],
  );
});

const CONTENT = join(import.meta.dirname, "..", "src-tauri", "resources", "content.db");

test("dictionary search finds words by English, romaji, kana and kanji", { skip: !existsSync(CONTENT) && "content.db not built" }, async () => {
  const db = openDbWithContent(CONTENT);
  await migrate(db);
  const top = async (q: string) => (await searchDictionary(db, q)).words[0]?.label;

  assert.equal(await top("eat"), "食べる");
  assert.equal(await top("to eat"), "食べる");
  assert.equal(await top("taberu"), "食べる");
  assert.equal(await top("たべる"), "食べる");
  assert.equal(await top("食べる"), "食べる");
  assert.equal(await top("neko"), "猫");
  assert.equal(await top("terebi"), "テレビ");
  assert.equal(await top("tree"), "木");

  const water = await searchDictionary(db, "water");
  assert.equal(water.kanji[0].label, "水");
  // Typing a word in kanji lists its kanji too.
  assert.deepEqual((await searchDictionary(db, "日本")).kanji.map((k) => k.label), ["日", "本"]);
  assert.deepEqual(await searchDictionary(db, "   "), { kanji: [], words: [] });
});

test("dictionary hits show your progress, or null off the path", { skip: !existsSync(CONTENT) && "content.db not built" }, async () => {
  const db = openDbWithContent(CONTENT);
  await migrate(db);
  const { words } = await searchDictionary(db, "neko");
  assert.equal(words.find((w) => w.label === "猫")?.status, "locked");
  assert.equal(words.find((w) => w.label === "猫背")?.status, null);
});

test("find kanji by parts: every chosen part must be in it, and the picker learns what still fits", { skip: !existsSync(CONTENT) && "content.db not built" }, async () => {
  const db = openDbWithContent(CONTENT);
  await migrate(db);
  const parts = await listParts(db);
  assert.ok(parts.length > 200);
  assert.ok(parts.every((p, i) => i === 0 || parts[i - 1].strokes <= p.strokes), "fewest strokes first");

  // Person (stored as 化, drawn ⺅) and tree: 休 (rest) and 体 (body), not 林, which has no person.
  const personTree = await kanjiByParts(db, ["化", "木"]);
  const labels = personTree.kanji.map((k) => k.label);
  assert.ok(labels.includes("休") && labels.includes("体"));
  assert.ok(!labels.includes("林"));
  assert.equal(personTree.total, personTree.kanji.length);
  // 体 also has 一, so 一 can still narrow it down; the chosen parts themselves are usable too.
  assert.ok(personTree.usable.includes("一") && personTree.usable.includes("木"));

  // Fewer strokes first: 休 (6) before 体 (7).
  assert.ok(labels.indexOf("休") < labels.indexOf("体"));
  assert.deepEqual(await kanjiByParts(db, []), { kanji: [], total: 0, usable: [] });
});
