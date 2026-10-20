// "Sounds like" hints for kana, written for English speakers: one line per sound.
// Each sound gets an English word with the whole matching syllable highlighted
// (か → "[ca]lm"), or, where no fair English word exists, a respelling to say
// in one beat. Longer advice goes in `tip`, shown behind an ⓘ.
//
// Words are picked so the highlighted part sounds the same in US and UK English
// (no "car", where only some accents drop the r).

export type SoundHint = {
  /** An English word with the matching syllable highlighted: ["", "ca", "lm"]. */
  word?: [before: string, sound: string, after: string];
  /** A respelling to say in one beat, when there's no good English word: "kyah". */
  say?: string;
  /** Extra advice for sounds English doesn't have, or spells differently. */
  tip?: string;
};

const R_TIP = "The Japanese r is one light tap of the tongue, like the tt in American “butter”: between r, l and d.";
const COMBO_TIP = "One beat, not two: the small ゃ/ゅ/ょ blends in, so it's “kyah”, not “kee-yah”.";
const O_TIP = "Short and pure: don't let it slide into a “w” the way English “oh” does.";
const U_TIP = "Short, with relaxed lips: less rounded than English “oo”.";

const w = (before: string, sound: string, after: string): SoundHint["word"] => [before, sound, after];

const HINTS: Record<string, SoundHint> = {
  a: { word: w("f", "a", "ther") },
  i: { word: w("", "ea", "sy") },
  u: { word: w("f", "oo", "d"), tip: U_TIP },
  e: { word: w("", "e", "gg") },
  o: { word: w("", "o", "h"), tip: O_TIP },

  ka: { word: w("", "ca", "lm") },
  ki: { word: w("", "key", "") },
  ku: { word: w("", "coo", "l"), tip: U_TIP },
  ke: { word: w("", "ke", "tchup") },
  ko: { word: w("", "co", "ld"), tip: O_TIP },

  sa: { word: w("", "sa", "lsa") },
  shi: { word: w("", "she", "") },
  su: { word: w("", "Sue", ""), tip: U_TIP },
  se: { word: w("", "se", "t") },
  so: { word: w("", "so", "da"), tip: O_TIP },

  ta: { word: w("", "ta", "co") },
  chi: { word: w("", "chee", "se") },
  tsu: { word: w("", "tsu", "nami"), tip: "Start with the “ts” at the end of “cats”: English speakers often drop the t at the start of a word." },
  te: { word: w("", "te", "nnis") },
  to: { word: w("", "to", "tal"), tip: O_TIP },

  na: { word: w("", "na", "cho") },
  ni: { word: w("", "knee", "") },
  nu: { word: w("", "noo", "dle"), tip: U_TIP },
  ne: { word: w("", "ne", "t") },
  no: { word: w("", "no", "te"), tip: O_TIP },

  ha: { word: w("", "ha", " ha") },
  hi: { word: w("", "hee", " hee") },
  fu: { word: w("", "foo", "d"), tip: "A soft f, between f and h: blow gently, like cooling soup, without your top teeth touching your lip." },
  he: { word: w("", "he", "lp") },
  ho: { word: w("", "ho", "tel"), tip: O_TIP },

  ma: { word: w("", "ma", "ma") },
  mi: { word: w("", "me", "") },
  mu: { word: w("", "moo", "n"), tip: U_TIP },
  me: { word: w("", "me", "lon") },
  mo: { word: w("", "mo", "tel"), tip: O_TIP },

  ya: { word: w("", "ya", "hoo") },
  yu: { word: w("", "you", "") },
  yo: { word: w("", "yo", "-yo"), tip: O_TIP },

  ra: { word: w("", "ra", "men"), tip: R_TIP },
  ri: { word: w("", "ree", "f"), tip: R_TIP },
  ru: { word: w("", "roo", "f"), tip: R_TIP },
  re: { word: w("", "re", "d"), tip: R_TIP },
  ro: { word: w("", "ro", "bot"), tip: R_TIP },

  wa: { word: w("", "wa", "sabi") },
  wo: { word: w("", "o", "h"), tip: "Said just like お (o). It's almost only used as the object particle." },
  n: { word: w("su", "n", ""), tip: "A nasal n that can stand alone as its own beat. Before b, p or m it sounds like m; before k or g, like the “ng” in “sing”." },

  ga: { word: w("", "Ga", "ga") },
  gi: { word: w("", "gee", "se") },
  gu: { word: w("", "goo", "se"), tip: U_TIP },
  ge: { word: w("", "ge", "t") },
  go: { word: w("", "go", "al"), tip: O_TIP },

  za: { word: w("ba", "za", "ar") },
  ji: { word: w("", "jee", "p"), tip: "じ and ぢ sound the same; じ is the one you'll usually see." },
  zu: { word: w("", "zoo", ""), tip: "ず and づ sound the same; ず is the one you'll usually see." },
  ze: { word: w("", "Ze", "n") },
  zo: { word: w("", "zo", "ne"), tip: O_TIP },

  da: { word: w("Pra", "da", "") },
  de: { word: w("", "de", "sk") },
  do: { word: w("", "do", "nut"), tip: O_TIP },

  ba: { word: w("", "ba", "h humbug") },
  bi: { word: w("", "bee", "") },
  bu: { word: w("", "boo", "t"), tip: U_TIP },
  be: { word: w("", "be", "d") },
  bo: { word: w("", "bo", "ne"), tip: O_TIP },

  pa: { word: w("", "pa", "sta") },
  pi: { word: w("", "pea", "") },
  pu: { word: w("", "poo", "l"), tip: U_TIP },
  pe: { word: w("", "pe", "n") },
  po: { word: w("", "po", "ny"), tip: O_TIP },

  kya: { say: "kyah", tip: COMBO_TIP },
  kyu: { word: w("", "cu", "te") },
  kyo: { word: w("To", "kyo", "") },
  sha: { word: w("", "Sha", "h") },
  shu: { word: w("", "shoe", "") },
  sho: { word: w("", "sho", "w"), tip: O_TIP },
  cha: { word: w("", "cha", "-cha") },
  chu: { word: w("", "choo", "-choo") },
  cho: { word: w("", "cho", "ke"), tip: O_TIP },
  nya: { say: "nyah", tip: COMBO_TIP },
  nyu: { say: "nyoo", tip: COMBO_TIP },
  nyo: { say: "nyoh", tip: COMBO_TIP },
  hya: { say: "hyah", tip: COMBO_TIP },
  hyu: { word: w("", "hu", "ge") },
  hyo: { say: "hyoh", tip: COMBO_TIP },
  mya: { say: "myah", tip: COMBO_TIP },
  myu: { word: w("", "mu", "sic") },
  myo: { say: "myoh", tip: COMBO_TIP },
  rya: { say: "ryah", tip: `${COMBO_TIP} ${R_TIP}` },
  ryu: { say: "ryoo", tip: `${COMBO_TIP} ${R_TIP}` },
  ryo: { say: "ryoh", tip: `${COMBO_TIP} ${R_TIP}` },
  gya: { say: "gyah", tip: COMBO_TIP },
  gyu: { word: w("ar", "gue", "") },
  gyo: { say: "gyoh", tip: COMBO_TIP },
  ja: { word: w("", "Ja", "va") },
  ju: { word: w("", "Ju", "ne") },
  jo: { word: w("", "jo", "ke"), tip: O_TIP },
  bya: { say: "byah", tip: COMBO_TIP },
  byu: { word: w("", "beau", "ty") },
  byo: { say: "byoh", tip: COMBO_TIP },
  pya: { say: "pyah", tip: COMBO_TIP },
  pyu: { word: w("", "pew", "") },
  pyo: { say: "pyoh", tip: COMBO_TIP },

  // Katakana-only sounds, for loanwords.
  fa: { word: w("", "fa", "ther"), tip: "The same soft f as ふ." },
  fi: { word: w("", "fee", "") },
  fe: { word: w("", "fe", "d") },
  fo: { word: w("", "fo", "cus"), tip: O_TIP },
  ti: { word: w("", "tea", "") },
  di: { word: w("", "dee", "p") },
  tu: { word: w("", "two", "") },
  du: { word: w("", "do", "") },
  wi: { word: w("", "wee", "k") },
  we: { word: w("", "we", "t") },
  vu: { word: w("", "voo", "doo"), tip: "Often just said like ブ (bu)." },
  she: { word: w("", "she", "d") },
  je: { word: w("", "je", "t") },
  che: { word: w("", "che", "ck") },
  tsa: { word: w("pi", "zza", ""), tip: "The “ts” of “cats”, then “ah”." },
};

/** The one-line hint for a kana's romaji. */
export function soundHint(romaji: string): SoundHint {
  return HINTS[romaji] ?? { say: romaji };
}

/** Every romaji with a hand-written hint (for tests). */
export const HINTED = Object.keys(HINTS);
