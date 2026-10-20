// Checks typed answers. Meanings forgive small typos; readings must be exact
// (a one-letter slip in kana is a different word).

import { isKana, isRomaji, toHiragana, toKana } from "wanakana";

export type Verdict =
  /** Right (possibly with a small typo, see `typo`). */
  | { result: "correct"; typo: boolean }
  | { result: "wrong" }
  /** Not graded: e.g. typed the reading when the meaning was asked. Try again. */
  | { result: "retry"; message: string };

/** Lowercase, drop "(notes)", punctuation and leading "to "/"a "/"the ". */
export function meaningKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}' -]/gu, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(to|a|an|the) /, "");
}

/** Readings as typed answers: hiragana, no "-" markers; "た.べる" accepts "たべる" and "た". */
export function readingKeys(reading: string): string[] {
  const clean = toHiragana(reading.replace(/-/g, ""), { passRomaji: true });
  const [stem] = clean.split(".");
  return [...new Set([clean.replace(/\./g, ""), stem])].filter(Boolean);
}

export function allowedTypos(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return 3;
}

export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function checkMeaning(answer: string, meanings: string[], readings: string[]): Verdict {
  const key = meaningKey(answer);
  if (!key) return { result: "retry", message: "Type a meaning in English." };
  const accepted = meanings.map(meaningKey).filter(Boolean);
  if (accepted.includes(key)) return { result: "correct", typo: false };

  // Typed the reading in romaji ("ki" for 木)? Point it out instead of failing.
  if (isRomaji(answer.trim()) && readings.flatMap(readingKeys).includes(toHiragana(toKana(answer.trim().toLowerCase())))) {
    return { result: "retry", message: "That's the reading. What does it mean?" };
  }
  if (accepted.some((m) => editDistance(key, m) <= allowedTypos(m.length))) return { result: "correct", typo: true };
  return { result: "wrong" };
}

export function checkReading(answer: string, readings: string[]): Verdict {
  const typed = toHiragana(toKana(answer.trim()), { passRomaji: true });
  if (!typed) return { result: "retry", message: "Type the reading." };
  if (!isKana(typed)) return { result: "retry", message: "Type the reading in kana (romaji turns into kana as you type)." };
  return readings.flatMap(readingKeys).includes(typed) ? { result: "correct", typo: false } : { result: "wrong" };
}
