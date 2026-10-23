// Word help in Reading: a box's Japanese split into words (src-tauri/src/
// words.rs splits it with lindera + IPADIC), shaped for a learner, matched to
// JMdict (content.dict_entries) and to your progress, and read out in kana.

import { invoke } from "@tauri-apps/api/core";
import { toHiragana } from "wanakana";
import type { Db } from "./db/db.ts";
import { libraryItems } from "./library.ts";

/** One piece as the splitter sees it (IPADIC's fields; "" when it has none). */
export type Piece = {
  surface: string;
  /** Part of speech and subcategories, in Japanese: 動詞, 自立… */
  pos: [string, string, string, string];
  /** Conjugation type and form, for verbs and adjectives. */
  conjugation: [string, string];
  /** Dictionary form (待ち → 待つ); "" for words it doesn't know. */
  base: string;
  /** Reading of the surface in katakana; "" for words it doesn't know. */
  reading: string;
};

export type DictEntry = {
  id: string;
  written: string;
  reading: string;
  senses: { pos: string[]; glosses: string[] }[];
  /** On your learning path (a common word): its item key. */
  itemKey: string | null;
};

/** What a word is to you: known, learning, new; or grammar, a name, punctuation. */
export type WordStatus = "known" | "learning" | "new" | "grammar" | "name" | "symbol";

export type Word = {
  /** As it is on the page, endings included (待ちません). */
  surface: string;
  /** Its dictionary form (待つ), what's looked up. */
  base: string;
  /** The head piece, then its endings (ませ, ん). */
  pieces: Piece[];
  role: "word" | "grammar" | "name" | "symbol";
  entry?: DictEntry;
  /** Joined from several nouns because JMdict has the longer word (二+人+きり): read the way JMdict reads it. */
  joined?: boolean;
  status: WordStatus;
};

export const splitText = (text: string) => invoke<Piece[]>("words_split", { text });

const is = (p: Piece | undefined, pos: string, sub?: string) => !!p && p.pos[0] === pos && (sub === undefined || p.pos[1] === sub);

/** A piece that belongs to the verb or adjective before it: helpers (ます, ない, た), suffix verbs (させる, られる), "-ing" (ている)… */
function isEnding(p: Piece, next: Piece | undefined): boolean {
  if (is(p, "助動詞")) return true;
  if (is(p, "動詞", "接尾") || is(p, "動詞", "非自立") || is(p, "形容詞", "非自立")) return true;
  // て/で linking to a helper verb after it (待って いる).
  return is(p, "助詞", "接続助詞") && ["て", "で"].includes(p.surface) && !!next && (is(next, "動詞", "非自立") || is(next, "形容詞", "非自立"));
}

/**
 * The pieces as a learner's words: a verb or adjective with its endings as
 * one word (食べ+させ+られ+たく+なかっ+た → 食べる), a noun + する as one
 * verb, particles and helpers on their own as grammar, punctuation as is.
 */
export function groupPieces(pieces: Piece[]): Word[] {
  const words: Word[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (is(p, "記号") || !p.surface.trim()) {
      words.push({ surface: p.surface, base: p.surface, pieces: [p], role: "symbol", status: "symbol" });
      continue;
    }
    // 約束 + し(する) → 約束する
    const suru = is(p, "名詞", "サ変接続") && is(pieces[i + 1], "動詞", "自立") && pieces[i + 1].base === "する";
    if (is(p, "動詞") || is(p, "形容詞") || suru) {
      const group = suru ? [p, pieces[++i]] : [p];
      while (i + 1 < pieces.length && isEnding(pieces[i + 1], pieces[i + 2])) group.push(pieces[++i]);
      const base = suru ? `${p.surface}する` : p.base || p.surface;
      words.push({ surface: group.map((g) => g.surface).join(""), base, pieces: group, role: "word", status: "new" });
      continue;
    }
    // Particles, helpers, and the explaining の/ん (いないのだ, 行くんだ).
    const grammar = is(p, "助詞") || is(p, "助動詞") || (is(p, "名詞", "非自立") && ["の", "ん"].includes(p.surface));
    const name = p.pos[1] === "固有名詞" && p.pos[2] === "人名";
    words.push({ surface: p.surface, base: p.base || p.surface, pieces: [p], role: grammar ? "grammar" : name ? "name" : "word", status: grammar ? "grammar" : name ? "name" : "new" });
  }
  return words;
}

