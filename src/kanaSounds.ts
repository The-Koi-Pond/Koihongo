// "Sounds like" hints for kana, written for English speakers.

export type SoundHint = {
  /** An English word with the matching sound highlighted: ["f", "a", "ther"]. */
  asIn?: [before: string, sound: string, after: string];
  /** Extra advice for sounds English doesn't have, or spells differently. */
  note?: string;
};

const VOWELS: Record<string, SoundHint["asIn"]> = {
  a: ["f", "a", "ther"],
  i: ["mach", "i", "ne"],
  u: ["p", "u", "t"],
  e: ["b", "e", "d"],
  o: ["g", "o", ""],
};

// Whole-syllable hints where the consonant isn't what English spelling suggests.
const SPECIAL: Record<string, SoundHint> = {
  shi: { asIn: ["", "she", ""] },
  chi: { asIn: ["", "chee", "se"] },
  tsu: { asIn: ["ca", "ts", ""], note: "The “ts” of cats, at the start of the sound." },
  fu: { note: "Between “f” and “h”: blow gently without your lips touching your teeth." },
  ji: { asIn: ["", "jee", "p"] },
  zu: { asIn: ["", "zoo", ""], note: "ず and づ sound the same." },
  wo: { asIn: ["g", "o", ""], note: "Pronounced like お (o). Almost only used as a grammar particle." },
  n: { note: "A nasal “n”. Before b, p or m it sounds like “m”; before k or g like the “ng” in sing." },
};

/** Hint for a kana's romaji: a special-case whole syllable, else the vowel (plus r-row advice). */
export function soundHint(romaji: string): SoundHint {
  if (SPECIAL[romaji]) return SPECIAL[romaji];
  const vowel = VOWELS[romaji.at(-1) ?? ""];
  const hint: SoundHint = { asIn: vowel };
  if (romaji.startsWith("r")) hint.note = "The r is a light tap of the tongue, between an English r, l and d.";
  else if (romaji.length > 1) hint.note = `“${romaji.slice(0, -1)}” as in English, then the vowel.`;
  return hint;
}
