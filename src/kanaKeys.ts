// The on-screen kana keyboard's logic: the chart it shows, and how ゛, ゜ and
// 小 change the kana just before the cursor. No React here, so it's testable.

import { toHiragana, toKatakana } from "wanakana";

/**
 * The gojūon chart, right to left like a printed chart: each column is one
 * consonant row (あ, か, さ…), top to bottom by vowel (a, i, u, e, o). Empty
 * strings are gaps (や and わ have no i or e sound).
 */
export const CHART: string[][] = [
  ["わ", "を", "ん", "", "ー"],
  ["ら", "り", "る", "れ", "ろ"],
  ["や", "", "ゆ", "", "よ"],
  ["ま", "み", "む", "め", "も"],
  ["は", "ひ", "ふ", "へ", "ほ"],
  ["な", "に", "ぬ", "ね", "の"],
  ["た", "ち", "つ", "て", "と"],
  ["さ", "し", "す", "せ", "そ"],
  ["か", "き", "く", "け", "こ"],
  ["あ", "い", "う", "え", "お"],
];

export type Mark = "dakuten" | "handakuten" | "small";

// Pairs of [plain, changed], in hiragana; pressing the key again turns it back.
const PAIRS: Record<Mark, [string, string][]> = {
  dakuten: [
    ..."かきくけこさしすせそたちつてとはひふへほ".split("").map((c): [string, string] => [c, String.fromCharCode(c.charCodeAt(0) + 1)]),
    ["う", "ゔ"],
    ["ぱ", "ば"], ["ぴ", "び"], ["ぷ", "ぶ"], ["ぺ", "べ"], ["ぽ", "ぼ"],
  ],
  handakuten: [
    ..."はひふへほ".split("").map((c): [string, string] => [c, String.fromCharCode(c.charCodeAt(0) + 2)]),
    ["ば", "ぱ"], ["び", "ぴ"], ["ぶ", "ぷ"], ["べ", "ぺ"], ["ぼ", "ぽ"],
  ],
  small: [
    ["あ", "ぁ"], ["い", "ぃ"], ["う", "ぅ"], ["え", "ぇ"], ["お", "ぉ"],
    ["や", "ゃ"], ["ゆ", "ゅ"], ["よ", "ょ"], ["つ", "っ"], ["わ", "ゎ"],
  ],
};

/**
 * The kana with ゛, ゜ or 小 applied (か + ゛ → が, は + ゜ → ぱ, つ + 小 → っ),
 * or toggled back if it already has it (が + ゛ → か). Katakana stays katakana.
 * Returns null if the mark doesn't apply to it.
 */
export function applyMark(kana: string, mark: Mark): string | null {
  if (kana.length !== 1) return null;
  const hira = toHiragana(kana);
  // ゔ has no hiragana of its own in wanakana's eyes; keep it as typed.
  const katakana = hira !== kana || kana === "ヴ";
  const base = kana === "ヴ" ? "ゔ" : hira;
  // Add the mark if it's a plain kana (ぱ counts as plain for ゛: ぱ → ば), else take it off (が → か).
  const out = PAIRS[mark].find(([plain]) => plain === base)?.[1] ?? PAIRS[mark].find(([, changed]) => changed === base)?.[0];
  if (!out) return null;
  return katakana ? (out === "ゔ" ? "ヴ" : toKatakana(out)) : out;
}

/** A chart key's output: the kana itself, or its katakana. */
export const keyText = (kana: string, katakana: boolean) => (katakana ? toKatakana(kana) : kana);
