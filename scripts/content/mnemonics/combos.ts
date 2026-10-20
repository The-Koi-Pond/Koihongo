// Batch 4: combination kana (きゃ, しゅ…) and the extended katakana for
// loanwords (ファ, ティ…). These are rules, not new shapes: a small kana
// replaces the vowel of the one before it, in one beat. Each mnemonic spells
// out its blend and, where there's one worth knowing, a word you'll meet.

import type { MnemonicBatch } from "./index.ts";

const SMALL: Record<string, string> = { ゃ: "YA", ゅ: "YU", ょ: "YO", ャ: "YA", ュ: "YU", ョ: "YO" };

/** きゃ: "き (KI) + small ゃ (YA) squeeze into one beat: KYA." plus an example word. */
function combo(kana: string, base: string, sound: string, word?: string) {
  const [first, small] = [...kana];
  const blend =
    sound.startsWith("SH") || sound.startsWith("CH") || sound.startsWith("J")
      ? `${first} (${base}) + small ${small} (${SMALL[small]}): drop the I and slide straight into the vowel, in one beat: ${sound}.`
      : `${first} (${base}) + small ${small} (${SMALL[small]}) squeeze into one beat: ${sound}, not \"${base.toLowerCase()}-${SMALL[small].toLowerCase()}\".`;
  return { reading: word ? `${blend} As in ${word}.` : blend };
}

/** Extended katakana: a small vowel bends the sound before it into one English never had a kana for. */
const ext = (text: string) => ({ reading: text });

