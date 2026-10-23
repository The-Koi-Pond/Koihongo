// Everything shown about one study item, plus your notes and synonyms for it.

import { toRomaji } from "wanakana";
import type { Db } from "./db/db.ts";
import type { ItemKind } from "./srs/progress.ts";

export type NoteKind = "mnemonic_meaning" | "mnemonic_reading" | "note";
/** "default" is Koihongo's own mnemonic (content.mnemonics), shown until you save one. */
export type NoteAuthor = "you" | "ai" | "ai_edited" | "default";
export type Note = { text: string; author: NoteAuthor; created_at: number };

type Common = {
  item_key: string;
  /** Current (newest) note of each kind. */
  notes: Partial<Record<NoteKind, Note>>;
  synonyms: string[];
};

export type KanaDetails = Common & {
  kind: "kana";
  character: string;
  /** Hepburn romaji, plus other answers accepted (を → "o"). */
  romaji: string;
  accept: string[];
  script: "hiragana" | "katakana";
  group: "basic" | "dakuten" | "combo" | "extended";
  counterpart: string | null;
  strokeSvg: string | null;
  /** A common word starting with this sound (ウナギ for ウ). */
  example: { form: string; reading: string; romaji: string; meaning: string } | null;
};

export type ComponentDetails = Common & {
  kind: "component";
  display: string;
  name: string;
  /** Its Japanese name (くにがまえ, さんずい, ひ), and what that means or where it's called that. */
  jaName: string | null;
  jaNote: string | null;
  strokeSvg: string | null;
  usedIn: { character: string; meaning: string }[];
};

export type KanjiDetails = Common & {
  kind: "kanji";
  character: string;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  components: { glyph: string; display: string; name: string }[];
  strokeSvg: string | null;
  words: { id: string; written: string; reading: string; meaning: string }[];
};

export type WordDetails = Common & {
  kind: "word";
  written: string;
  reading: string;
  otherForms: string[];
  senses: { pos: string[]; glosses: string[] }[];
  kanji: { character: string; meaning: string }[];
  /**
   * The examples you can read best first. form: how the word is written in it;
   * newWords: words in it you haven't started (0 = you know them all).
   */
  sentences: { id: string; japanese: string; english: string; form: string; newWords: number }[];
};

export type ItemDetails = KanaDetails | ComponentDetails | KanjiDetails | WordDetails;

export function parseItemKey(itemKey: string): { kind: ItemKind; id: string } {
  const i = itemKey.indexOf(":");
  const kind = itemKey.slice(0, i);
  if (kind !== "kana" && kind !== "component" && kind !== "kanji" && kind !== "word") throw new Error(`Bad item key: ${itemKey}`);
  return { kind, id: itemKey.slice(i + 1) };
}

const first = <T>(json: string): T => JSON.parse(json)[0];

