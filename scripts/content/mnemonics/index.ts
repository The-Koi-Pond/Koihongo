// Koihongo's own default mnemonics, written in batches. Learners see these
// until they write or pick their own. Keys are path item keys.

import { HIRAGANA_BASIC } from "./hiragana-basic.ts";
import { KATAKANA_BASIC } from "./katakana-basic.ts";

export type MnemonicBatch = Record<string, { meaning?: string; reading?: string }>;

const BATCHES: MnemonicBatch[] = [HIRAGANA_BASIC, KATAKANA_BASIC];

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
