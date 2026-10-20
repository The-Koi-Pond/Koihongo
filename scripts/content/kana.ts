// Hiragana and katakana for the kana track, in teaching order.
// Romaji is Hepburn; `accept` lists extra answers wanakana can't derive
// (see src/srs/answers.ts checkKana).

import { toKatakana, toRomaji } from "wanakana";

export type KanaGroup = "basic" | "dakuten" | "combo" | "extended";
export type Script = "hiragana" | "katakana";

export type Kana = {
  character: string;
  romaji: string;
  accept: string[];
  script: Script;
  group: KanaGroup;
  /** The same sound in the other script (あ ↔ ア); null for extended katakana. */
  counterpart: string | null;
  /** Kana that must pass first: が needs か, きゃ needs き. */
  requires: string[];
};

const BASIC = ["あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの", "はひふへほ", "まみむめも", "やゆよ", "らりるれろ", "わを", "ん"];
const DAKUTEN = ["がぎぐげご", "ざじずぜぞ", "だぢづでど", "ばびぶべぼ", "ぱぴぷぺぽ"];
const COMBO_BASES = ["き", "し", "ち", "に", "ひ", "み", "り", "ぎ", "じ", "び", "ぴ"];

// Answers people reasonably type that don't round-trip through wanakana.
const EXTRA_ACCEPT: Record<string, string[]> = { を: ["o"], ぢ: ["ji"], づ: ["zu"], ん: ["nn"] };

// Dakuten/handakuten kana → the plain kana they're built on.
const PLAIN: Record<string, string> = Object.fromEntries(
  DAKUTEN.flatMap((row) => [...row].map((k) => [k, String.fromCodePoint(k.codePointAt(0)! - (row.startsWith("ぱ") ? 2 : 1))])),
);

// Loanword sounds; wanakana's romaji for these is wrong (ファ → "fua").
const EXTENDED: [string, string, string][] = [
  ["ファ", "fa", "フ"],
  ["フィ", "fi", "フ"],
  ["フェ", "fe", "フ"],
  ["フォ", "fo", "フ"],
  ["ティ", "ti", "テ"],
  ["ディ", "di", "デ"],
  ["トゥ", "tu", "ト"],
  ["ドゥ", "du", "ド"],
  ["ウィ", "wi", "ウ"],
  ["ウェ", "we", "ウ"],
  ["ウォ", "wo", "ウ"],
  ["ヴ", "vu", "ウ"],
  ["シェ", "she", "シ"],
  ["ジェ", "je", "ジ"],
  ["チェ", "che", "チ"],
  ["ツァ", "tsa", "ツ"],
];

function hiragana(): Omit<Kana, "counterpart">[] {
  const make = (character: string, group: KanaGroup, requires: string[]) => ({
    character,
    romaji: toRomaji(character),
    accept: EXTRA_ACCEPT[character] ?? [],
    script: "hiragana" as const,
    group,
    requires,
  });
  return [
    ...BASIC.flatMap((row) => [...row].map((k) => make(k, "basic", []))),
    ...DAKUTEN.flatMap((row) => [...row].map((k) => make(k, "dakuten", [PLAIN[k]]))),
    ...COMBO_BASES.flatMap((base) => ["ゃ", "ゅ", "ょ"].map((small) => make(base + small, "combo", [base]))),
  ];
}

/** All kana in teaching order: hiragana (basic, dakuten, combos), then katakana, then extended katakana. */
export function allKana(): Kana[] {
  const hira = hiragana();
  const kata = hira.map((h) => ({
    ...h,
    character: toKatakana(h.character),
    script: "katakana" as const,
    requires: h.requires.map((r) => toKatakana(r)),
  }));
  const extended: Kana[] = EXTENDED.map(([character, romaji, base]) => ({
    character,
    romaji,
    accept: [],
    script: "katakana",
    group: "extended",
    counterpart: null,
    requires: [base],
  }));
  return [
    ...hira.map((h) => ({ ...h, counterpart: toKatakana(h.character) })),
    ...kata.map((k) => ({ ...k, counterpart: hira.find((h) => toKatakana(h.character) === k.character)!.character })),
    ...extended,
  ];
}