export async function getItemDetails(db: Db, itemKey: string): Promise<ItemDetails> {
  const { kind, id } = parseItemKey(itemKey);
  const notes = await db.all<Note & { kind: NoteKind }>(
    `SELECT kind, text, author, created_at FROM notes n
     WHERE item_key = ? AND id = (SELECT max(id) FROM notes WHERE item_key = n.item_key AND kind = n.kind)`,
    [itemKey],
  );
  const defaults = await db.all<{ kind: "meaning" | "reading"; text: string }>("SELECT kind, text FROM content.mnemonics WHERE item_key = ?", [
    itemKey,
  ]);
  const synonyms = await db.all<{ text: string }>("SELECT text FROM synonyms WHERE item_key = ? ORDER BY created_at", [itemKey]);
  const common: Common = {
    item_key: itemKey,
    notes: {
      ...Object.fromEntries(defaults.map((d) => [`mnemonic_${d.kind}`, { text: d.text, author: "default", created_at: 0 }])),
      ...Object.fromEntries(notes.map(({ kind, ...note }) => [kind, note])),
    },
    synonyms: synonyms.map((s) => s.text),
  };

  if (kind === "kana") {
    const [k] = await db.all<{
      romaji: string;
      accept: string;
      script: KanaDetails["script"];
      grp: KanaDetails["group"];
      counterpart: string | null;
      stroke_svg: string | null;
      example_form: string | null;
      example_reading: string | null;
      example_senses: string | null;
    }>(
      `SELECT k.romaji, k.accept, k.script, k.grp, k.counterpart, k.stroke_svg,
              k.example_form, w.reading AS example_reading, w.senses AS example_senses
       FROM content.kana k LEFT JOIN content.words w ON w.id = k.example_word_id
       WHERE k.character = ?`,
      [id],
    );
    if (!k) throw new Error(`Unknown kana ${id}`);
    return {
      ...common,
      kind,
      character: id,
      romaji: k.romaji,
      accept: JSON.parse(k.accept),
      script: k.script,
      group: k.grp,
      counterpart: k.counterpart,
      strokeSvg: k.stroke_svg,
      example:
        k.example_form && k.example_reading && k.example_senses
          ? {
              form: k.example_form,
              reading: k.example_reading,
              romaji: toRomaji(k.example_reading),
              meaning: first<{ glosses: string[] }>(k.example_senses).glosses[0],
            }
          : null,
    };
  }

  if (kind === "component") {
    const [row] = await db.all<{ display: string; name: string; stroke_svg: string | null; ja_name: string | null; ja_note: string | null }>(
      "SELECT display, name, stroke_svg, ja_name, ja_note FROM content.components WHERE glyph = ?",
      [id],
    );
    if (!row) throw new Error(`Unknown component ${id}`);
    const c = { display: row.display, name: row.name, strokeSvg: row.stroke_svg, jaName: row.ja_name, jaNote: row.ja_note };
    // The first few kanji on the path that use it. A component that's also a
    // kanji by itself (王, 糸) lists that kanji first, so you can check its
    // reading, even when it comes late on the path.
    const usedIn = await db.all<{ character: string; meanings: string }>(
      `SELECT k.character, k.meanings FROM content.kanji k
       JOIN content.path p ON p.item_key = 'kanji:' || k.character
       WHERE k.character IN (?, ?) OR k.character IN (SELECT kanji FROM content.kanji_components WHERE component = ?)
       ORDER BY k.character IN (?, ?) DESC, p.position LIMIT 6`,
      [id, row.display, id, id, row.display],
    );
    return { ...common, kind, ...c, usedIn: usedIn.map((k) => ({ character: k.character, meaning: first(k.meanings) })) };
  }

  if (kind === "kanji") {
    const [k] = await db.all<{ meanings: string; on_readings: string; kun_readings: string; stroke_svg: string | null }>(
      "SELECT meanings, on_readings, kun_readings, stroke_svg FROM content.kanji WHERE character = ?",
      [id],
    );
    if (!k) throw new Error(`Unknown kanji ${id}`);
    const components = await db.all<{ glyph: string; display: string; name: string }>(
      `SELECT c.glyph, c.display, c.name FROM content.kanji_components kc JOIN content.components c ON c.glyph = kc.component
       WHERE kc.kanji = ? ORDER BY c.stroke_count`,
      [id],
    );
    const words = await db.all<{ id: string; written: string; reading: string; senses: string }>(
      `SELECT w.id, w.written, w.reading, w.senses FROM content.word_kanji wk
       JOIN content.words w ON w.id = wk.word_id
       JOIN content.path p ON p.item_key = 'word:' || w.id
       WHERE wk.kanji = ? ORDER BY p.position LIMIT 5`,
      [id],
    );
    return {
      ...common,
      kind,
      character: id,
      meanings: JSON.parse(k.meanings),
      onReadings: JSON.parse(k.on_readings),
      kunReadings: JSON.parse(k.kun_readings),
      components,
      strokeSvg: k.stroke_svg,
      words: words.map((w) => ({ id: w.id, written: w.written, reading: w.reading, meaning: first<{ glosses: string[] }>(w.senses).glosses[0] })),
    };
  }

  const [w] = await db.all<{ written: string; reading: string; other_forms: string; senses: string }>(
    "SELECT written, reading, other_forms, senses FROM content.words WHERE id = ?",
    [id],
  );
  if (!w) throw new Error(`Unknown word ${id}`);
  const kanji = await db.all<{ character: string; meanings: string }>(
    `SELECT k.character, k.meanings FROM content.word_kanji wk JOIN content.kanji k ON k.character = wk.kanji
     WHERE wk.word_id = ? ORDER BY instr(?, k.character)`,
    [id, w.written],
  );
  // Fewest words you haven't started (other than this one), then checked examples, then the shortest.
  const sentences = await db.all<{ id: string; japanese: string; english: string; form: string; newWords: number }>(
    `SELECT s.id, s.japanese, s.english, ws.form,
       s.unlisted + (SELECT count(*) FROM json_each(s.kanji_words) j
                     WHERE j.value != ws.word_id
                       AND NOT EXISTS (SELECT 1 FROM srs_cards c WHERE c.item_key = 'word:' || j.value)) AS newWords
     FROM content.word_sentences ws JOIN content.sentences s ON s.id = ws.sentence_id
     WHERE ws.word_id = ?
     ORDER BY newWords, ws.checked DESC, length(s.japanese), s.id
     LIMIT 3`,
    [id],
  );
  return {
    ...common,
    kind,
    written: w.written,
    reading: w.reading,
    otherForms: JSON.parse(w.other_forms),
    senses: (JSON.parse(w.senses) as { pos: string[]; glosses: string[] }[]).map(({ pos, glosses }) => ({ pos, glosses })),
    kanji: kanji.map((k) => ({ character: k.character, meaning: first(k.meanings) })),
    sentences,
  };
}

