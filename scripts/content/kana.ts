// Hiragana and katakana for the kana track, in teaching order.
// Romaji is Hepburn; `accept` lists extra answers wanakana can't derive
// (see src/srs/answers.ts checkKana).

import { toHiragana, toKatakana, toRomaji } from "wanakana";

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

export type ExampleCandidate = { id: string; written: string; reading: string; otherForms: string[]; priority: number; isNoun: boolean };
/** The chosen word, and the spelling to show (ウナギ rather than 鰻). */
export type Example = { word: ExampleCandidate; form: string };

/**
 * Hand-picked friendly, concrete example words for the basic kana: [spelling to show, reading].
 * Looked up in JMdict's common words (main or alternative spelling); anything
 * not found falls back to the automatic pick.
 */
export const CURATED_EXAMPLES: Record<string, [string, string]> = {
  あ: ["雨", "あめ"], い: ["犬", "いぬ"], う: ["海", "うみ"], え: ["駅", "えき"], お: ["お茶", "おちゃ"],
  か: ["傘", "かさ"], き: ["切手", "きって"], く: ["靴", "くつ"], け: ["煙", "けむり"], こ: ["子供", "こども"],
  さ: ["魚", "さかな"], し: ["塩", "しお"], す: ["寿司", "すし"], せ: ["先生", "せんせい"], そ: ["空", "そら"],
  た: ["卵", "たまご"], ち: ["地図", "ちず"], つ: ["月", "つき"], て: ["手紙", "てがみ"], と: ["鳥", "とり"],
  な: ["夏", "なつ"], に: ["肉", "にく"], ぬ: ["布", "ぬの"], ね: ["猫", "ねこ"], の: ["喉", "のど"],
  は: ["花", "はな"], ひ: ["人", "ひと"], ふ: ["船", "ふね"], へ: ["部屋", "へや"], ほ: ["星", "ほし"],
  ま: ["窓", "まど"], み: ["水", "みず"], む: ["虫", "むし"], め: ["眼鏡", "めがね"], も: ["森", "もり"],
  や: ["山", "やま"], ゆ: ["雪", "ゆき"], よ: ["夜", "よる"],
  ら: ["来年", "らいねん"], り: ["林檎", "りんご"], る: ["留守", "るす"], れ: ["歴史", "れきし"], ろ: ["廊下", "ろうか"],
  わ: ["私", "わたし"],
  ア: ["アニメ", "アニメ"], イ: ["イギリス", "イギリス"], ウ: ["ウナギ", "ウナギ"], エ: ["エアコン", "エアコン"], オ: ["オレンジ", "オレンジ"],
  カ: ["カメラ", "カメラ"], キ: ["キロ", "キロ"], ク: ["クラス", "クラス"], ケ: ["ケーキ", "ケーキ"], コ: ["コーヒー", "コーヒー"],
  サ: ["サッカー", "サッカー"], シ: ["システム", "システム"], ス: ["スプーン", "スプーン"], セ: ["セーター", "セーター"], ソ: ["ソファ", "ソファ"],
  タ: ["タクシー", "タクシー"], チ: ["チーズ", "チーズ"], ツ: ["ツアー", "ツアー"], テ: ["テレビ", "テレビ"], ト: ["トイレ", "トイレ"],
  ナ: ["ナイフ", "ナイフ"], ネ: ["ネクタイ", "ネクタイ"], ノ: ["ノート", "ノート"],
  ハ: ["ハム", "ハム"], ヒ: ["ヒーター", "ヒーター"], フ: ["フランス", "フランス"], ヘ: ["ヘア", "ヘア"], ホ: ["ホテル", "ホテル"],
  マ: ["マスク", "マスク"], ミ: ["ミルク", "ミルク"], ム: ["ムード", "ムード"], メ: ["メール", "メール"], モ: ["モデル", "モデル"],
  ユ: ["ユーモア", "ユーモア"], ヨ: ["ヨーロッパ", "ヨーロッパ"],
  ラ: ["ラジオ", "ラジオ"], リ: ["リスト", "リスト"], ル: ["ルール", "ルール"], レ: ["レストラン", "レストラン"], ロ: ["ロボット", "ロボット"],
  ワ: ["ワイン", "ワイン"],
};

const NOT_JAPANESE = /[0-9０-９A-Za-zＡ-Ｚａ-ｚ]/;
const NO_EXAMPLE = new Set(["ん", "ン"]); // no ordinary word starts with ん

const SMALL = new Set([..."ゃゅょぁぃぅぇぉャュョァィゥェォ"]);
const KATAKANA_WORD = /^[\p{Script=Katakana}ー]+$/u;

/**
 * A common word that starts with the kana's sound, to show as an example.
 * Hiragana: the word's reading starts with it. Katakana: the word is written in
 * katakana and starts with it. Not when the kana is only the first half of a
 * combination (き in きょう). Prefers frequent, short nouns.
 */
export function pickExample(kana: Kana, words: ExampleCandidate[]): Example | null {
  if (NO_EXAMPLE.has(kana.character)) return null;
  const curated = CURATED_EXAMPLES[kana.character];
  if (curated) {
    const [form, reading] = curated;
    const hit = words.find(
      (w) => (w.written === form || w.otherForms.includes(form)) && toHiragana(w.reading) === toHiragana(reading),
    );
    if (hit) return { word: hit, form };
  }
  const startsWithSound = (text: string) => text.startsWith(kana.character) && !SMALL.has(text[kana.character.length]);
  const fits = (w: ExampleCandidate) =>
    !NOT_JAPANESE.test(w.written) &&
    (kana.script === "hiragana" ? startsWithSound(w.reading) : KATAKANA_WORD.test(w.written) && startsWithSound(w.written));
  const score = (w: ExampleCandidate) => w.priority + (w.isNoun ? 0 : 10) + Math.max(0, [...w.reading].length - 4) * 3;
  let best: ExampleCandidate | null = null;
  // The reading must be longer than the kana itself (き alone isn't an example of き).
  for (const w of words) if (fits(w) && w.reading.length > kana.character.length && (!best || score(w) < score(best))) best = w;
  return best && { word: best, form: best.written };
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
