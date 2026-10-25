// Batch 5: the kana rules. が, ぱ, きゃ and ファ aren't items of their own:
// each rule is one item, and its reviews ask a random kana it covers. Each
// mnemonic states the rule, its exceptions and a quick picture. The
// per-kana mnemonics in dakuten.ts and combos.ts show as hints on the rule's page.

import type { MnemonicBatch } from "./index.ts";

/** examples: "か→が (GA), …"; ji: じ; odd: "ぢ and づ"; same: "じ and ず". */
const dakuten = (examples: string, ji: string, odd: string, same: string) => ({
  reading:
    `Two little dashes, ゛ (ten-ten), make the sound buzz: K→G, S→Z, T→D, H→B. ${examples}. ` +
    `Watch out: ${ji} is JI, not "zi", and ${odd} sound just like ${same} (JI, ZU).`,
});
const handakuten = (row: string) => ({
  reading: `A little circle, ゜ (maru), puffs the H into a P, like blowing out a candle: ${row} (PA PI PU PE PO). It only ever goes on the H row.`,
});
const combos = (ki: string, sha: string, cha: string, ja: string) => ({
  reading:
    `A small ${ki.at(-1)} after an -I kana swaps its I for YA, YU or YO, in one beat: ${ki} (KYA), not "ki-ya". ` +
    `Watch the soft ones: ${sha} (SHA), ${cha} (CHA), ${ja} (JA).`,
});

export const RULES: MnemonicBatch = {
  "kana:か→が": dakuten("か→が (GA), さ→ざ (ZA), た→だ (DA), は→ば (BA)", "じ", "ぢ and づ", "じ and ず"),
  "kana:は→ぱ": handakuten("ぱ ぴ ぷ ぺ ぽ"),
  "kana:き→きゃ": combos("きゃ", "しゃ", "ちゃ", "じゃ"),
  "kana:カ→ガ": dakuten("カ→ガ (GA), サ→ザ (ZA), タ→ダ (DA), ハ→バ (BA)", "ジ", "ヂ and ヅ", "ジ and ズ"),
  "kana:ハ→パ": handakuten("パ ピ プ ペ ポ"),
  "kana:キ→キャ": combos("キャ", "シャ", "チャ", "ジャ"),
  "kana:フ→ファ": {
    reading:
      "Small ァ ィ ゥ ェ ォ swap the vowel of the kana before them, to spell sounds Japanese didn't have: フ+ァ = ファ (FA), テ+ィ = ティ (TI), ウ+ェ = ウェ (WE), シ+ェ = シェ (SHE). " +
      "And ウ with ゛ is ヴ (VU), a V for loanwords.",
  },
};