/** A noun-ish word that may join its neighbours into a longer dictionary word (二+人+きり → 二人きり). */
const joinable = (w: Word) => w.role !== "symbol" && w.role !== "grammar" && w.pieces.length === 1 && ["名詞", "接頭詞"].includes(w.pieces[0].pos[0]);

/** The longest dictionary words to try per run, in pieces. */
const MAX_JOIN = 4;

/** JMdict entries for these forms, best first per form (common, then frequent). */
async function entriesFor(db: Db, forms: string[]): Promise<Map<string, DictEntry[]>> {
  const found = new Map<string, DictEntry[]>();
  if (forms.length === 0) return found;
  const rows = await db.all<{ form: string; id: string; written: string; reading: string; senses: string; on_path: number }>(
    `SELECT f.form, e.id, e.written, e.reading, e.senses, EXISTS (SELECT 1 FROM content.words w WHERE w.id = e.id) AS on_path
     FROM content.dict_forms f JOIN content.dict_entries e ON e.id = f.entry_id
     WHERE f.form IN (${forms.map(() => "?").join(", ")})
     ORDER BY e.common DESC, e.priority, e.id`,
    forms,
  );
  for (const r of rows) {
    const list = found.get(r.form) ?? [];
    list.push({ id: r.id, written: r.written, reading: r.reading, senses: JSON.parse(r.senses), itemKey: r.on_path ? `word:${r.id}` : null });
    found.set(r.form, list);
  }
  return found;
}

/** Katakana to hiragana, keeping ー (ラーメン → らーめん). */
export const hiragana = (kana: string) => toHiragana(kana, { convertLongVowelMark: false });

/** The entry that fits this word best: one read the way the page reads it, else the most common. */
function pick(word: Word, entries: DictEntry[] | undefined): DictEntry | undefined {
  if (!entries?.length) return undefined;
  const reading = hiragana(word.pieces.map((p) => p.reading).join(""));
  return (word.pieces.length === 1 && entries.find((e) => hiragana(e.reading) === reading)) || entries[0];
}

/**
 * Words matched to JMdict and your progress: runs of nouns are joined where
 * JMdict has the longer word, then every word gets its entry (if any) and a
 * status (known once passed, learning while you study it, else new).
 */
export async function lookUpWords(db: Db, grouped: Word[]): Promise<Word[]> {
  // Every run of up to MAX_JOIN joinable words, as a candidate dictionary form.
  const spans = new Set<string>();
  for (let i = 0; i < grouped.length; i++) {
    for (let n = 2; n <= MAX_JOIN && i + n <= grouped.length && grouped.slice(i, i + n).every(joinable); n++) {
      spans.add(grouped.slice(i, i + n).map((w) => w.surface).join(""));
    }
  }
  const joinedEntries = await entriesFor(db, [...spans]);
  const words: Word[] = [];
  for (let i = 0; i < grouped.length; i++) {
    let n = Math.min(MAX_JOIN, grouped.length - i);
    for (; n >= 2; n--) {
      const run = grouped.slice(i, i + n);
      if (run.every(joinable) && joinedEntries.has(run.map((w) => w.surface).join(""))) break;
    }
    if (n >= 2) {
      const run = grouped.slice(i, i + n);
      const surface = run.map((w) => w.surface).join("");
      words.push({ surface, base: surface, pieces: run.flatMap((w) => w.pieces), role: "word", entry: joinedEntries.get(surface)![0], joined: true, status: "new" });
      i += n - 1;
    } else words.push(grouped[i]);
  }

  const toLook = words.filter((w) => !w.entry && (w.role === "word" || w.role === "name"));
  // JMdict lists most noun + する verbs (溺愛する) under the noun (溺愛), so look that up too.
  const noun = (w: Word) => (w.base.endsWith("する") && w.pieces[0].pos[1] === "サ変接続" ? w.pieces[0].surface : undefined);
  const entries = await entriesFor(db, [...new Set(toLook.flatMap((w) => [w.base, noun(w) ?? []].flat()))]);
  for (const w of toLook) w.entry = pick(w, entries.get(w.base)) ?? pick({ ...w, pieces: [w.pieces[0]] }, entries.get(noun(w) ?? ""));

  const keys = [...new Set(words.flatMap((w) => (w.entry?.itemKey ? [w.entry.itemKey] : [])))];
  const status = new Map((keys.length ? await libraryItems(db, keys) : []).map((i) => [i.item_key, i.status]));
  for (const w of words) {
    if (w.role !== "word" || !w.entry?.itemKey) continue;
    const s = status.get(w.entry.itemKey);
    w.status = s === "passed" ? "known" : s === "learning" ? "learning" : "new";
  }
  return words;
}

