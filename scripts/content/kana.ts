// Hiragana and katakana for the kana track, in teaching order.
// Romaji is Hepburn; `accept` lists extra answers wanakana can't derive
// (see src/srs/answers.ts checkKana).
//
// Basic kana are taught a row at a time. The rest (が, ぱ, きゃ, ファ…) aren't
// items of their own: they're the examples of a few rules (か→が: ゛ turns K
// into G…), each a single item whose reviews ask a random example. They stay
// in the kana table for their romaji, stroke order and hint.

import { toHiragana, toKatakana, toRomaji } from "wanakana";

export type KanaGroup = "basic" | "dakuten" | "combo" | "extended";
export type Script = "hiragana" | "katakana";

export type Kana = {
  /** The kana, or a rule's label (か→が). */
  character: string;
  /** Hepburn romaji; for a rule, what it does ("k→g, s→z, t→d, h→b"). */
  romaji: string;
  accept: string[];
  script: Script;
  group: KanaGroup;
  /** The same sound (or rule) in the other script (あ ↔ ア); null for extended katakana. */
  counterpart: string | null;
  /** Rules only: the kana it covers, asked at random in reviews. */
  examples: string[] | null;
};

/** An item on the kana track: what must pass first, and its lesson round (taught together). */
export type KanaTrackItem = { character: string; requires: string[]; round: number };

// Rows taught together. や ゆ よ join わ を ん, so no round is split.
const BASIC = ["あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの", "はひふへほ", "まみむめも", "らりるれろ", "やゆよわをん"];
const DAKUTEN = ["がぎぐげご", "ざじずぜぞ", "だぢづでど", "ばびぶべぼ", "ぱぴぷぺぽ"];
const COMBO_BASES = ["き", "し", "ち", "に", "ひ", "み", "り", "ぎ", "じ", "び", "ぴ"];

// Answers people reasonably type that don't round-trip through wanakana.
const EXTRA_ACCEPT: Record<string, string[]> = { を: ["o"], ぢ: ["ji"], づ: ["zu"], ん: ["nn"] };

// Loanword sounds; wanakana's romaji for these is wrong (ファ → "fua").
const EXTENDED: [string, string][] = [
  ["ファ", "fa"],
  ["フィ", "fi"],
  ["フェ", "fe"],
  ["フォ", "fo"],
  ["ティ", "ti"],
  ["ディ", "di"],
  ["トゥ", "tu"],
  ["ドゥ", "du"],
  ["ウィ", "wi"],
  ["ウェ", "we"],
  ["ウォ", "wo"],
  ["ヴ", "vu"],
  ["シェ", "she"],
  ["ジェ", "je"],
  ["チェ", "che"],
  ["ツァ", "tsa"],
];

type Rule = { label: string; romaji: string; group: KanaGroup; examples: string[]; requires: string[] };

const chars = (rows: string[]) => rows.flatMap((row) => [...row]);
const COMBOS = COMBO_BASES.flatMap((base) => ["ゃ", "ゅ", "ょ"].map((small) => base + small));
/** The basic rows ゛ and ゜ go on. Both rules wait for all four, so they're taught together. */
const VOICED_BASES = chars(["かきくけこ", "さしすせそ", "たちつてと", "はひふへほ"]);

/** The hiragana rules, in teaching order (katakana's are the same in katakana). */
const RULES: Rule[] = [
  { label: "か→が", romaji: "k→g, s→z, t→d, h→b", group: "dakuten", examples: chars(DAKUTEN.slice(0, 4)), requires: VOICED_BASES },
  { label: "は→ぱ", romaji: "h→p", group: "dakuten", examples: chars(DAKUTEN.slice(4)), requires: VOICED_BASES },
  // ぎゃ, じゃ… need ゛ and ゜ too.
  { label: "き→きゃ", romaji: "-ya, -yu, -yo", group: "combo", examples: COMBOS, requires: [...COMBO_BASES.slice(0, 7), "か→が", "は→ぱ"] },
];
/** Katakana only: small ァィゥェォ (and ヴ) for loanword sounds. */
const EXTENDED_RULE: Rule = {
  label: "フ→ファ",
  romaji: "fa, ti, wi, she…",
  group: "extended",
  examples: EXTENDED.map(([k]) => k),
  // ディ, ドゥ, ジェ and ヴ use ゛.
  requires: ["フ", "テ", "ト", "ウ", "シ", "チ", "ツ", "カ→ガ"],
};

/** A rule's label in katakana (か→が → カ→ガ). */
const ruleToKatakana = (s: string) => s.split("→").map((k) => toKatakana(k)).join("→");

function hiragana(): Omit<Kana, "counterpart">[] {
  const make = (character: string, group: KanaGroup) => ({
    character,
    romaji: toRomaji(character),
    accept: EXTRA_ACCEPT[character] ?? [],
    script: "hiragana" as const,
    group,
    examples: null,
  });
  return [
    ...BASIC.flatMap((row) => [...row].map((k) => make(k, "basic"))),
    ...DAKUTEN.flatMap((row) => [...row].map((k) => make(k, "dakuten"))),
    ...COMBOS.map((k) => make(k, "combo")),
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
  if (NO_EXAMPLE.has(kana.character) || kana.examples) return null;
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

/**
 * Every row for the kana table: hiragana (basic, dakuten, combos), katakana,
 * extended katakana, then the rules.
 */
export function allKana(): Kana[] {
  const hira = hiragana();
  const kata = hira.map((h) => ({ ...h, character: toKatakana(h.character), script: "katakana" as const }));
  const extended: Kana[] = EXTENDED.map(([character, romaji]) => ({
    character,
    romaji,
    accept: [],
    script: "katakana",
    group: "extended",
    counterpart: null,
    examples: null,
  }));
  const rule = (r: Rule, script: Script, counterpart: string | null): Kana => ({
    character: script === "hiragana" ? r.label : ruleToKatakana(r.label),
    romaji: r.romaji,
    accept: [],
    script,
    group: r.group,
    counterpart,
    examples: script === "hiragana" ? r.examples : r.examples.map((k) => toKatakana(k)),
  });
  return [
    ...hira.map((h) => ({ ...h, counterpart: toKatakana(h.character) })),
    ...kata.map((k) => ({ ...k, counterpart: toHiragana(k.character) })),
    ...extended,
    ...RULES.map((r) => rule(r, "hiragana", ruleToKatakana(r.label))),
    ...RULES.map((r) => rule(r, "katakana", r.label)),
    rule(EXTENDED_RULE, "katakana", null),
  ];
}

/**
 * The kana track in teaching order: basic hiragana a row per round, the
 * hiragana rules (゛ and ゜ together, then combos), the same in katakana, then
 * the extended rule.
 */
export function kanaTrack(): KanaTrackItem[] {
  const out: KanaTrackItem[] = [];
  let round = 0;
  const add = (items: { character: string; requires: string[] }[]) => {
    round++;
    for (const i of items) out.push({ ...i, round });
  };
  for (const script of ["hiragana", "katakana"] as const) {
    const k = (s: string) => (script === "hiragana" ? s : ruleToKatakana(s));
    for (const row of BASIC) add([...row].map((c) => ({ character: k(c), requires: [] })));
    const rule = (r: Rule) => ({ character: k(r.label), requires: r.requires.map(k) });
    add(RULES.filter((r) => r.group === "dakuten").map(rule));
    add(RULES.filter((r) => r.group === "combo").map(rule));
  }
  add([{ character: EXTENDED_RULE.label, requires: EXTENDED_RULE.requires }]);
  return out;
}
