// Dictionary search terms. The content build indexes every word and kanji with
// these (the `search` table), and the app normalizes what you type the same
// way, so both sides always match.

import { toHiragana } from "wanakana";
import { splitNotes } from "./gloss.ts";

export type SearchField = "form" | "reading" | "meaning" | "meaning_word";

export type SearchTerm = {
  term: string;
  field: SearchField;
  /** 0 for the main form or first meaning; higher for alternatives and later senses. */
  weight: number;
};

/** Lowercase, full-width letters to plain ones, katakana to hiragana (so テレビ = てれび). */
export function normalizeTerm(text: string): string {
  return toHiragana(text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(), { passRomaji: true });
}

// Too common to be worth matching on their own inside a meaning.
const STOP_WORDS = new Set(["a", "an", "the", "to", "of", "in", "on", "at", "for", "by", "with", "be", "one's", "someone", "something", "etc"]);

/** A meaning without its "(…)" notes, and without the "to " that marks verbs ("to eat" → "eat"). */
export function meaningTerm(gloss: string): string {
  const plain = splitNotes(gloss)
    .filter((p) => !p.note)
    .map((p) => p.text)
    .join(" ");
  return normalizeTerm(plain).replace(/^to /, "");
}

/** The single words inside a multi-word meaning ("pine tree" → pine, tree), for "tree" to find 松. */
export function meaningWords(term: string): string[] {
  const words = term.split(/[^\p{L}\p{N}']+/u).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return words.length > 1 ? words : [];
}

/** All search terms for one entry, one row per distinct (term, field) at its best weight. */
export function entryTerms(entry: { forms: string[]; readings: string[]; meanings: string[][] }): SearchTerm[] {
  const best = new Map<string, SearchTerm>();
  const add = (term: string, field: SearchField, weight: number) => {
    if (!term) return;
    const key = `${field}\u0000${term}`;
    const seen = best.get(key);
    if (!seen || weight < seen.weight) best.set(key, { term, field, weight });
  };
  entry.forms.forEach((f, i) => add(normalizeTerm(f), "form", i === 0 ? 0 : 1));
  entry.readings.forEach((r, i) => add(normalizeTerm(r), "reading", i === 0 ? 0 : 1));
  // Senses past the third all count the same.
  entry.meanings.forEach((sense, i) => {
    for (const gloss of sense) {
      const term = meaningTerm(gloss);
      add(term, "meaning", Math.min(i, 3));
      for (const word of meaningWords(term)) add(word, "meaning_word", Math.min(i, 3));
    }
  });
  return [...best.values()];
}