/** Splits a box's text and looks its words up. */
export async function wordsIn(db: Db, text: string): Promise<Word[]> {
  return lookUpWords(db, groupPieces(await splitText(text)));
}

/**
 * The text in kana, a space between words (もう まちません). A word joined from
 * several pieces is read the way JMdict reads it (二人 → ふたり, not にん);
 * others the way the splitter read them. `unsure`: it has a name or a word
 * with kanji the splitter didn't know.
 */
export function readingOf(words: Word[]): { reading: string; unsure: boolean } {
  let unsure = false;
  const parts = words.map((w) => {
    if (w.role === "symbol") return w.surface;
    if (w.role === "name") unsure = true;
    if (w.joined && w.entry) return hiragana(w.entry.reading);
    return w.pieces
      .map((p) => {
        if (p.reading) return hiragana(p.reading);
        if (/\p{Script=Han}/u.test(p.surface)) unsure = true;
        return hiragana(p.surface);
      })
      .join("");
  });
  let out = "";
  words.forEach((w, i) => {
    out += (i > 0 && w.role !== "symbol" ? " " : "") + parts[i];
  });
  return { reading: out.trim(), unsure };
}

/** Parts of speech, for people. */
export const POS_NAME: Record<string, string> = {
  名詞: "noun",
  動詞: "verb",
  形容詞: "い-adjective",
  副詞: "adverb",
  助詞: "particle",
  助動詞: "helper",
  感動詞: "interjection",
  接続詞: "conjunction",
  連体詞: "pre-noun word",
  接頭詞: "prefix",
  記号: "symbol",
  フィラー: "filler",
};

/** What the common grammar pieces do (endings and particles), by their dictionary form. Short and plain. */
export const GRAMMAR_NOTES: Record<string, string> = {
  ます: "polite",
  する: "do (makes a verb from a noun)",
  です: "polite \"is\"",
  ない: "not",
  ぬ: "not (old-fashioned)",
  ん: "not (casual, or after ません)",
  た: "past: did / was",
  だ: "\"is\" (plain); after a verb, past",
  たい: "want to",
  れる: "is done to (passive) / can",
  られる: "is done to (passive) / can",
  せる: "makes or lets someone",
  させる: "makes or lets someone",
  う: "let's / probably",
  よう: "let's / probably",
  て: "and / then (て-form, joins actions)",
  で: "and / then (て-form)",
  いる: "ongoing: is doing / has done",
  ある: "has been done",
  しまう: "completely / by accident (regret)",
  ちゃう: "completely / by accident (casual しまう)",
  くる: "comes to / has been",
  いく: "goes on / will keep",
  おく: "does in advance",
  みる: "tries doing",
  そう: "looks like",
  らしい: "seems",
  は: "topic marker: \"as for…\"",
  が: "marks the subject; or \"but\"",
  を: "marks the object",
  に: "to / at / in (time, place, target)",
  へ: "toward",
  と: "and / with / \"(quote)\"",
  の: "'s / of; or explains (のだ)",
  も: "also / too / even",
  から: "from; or \"because\"",
  まで: "until / as far as",
  より: "than / from",
  や: "and (among others)",
  か: "question marker; or \"or\"",
  よ: "tells you something (\"you know\")",
  ね: "seeks agreement (\"right?\")",
  な: "don't (after a verb); or exclamation",
  けど: "but / although",
  ので: "because",
  のに: "even though",
  ば: "if",
  たら: "if / when",
  し: "and also (listing reasons)",
};
