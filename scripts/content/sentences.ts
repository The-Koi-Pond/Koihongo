// Example sentences from the Tanaka Corpus (Tatoeba sentences with English,
// as indexed by EDRDG in examples.utf). Each pair is two lines:
//
//   A: 彼は忙しい人だ。<TAB>He is a busy man.#ID=303696_100001
//   B: 彼(かれ)[01] は 忙しい(いそがしい) 人(ひと) だ
//
// The B line lists every word in the sentence: headword, then optional
// (reading), (#JMdict id), [sense], {form as written}, and ~ when the sentence
// was checked as a good example of that word.

export type TanakaToken = { head: string; reading?: string; jmdictId?: string; form?: string; checked: boolean };
export type TanakaPair = { id: string; japanese: string; english: string; tokens: TanakaToken[] };

const TOKEN = /^([^([{~]+)((?:\([^)]*\))*)(?:\[\d+\])?(?:\{([^}]*)\})?(~)?$/;

export function parseTanaka(text: string): TanakaPair[] {
  const lines = text.split("\n");
  const pairs: TanakaPair[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    // #ID=x_y: y is unique per pair; x can be shared by different Japanese sentences.
    const a = /^A: (.*)\t(.*)#ID=\d+_(\d+)\s*$/.exec(lines[i]);
    const b = lines[i + 1];
    if (!a || !b.startsWith("B: ")) continue;
    const tokens: TanakaToken[] = [];
    for (const raw of b.slice(3).trim().split(/\s+/)) {
      const m = TOKEN.exec(raw);
      if (!m) continue;
      const token: TanakaToken = { head: m[1], checked: !!m[4] };
      if (m[3]) token.form = m[3];
      for (const p of m[2].matchAll(/\(([^)]*)\)/g)) {
        if (p[1].startsWith("#")) token.jmdictId = p[1].slice(1);
        else token.reading = p[1];
      }
      tokens.push(token);
    }
    pairs.push({ id: a[3], japanese: a[1], english: a[2], tokens });
  }
  return pairs;
}

export type SentenceWord = { id: string; written: string; reading: string; otherForms: string[]; priority: number; usuallyKana: boolean };

export type LinkedSentence = {
  id: string;
  japanese: string;
  english: string;
  /** Words in it you'd have to learn: written with kanji, and not usually written in kana. */
  kanjiWords: string[];
  /** Words with kanji that aren't in our dictionary at all (count as new). */
  unlisted: number;
};

export type SentenceLink = { wordId: string; sentenceId: string; form: string; checked: boolean };

const HAN = /\p{Script=Han}/u;
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;
const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));

/**
 * Links sentences to words and keeps up to `perWord` example sentences for
 * each word: ones checked as good examples first, then the shortest. Words the
 * index never mentions fall back to plain text search (multi-character words
 * with kanji only, where a text match is reliable: 南西, not 正).
 */
export function linkSentences(pairs: TanakaPair[], words: SentenceWord[], perWord: number): { sentences: LinkedSentence[]; links: SentenceLink[] } {
  const byForm = new Map<string, SentenceWord[]>();
  const kanaForms = new Map<string, Set<string>>();
  const byId = new Map(words.map((w) => [w.id, w]));
  for (const w of words) {
    const forms = [w.written, w.reading, ...w.otherForms];
    kanaForms.set(w.id, new Set([w.reading, ...forms.filter((f) => KANA_ONLY.test(f))]));
    for (const f of forms) byForm.set(f, [...(byForm.get(f) ?? []), w]);
  }
  const resolve = (t: TanakaToken): SentenceWord | undefined => {
    const exact = t.jmdictId && byId.get(t.jmdictId);
    if (exact) return exact;
    let candidates = byForm.get(t.head) ?? [];
    if (t.reading) {
      const reading = t.reading;
      candidates = candidates.filter((w) => kanaForms.get(w.id)!.has(reading) || kanaForms.get(w.id)!.has(toKatakana(reading)));
    }
    // Several entries share a spelling: the most common one is the likeliest.
    return candidates.reduce<SentenceWord | undefined>((best, w) => (!best || w.priority < best.priority ? w : best), undefined);
  };

  const linked = new Map<string, LinkedSentence>();
  const candidates = new Map<string, SentenceLink[]>();
  const addCandidate = (link: SentenceLink) => {
    const list = candidates.get(link.wordId) ?? [];
    if (!list.some((l) => l.sentenceId === link.sentenceId)) list.push(link);
    candidates.set(link.wordId, list);
  };

  for (const p of pairs) {
    const kanjiWords = new Set<string>();
    let unlisted = 0;
    for (const t of p.tokens) {
      const w = resolve(t);
      if (!w) {
        if (HAN.test(t.head)) unlisted++;
        continue;
      }
      if (HAN.test(w.written) && !w.usuallyKana) kanjiWords.add(w.id);
      // The index sometimes names a word the text doesn't spell out (今日 for いい日ですね): not an example of it.
      const form = t.form ?? t.head;
      if (p.japanese.includes(form)) addCandidate({ wordId: w.id, sentenceId: p.id, form, checked: t.checked });
    }
    linked.set(p.id, { id: p.id, japanese: p.japanese, english: p.english, kanjiWords: [...kanjiWords], unlisted });
  }

  for (const w of words) {
    if (candidates.has(w.id) || [...w.written].length < 2 || !HAN.test(w.written)) continue;
    for (const p of pairs) if (p.japanese.includes(w.written)) addCandidate({ wordId: w.id, sentenceId: p.id, form: w.written, checked: false });
  }

  const length = (id: string) => [...linked.get(id)!.japanese].length;
  const links: SentenceLink[] = [];
  for (const list of candidates.values()) {
    list.sort((a, b) => Number(b.checked) - Number(a.checked) || length(a.sentenceId) - length(b.sentenceId) || a.sentenceId.localeCompare(b.sentenceId));
    links.push(...list.slice(0, perWord));
  }
  const used = new Set(links.map((l) => l.sentenceId));
  return { sentences: [...linked.values()].filter((s) => used.has(s.id)), links };
}
