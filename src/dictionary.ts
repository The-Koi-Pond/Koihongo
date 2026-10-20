// Dictionary search over every word and kanji in content.db (the `search`
// table), whether or not it's on your learning path.

import { isKana, isRomaji, toHiragana } from "wanakana";
import type { Db } from "./db/db.ts";
import { libraryItems, type ItemStatus } from "./library.ts";
import { meaningTerm, normalizeTerm, type SearchField } from "./searchTerms.ts";

export type DictionaryHit = {
  item_key: string;
  label: string;
  /** Kana reading(s): the word's reading, or a kanji's main on'yomi and kun'yomi. */
  readings: string[];
  /** One entry per sense (words) or a kanji's meanings. */
  meanings: string[];
  /** Your progress, or null if it isn't on your learning path. */
  status: ItemStatus | null;
};

export type DictionaryResults = { kanji: DictionaryHit[]; words: DictionaryHit[] };

const MAX_KANJI = 12;
const MAX_WORDS = 40;
const HAN = /\p{Script=Han}/u;
// Above every character SQLite can hold, so `term < prefix + END` covers all terms starting with prefix.
const END = "\u{10FFFF}";

type Probe = { term: string; fields: SearchField[] };

/**
 * What to look up for a query. English is matched against meanings; romaji is
 * also turned into kana and matched against readings, so "neko" finds 猫.
 */
function probes(query: string): Probe[] {
  const q = normalizeTerm(query);
  if (!q) return [];
  // Meanings are indexed without "to " and "(…)" notes, so the query drops them too ("to eat" → "eat").
  const out: Probe[] = [
    { term: q, fields: ["form", "reading"] },
    { term: meaningTerm(query), fields: ["meaning"] },
  ];
  if (isRomaji(q)) {
    const kana = toHiragana(q.replace(/[\s']/g, ""));
    if (kana && isKana(kana)) out.push({ term: kana, fields: ["reading"] });
  }
  return out;
}

type Match = { item_key: string; score: number; rank: number };

/**
 * Best match per item. quality: 0 = exact, 1 = a whole word inside a longer
 * meaning ("tree" in "pine tree"), 2 = starts with what you typed. Within a
 * quality, the main form or first sense (weight 0) beats later ones.
 */
async function findMatches(db: Db, kind: "kanji" | "word", list: Probe[], limit: number): Promise<Match[]> {
  const parts: string[] = [];
  const params: (string | number)[] = [];
  const keyPrefix = `${kind}:`;
  for (const { term, fields } of list) {
    if (!term) continue;
    const inFields = fields.map(() => "?").join(", ");
    parts.push(`SELECT item_key, 0 AS quality, weight, rank FROM content.search
                WHERE term = ? AND field IN (${inFields}) AND item_key >= ? AND item_key < ?`);
    params.push(term, ...fields, keyPrefix, keyPrefix + END);
    if (fields.includes("meaning")) {
      parts.push(`SELECT item_key, 1, weight, rank FROM content.search
                  WHERE term = ? AND field = 'meaning_word' AND item_key >= ? AND item_key < ?`);
      params.push(term, keyPrefix, keyPrefix + END);
    }
    // One Latin letter would match a huge share of the dictionary: wait for the second.
    if (term.length > 1 || !isRomaji(term)) {
      parts.push(`SELECT item_key, 2, weight, rank FROM content.search
                  WHERE term > ? AND term < ? AND field IN (${inFields}) AND item_key >= ? AND item_key < ?`);
      params.push(term, term + END, ...fields, keyPrefix, keyPrefix + END);
    }
  }
  return db.all<Match>(
    `SELECT item_key, min(quality * 10 + weight) AS score, min(rank) AS rank
     FROM (${parts.join(" UNION ALL ")})
     GROUP BY item_key
     ORDER BY score, rank, item_key
     LIMIT ?`,
    [...params, limit],
  );
}

export async function searchDictionary(db: Db, query: string): Promise<DictionaryResults> {
  const list = probes(query);
  if (list.length === 0) return { kanji: [], words: [] };

  const [wordMatches, kanjiMatches] = await Promise.all([findMatches(db, "word", list, MAX_WORDS), findMatches(db, "kanji", list, MAX_KANJI)]);

  // Typing a word in kanji also lists each of its kanji (食べる → 食), first.
  const typedKanji = [...new Set([...query].filter((ch) => HAN.test(ch)))].map((ch) => `kanji:${ch}`);
  const kanjiKeys = [...new Set([...typedKanji, ...kanjiMatches.map((m) => m.item_key)])].slice(0, MAX_KANJI);
  const wordKeys = wordMatches.map((m) => m.item_key);

  const [kanjiRows, wordRows, onPath] = await Promise.all([
    kanjiKeys.length
      ? db.all<{ character: string; meanings: string; on_readings: string; kun_readings: string }>(
          `SELECT character, meanings, on_readings, kun_readings FROM content.kanji WHERE character IN (${kanjiKeys.map(() => "?").join(", ")})`,
          kanjiKeys.map((k) => k.slice(6)),
        )
      : [],
    wordKeys.length
      ? db.all<{ id: string; written: string; reading: string; senses: string }>(
          `SELECT id, written, reading, senses FROM content.words WHERE id IN (${wordKeys.map(() => "?").join(", ")})`,
          wordKeys.map((k) => k.slice(5)),
        )
      : [],
    kanjiKeys.length + wordKeys.length ? libraryItems(db, [...kanjiKeys, ...wordKeys]) : [],
  ]);
  const status = new Map(onPath.map((i) => [i.item_key, i.status]));

  const kanjiByKey = new Map(
    kanjiRows.map((k) => {
      const key = `kanji:${k.character}`;
      const on: string[] = JSON.parse(k.on_readings);
      const kun: string[] = JSON.parse(k.kun_readings);
      return [key, { item_key: key, label: k.character, readings: [on[0], kun[0]].filter(Boolean), meanings: JSON.parse(k.meanings), status: status.get(key) ?? null }];
    }),
  );
  const wordByKey = new Map(
    wordRows.map((w) => {
      const key = `word:${w.id}`;
      const senses: { glosses: string[] }[] = JSON.parse(w.senses);
      return [key, { item_key: key, label: w.written, readings: [w.reading], meanings: senses.map((s) => s.glosses.join("; ")), status: status.get(key) ?? null }];
    }),
  );

  return {
    // A typed character that isn't in the dictionary (a rare kanji) is skipped.
    kanji: kanjiKeys.flatMap((k) => kanjiByKey.get(k) ?? []),
    words: wordKeys.flatMap((k) => wordByKey.get(k) ?? []),
  };
}