export type SentenceWord = { written: string; reading: string; meaning: string; started: boolean };

/** The dictionary words (with kanji) in an example sentence, and whether you've started each. */
export async function sentenceWords(db: Db, sentenceId: string): Promise<SentenceWord[]> {
  const rows = await db.all<{ written: string; reading: string; senses: string; started: number }>(
    `SELECT w.written, w.reading, w.senses,
       EXISTS (SELECT 1 FROM srs_cards c WHERE c.item_key = 'word:' || w.id) AS started
     FROM content.sentences s, json_each(s.kanji_words) j
     JOIN content.words w ON w.id = j.value
     WHERE s.id = ?
     ORDER BY j.key`,
    [sentenceId],
  );
  return rows.map((r) => ({
    written: r.written,
    reading: r.reading,
    meaning: first<{ glosses: string[] }>(r.senses).glosses.slice(0, 3).join("; "),
    started: r.started === 1,
  }));
}

const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

/** What counts as a right answer for this item's meaning and reading cards. */
export function acceptedAnswers(d: ItemDetails): { meanings: string[]; readings: string[] } {
  switch (d.kind) {
    case "kana":
      return { meanings: [], readings: [d.romaji, ...d.accept] };
    case "component":
      return { meanings: [d.name, ...d.synonyms], readings: [] };
    case "kanji":
      return { meanings: [...d.meanings, ...d.synonyms], readings: [...d.onReadings, ...d.kunReadings] };
    case "word":
      return {
        meanings: [...d.senses.flatMap((s) => s.glosses), ...d.synonyms],
        readings: [d.reading, ...d.otherForms.filter((f) => KANA_ONLY.test(f))],
      };
  }
}

/** Saves a new version of a note; older versions are kept. */
export async function saveNote(db: Db, itemKey: string, kind: NoteKind, text: string, author: Exclude<NoteAuthor, "default">, now: number) {
  await db.batch([
    {
      sql: "INSERT INTO notes (item_key, kind, text, author, created_at) VALUES (?, ?, ?, ?, ?)",
      params: [itemKey, kind, text.trim(), author, now],
    },
  ]);
}

export async function addSynonym(db: Db, itemKey: string, text: string, now: number) {
  const clean = text.trim();
  if (!clean) return;
  await db.batch([{ sql: "INSERT OR IGNORE INTO synonyms (item_key, text, created_at) VALUES (?, ?, ?)", params: [itemKey, clean, now] }]);
}

export async function removeSynonym(db: Db, itemKey: string, text: string) {
  await db.batch([{ sql: "DELETE FROM synonyms WHERE item_key = ? AND text = ?", params: [itemKey, text] }]);
}
