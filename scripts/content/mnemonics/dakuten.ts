// Batch 3: the dakuten kana, hiragana and katakana. One rule covers them all:
// ゛ (two little dashes, "ten-ten") voices the sound, K→G, S→Z, T→D, H→B, and
// ゜ (a little circle, "maru") turns H into P. Each mnemonic adds a twist to
// the base kana's image from batches 1 and 2, then repeats its rule.

import type { MnemonicBatch } from "./index.ts";

const K = "゛ turns K into G.";
const S = "゛ turns S into Z.";
const T = "゛ turns T into D.";
const H = "゛ turns H into B.";
const P = "゜ turns H into P.";
const m = (text: string, rule: string) => ({ reading: `${text} ${rule}` });

export const DAKUTEN: MnemonicBatch = {
  "kana:が": m("The karate chop from か with two extra sparks: a GAsp of effort! (GA)", K),
  "kana:ぎ": m("The key from き with two gleams: the key to a GEEky treasure chest (GI).", K),
  "kana:ぐ": m("The cuckoo from く with two sweat drops: it's stuck in GOO (GU).", K),
  "kana:げ": m("The keg from け, fizzing over: GET a towel! (GE)", K),
  "kana:ご": m("The two koi from こ, splashing: GO, GO, GO! (GO)", K),

  "kana:ざ": m("The bowing samurai from さ, struck by two sparks: ZAP! (ZA)", S),
  "kana:じ": m("SHE (し) with two hair clips, saying \"JEEZ!\" (JI) Exception: SHI becomes JI, not \"zi\".", S),
  "kana:ず": m("The swing from す going so high it ZOOMs (ZU).", S),
  "kana:ぜ": m("The \"SAY what?!\" face from せ, now with two calm dots: total ZEN (ZE).", S),
  "kana:ぞ": m("The zigzag stitch from そ with two pins in it: ZOmbie stitches (ZO).", S),

  "kana:だ": m("The magician's た with two sparkles: ta-DA! (DA)", T),
  "kana:ぢ": m("The cheerleader from ち with two dashes. It sounds JI, just like じ, but it's rare: you'll almost always see じ (JI).", T),
  "kana:づ": m("The tsunami from つ with two dashes. It sounds ZU, just like ず, and shows up in only a few words, like つづく (to continue). Usually it's ず (ZU).", T),
  "kana:で": m("The hand from て with two ink spots: busy at your DEsk (DE).", T),
  "kana:ど": m("The toe from と, stubbed twice: DOH! (DO)", T),

  "kana:ば": m("The laughing person from は, holding two BAnanas (BA).", H),
  "kana:び": m("The sneaky grin from ひ, with two BEEs buzzing by (BI).", H),
  "kana:ぶ": m("Mount Fuji (ふ) with two BOOts climbing it (BU).", H),
  "kana:べ": m("The hill from へ with two BEds on top: nap time (BE).", H),
  "kana:ぼ": m("Santa from ほ, with two BOWs on his hat (BO).", H),

  "kana:ぱ": m("The laughing person from は, with a PArty balloon (PA).", P),
  "kana:ぴ": m("The sneaky grin from ひ, with a PEA stuck in its teeth (PI).", P),
  "kana:ぷ": m("Mount Fuji (ふ) blowing a little smoke ring: POOF! (PU)", P),
  "kana:ぺ": m("The hill from へ with a PEbble on top (PE).", P),
  "kana:ぽ": m("Santa from ほ, with a POMpom on his hat (PO).", P),

  "kana:ガ": m("The karate chop from カ with two extra sparks: \"GA!\" (GA)", K),
  "kana:ギ": m("The key from キ with two gleams: a GEEky treasure key (GI).", K),
  "kana:グ": m("The cuckoo from ク with two sweat drops: stuck in GOO (GU).", K),
  "kana:ゲ": m("The ketchup K from ケ, squirting two drops: GET a napkin! (GE)", K),
  "kana:ゴ": m("The koi tank from コ, splashing: GO, GO! (GO)", K),

  "kana:ザ": m("The sabre rack from サ, struck by two sparks: ZAP! (ZA)", S),
  "kana:ジ": m("SHE's smile from シ, with two extra winks: \"JEEZ!\" (JI) Exception: SHI becomes JI. Careful: ヅ is ツ (the falling drops) with ゛.", S),
  "kana:ズ": m("The sumo wrestler from ス, ZOOMing in with two drops of sweat (ZU).", S),
  "kana:ゼ": m("The mouth from セ with two calm dots: ZEN (ZE).", S),
  "kana:ゾ": m("The sewing needle from ソ with two pins: ZOmbie stitches (ZO).", S),

  "kana:ダ": m("The taco from タ with two sparkles: ta-DA! (DA)", T),
  "kana:ヂ": m("The cheerleader from チ with two dashes. It sounds JI, just like ジ, and it's very rare (JI).", T),
  "kana:ヅ": m("The falling drops from ツ with two dashes. It sounds ZU, just like ズ, and it's rare: ズ is the usual one (ZU).", T),
  "kana:デ": m("The telegraph pole from テ with two DEw drops (DE).", T),
  "kana:ド": m("The toe from ト, stubbed twice: DOH! (DO)", T),

  "kana:バ": m("The laughing mouth from ハ, with two BAnanas (BA).", H),
  "kana:ビ": m("The heel from ヒ, with two BEEs buzzing round it (BI).", H),
  "kana:ブ": m("The slope from フ, with two BOOts climbing it (BU).", H),
  "kana:ベ": m("The hill from ヘ with two BEds on top (BE).", H),
  "kana:ボ": m("The scarecrow from ホ, with two BOWs (BO).", H),

  "kana:パ": m("The laughing mouth from ハ, with a PArty balloon (PA).", P),
  "kana:ピ": m("The heel from ヒ, stepping on a PEA (PI).", P),
  "kana:プ": m("The slope from フ, puffing a little smoke ring: POOF! (PU)", P),
  "kana:ペ": m("The hill from ヘ with a PEbble on top (PE).", P),
  "kana:ポ": m("The scarecrow from ホ, with a POMpom on its hat (PO).", P),
};
