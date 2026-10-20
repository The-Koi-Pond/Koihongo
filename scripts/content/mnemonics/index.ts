// Koihongo's own default mnemonics, written in batches. Learners see these
// until they write or pick their own. Keys are path item keys.

import { COMBOS } from "./combos.ts";
import { COMPONENTS_1 } from "./components-1.ts";
import { COMPONENTS_2 } from "./components-2.ts";
import { COMPONENTS_3 } from "./components-3.ts";
import { COMPONENTS_4 } from "./components-4.ts";
import { COMPONENTS_5 } from "./components-5.ts";
import { DAKUTEN } from "./dakuten.ts";
import { HIRAGANA_BASIC } from "./hiragana-basic.ts";
import { KANJI_1 } from "./kanji-1.ts";
import { KANJI_2 } from "./kanji-2.ts";
import { KANJI_3 } from "./kanji-3.ts";
import { KATAKANA_BASIC } from "./katakana-basic.ts";

export type MnemonicBatch = Record<string, { meaning?: string; reading?: string }>;

const BATCHES: MnemonicBatch[] = [HIRAGANA_BASIC, KATAKANA_BASIC, DAKUTEN, COMBOS, COMPONENTS_1, COMPONENTS_2, COMPONENTS_3, COMPONENTS_4, COMPONENTS_5, KANJI_1, KANJI_2, KANJI_3];

/** All batches merged; a key appearing in two batches is a mistake. */
export function allMnemonics(): MnemonicBatch {
  const all: MnemonicBatch = {};
  for (const batch of BATCHES) {
    for (const [key, m] of Object.entries(batch)) {
      if (all[key]) throw new Error(`Mnemonic for ${key} is defined twice`);
      all[key] = m;
    }
  }
  return all;
}