export const COMBOS: MnemonicBatch = {
  "kana:きゃ": combo("きゃ", "KI", "KYA", "きゃく (guest)"),
  "kana:きゅ": combo("きゅ", "KI", "KYU", "きゅう (nine)"),
  "kana:きょ": combo("きょ", "KI", "KYO", "とうきょう (Tokyo)"),
  "kana:しゃ": combo("しゃ", "SHI", "SHA", "しゃしん (photo)"),
  "kana:しゅ": combo("しゅ", "SHI", "SHU", "しゅくだい (homework)"),
  "kana:しょ": combo("しょ", "SHI", "SHO", "しょうゆ (soy sauce)"),
  "kana:ちゃ": combo("ちゃ", "CHI", "CHA", "おちゃ (tea)"),
  "kana:ちゅ": combo("ちゅ", "CHI", "CHU", "ちゅうごく (China)"),
  "kana:ちょ": combo("ちょ", "CHI", "CHO", "ちょっと (a little)"),
  "kana:にゃ": combo("にゃ", "NI", "NYA", "にゃあ, a cat's meow"),
  "kana:にゅ": combo("にゅ", "NI", "NYU", "ぎゅうにゅう (milk)"),
  "kana:にょ": combo("にょ", "NI", "NYO", "にょろにょろ, the sound of something wriggling like a snake"),
  "kana:ひゃ": combo("ひゃ", "HI", "HYA", "ひゃく (hundred)"),
  "kana:ひゅ": combo("ひゅ", "HI", "HYU", "ひゅう, the whoosh of the wind"),
  "kana:ひょ": combo("ひょ", "HI", "HYO", "ひょう (chart; also hail)"),
  "kana:みゃ": combo("みゃ", "MI", "MYA", "みゃく (pulse)"),
  "kana:みゅ": combo("みゅ", "MI", "MYU"),
  "kana:みょ": combo("みょ", "MI", "MYO", "みょうじ (family name)"),
  "kana:りゃ": combo("りゃ", "RI", "RYA", "りゃく (abbreviation)"),
  "kana:りゅ": combo("りゅ", "RI", "RYU", "りゅう (dragon)"),
  "kana:りょ": combo("りょ", "RI", "RYO", "りょこう (travel)"),
  "kana:ぎゃ": combo("ぎゃ", "GI", "GYA", "ぎゃく (reverse)"),
  "kana:ぎゅ": combo("ぎゅ", "GI", "GYU", "ぎゅう (beef), as in ぎゅうどん, a beef rice bowl"),
  "kana:ぎょ": combo("ぎょ", "GI", "GYO", "きんぎょ (goldfish)"),
  "kana:じゃ": combo("じゃ", "JI", "JA", "じゃあね (see ya)"),
  "kana:じゅ": combo("じゅ", "JI", "JU", "じゅう (ten)"),
  "kana:じょ": combo("じょ", "JI", "JO", "じょうず (skilled)"),
  "kana:びゃ": combo("びゃ", "BI", "BYA"),
  "kana:びゅ": combo("びゅ", "BI", "BYU"),
  "kana:びょ": combo("びょ", "BI", "BYO", "びょういん (hospital)"),
  "kana:ぴゃ": combo("ぴゃ", "PI", "PYA"),
  "kana:ぴゅ": combo("ぴゅ", "PI", "PYU"),
  "kana:ぴょ": combo("ぴょ", "PI", "PYO", "ぴょんぴょん, the sound of hopping"),

  "kana:キャ": combo("キャ", "KI", "KYA", "キャンディー (candy)"),
  "kana:キュ": combo("キュ", "KI", "KYU", "キュート (cute)"),
  "kana:キョ": combo("キョ", "KI", "KYO"),
  "kana:シャ": combo("シャ", "SHI", "SHA", "シャツ (shirt)"),
  "kana:シュ": combo("シュ", "SHI", "SHU", "シュート (a shot at goal)"),
  "kana:ショ": combo("ショ", "SHI", "SHO", "ショップ (shop)"),
  "kana:チャ": combo("チャ", "CHI", "CHA", "チャンス (chance)"),
  "kana:チュ": combo("チュ", "CHI", "CHU", "チューリップ (tulip)"),
  "kana:チョ": combo("チョ", "CHI", "CHO", "チョコ (chocolate)"),
  "kana:ニャ": combo("ニャ", "NI", "NYA", "ニャー, a cat's meow in manga"),
  "kana:ニュ": combo("ニュ", "NI", "NYU", "ニュース (news)"),
  "kana:ニョ": combo("ニョ", "NI", "NYO"),
  "kana:ヒャ": combo("ヒャ", "HI", "HYA"),
  "kana:ヒュ": combo("ヒュ", "HI", "HYU", "ヒューマン (human)"),
  "kana:ヒョ": combo("ヒョ", "HI", "HYO"),
  "kana:ミャ": combo("ミャ", "MI", "MYA"),
  "kana:ミュ": combo("ミュ", "MI", "MYU", "ミュージック (music)"),
  "kana:ミョ": combo("ミョ", "MI", "MYO"),
  "kana:リャ": combo("リャ", "RI", "RYA"),
  "kana:リュ": combo("リュ", "RI", "RYU", "リュック (backpack)"),
  "kana:リョ": combo("リョ", "RI", "RYO"),
  "kana:ギャ": combo("ギャ", "GI", "GYA", "ギャル (gal, the flashy fashion style you see in anime)"),
  "kana:ギュ": combo("ギュ", "GI", "GYU"),
  "kana:ギョ": combo("ギョ", "GI", "GYO"),
  "kana:ジャ": combo("ジャ", "JI", "JA", "ジャンプ (jump)"),
  "kana:ジュ": combo("ジュ", "JI", "JU", "ジュース (juice)"),
  "kana:ジョ": combo("ジョ", "JI", "JO", "ジョーク (joke)"),
  "kana:ビャ": combo("ビャ", "BI", "BYA"),
  "kana:ビュ": combo("ビュ", "BI", "BYU", "ビュッフェ (buffet)"),
  "kana:ビョ": combo("ビョ", "BI", "BYO"),
  "kana:ピャ": combo("ピャ", "PI", "PYA"),
  "kana:ピュ": combo("ピュ", "PI", "PYU", "ピュア (pure)"),
  "kana:ピョ": combo("ピョ", "PI", "PYO"),

  "kana:ファ": ext("フ (FU) + small ァ (A): keep the soft F, swap the vowel: FA. As in ファン (fan)."),
  "kana:フィ": ext("フ (FU) + small ィ (I): keep the soft F, swap the vowel: FI. As in フィギュア (figure), like anime figures."),
  "kana:フェ": ext("フ (FU) + small ェ (E): keep the soft F, swap the vowel: FE. As in カフェ (café)."),
  "kana:フォ": ext("フ (FU) + small ォ (O): keep the soft F, swap the vowel: FO. As in フォーク (fork)."),
  "kana:ティ": ext("テ (TE) + small ィ (I): a T sound Japanese didn't have (チ is CHI): TI. As in パーティー (party)."),
  "kana:ディ": ext("デ (DE) + small ィ (I): a D sound Japanese didn't have (ぢ is JI): DI. As in ディナー (dinner)."),
  "kana:トゥ": ext("ト (TO) + small ゥ (U): a T sound Japanese didn't have (ツ is TSU): TU. As in タトゥー (tattoo)."),
  "kana:ドゥ": ext("ド (DO) + small ゥ (U): a D sound Japanese didn't have: DU. You'll rarely see it."),
  "kana:ウィ": ext("ウ (U) + small ィ (I): slide from U into I, in one beat: WI. As in ウィンター (winter)."),
  "kana:ウェ": ext("ウ (U) + small ェ (E): slide from U into E, in one beat: WE. As in ウェブ (web)."),
  "kana:ウォ": ext("ウ (U) + small ォ (O): slide from U into O, in one beat: WO. As in ウォーキング (walking)."),
  "kana:ヴ": ext("ウ with ゛: the sound V, which Japanese doesn't have, for loanwords (VU). Most people say it like ブ (bu), and many words just use the バ row instead: バイオリン (violin)."),
  "kana:シェ": ext("シ (SHI) + small ェ (E): drop the I and slide into E: SHE. As in シェフ (chef)."),
  "kana:ジェ": ext("ジ (JI) + small ェ (E): drop the I and slide into E: JE. As in ジェット (jet)."),
  "kana:チェ": ext("チ (CHI) + small ェ (E): drop the I and slide into E: CHE. As in チェック (check)."),
  "kana:ツァ": ext("ツ (TSU) + small ァ (A): keep the TS, swap the vowel: TSA. As in モーツァルト (Mozart)."),
};
