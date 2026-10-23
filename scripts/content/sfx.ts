// The SFX dictionary (content.db sfx_words / sfx_keys): JMdict's sound and
// mimetic words (tagged on-mim), plus manga sound effects JMdict doesn't have,
// written for Koihongo. Indexed by the same loose key marks use (textKey), so
// a box marked ドキッ finds どきっと and, as related, どきどき.

import { textKey } from "../../src/textKey.ts";

export type SfxKey = { key: string; loose: boolean };

/**
 * The keys a sound word is found by: its own; without the adverb's と
 * (にこっと → ニコッ); and, as related, half of a doubled word (どきどき → ドキッ).
 */
export function sfxKeys(form: string): SfxKey[] {
  const keys = new Map<string, boolean>();
  const add = (key: string, loose: boolean) => {
    if (key && !(keys.has(key) && !keys.get(key))) keys.set(key, loose);
  };
  const own = textKey(form, "sfx");
  add(own, false);
  if (/[とり]$/.test(form) && [...form].length > 2) add(textKey(form.slice(0, -1), "sfx"), false);
  for (const k of [...keys.keys()]) {
    const half = k.length / 2;
    if (k.length % 2 === 0 && half >= 2 && k.slice(0, half) === k.slice(half)) add(k.slice(0, half), true);
  }
  return [...keys].map(([key, loose]) => ({ key, loose }));
}

/**
 * Manga sound effects that JMdict doesn't list (or lists only in a form the
 * keys can't reach), with what they usually mean on the page. Own wording.
 */
export const SFX_EXTRAS: [form: string, meaning: string][] = [
  ["ゴゴゴ", "menacing rumble: ominous pressure, tension or a threatening presence building"],
  ["ドドド", "thundering rumble: something powerful charging in, or an overwhelming presence"],
  ["ドゴォ", "a massive impact or explosion"],
  ["ドワッ", "a sudden burst: a crowd erupting, a rush of emotion or tears"],
  ["ゴォ", "roar: wind, flames, an engine or a powerful aura"],
  ["ゴォォ", "roar: wind, flames, an engine or a powerful aura"],
  ["ババーン", "ta-da!: a dramatic reveal or a showy entrance"],
  ["ジャジャーン", "ta-da!: presenting something with a flourish"],
  ["キラーン", "gleam: a sparkle in someone's eye, light flashing off glasses or a blade"],
  ["サッ", "swiftly, in a flash: a quick movement (dodging, hiding, whipping something out)"],
  ["タッタッ", "light, quick running footsteps"],
  ["ザシュ", "slash: a blade cutting through"],
  ["ジャキッ", "clack: readying a weapon or a blade"],
  ["チャキ", "click: a sword or gun being readied"],
  ["スチャ", "smoothly putting something on or drawing it (glasses, a weapon)"],
  ["ブチッ", "snap: losing one's temper; also something tearing off"],
  ["ウルッ", "eyes welling up with tears"],
  ["カァッ", "face flushing red (embarrassment or anger); also a crow's caw"],
  ["ズキュン", "heart struck: being suddenly smitten"],
  ["トクン", "a single soft heartbeat: quiet, tender feelings"],
  ["ゾゾッ", "a shiver of dread or disgust running down the spine"],
  ["パァ", "brightening up: a face lighting up with joy, or light spreading"],
  ["パアッ", "brightening up: a face lighting up with joy, or light spreading"],
  ["ドヤァ", "a smug look: showing off, \"how about that?\""],
  ["テヘ", "a sheepish \"oops\" giggle (often with the tongue out)"],
  ["ルンルン", "happily humming along, in a cheerful mood"],
  ["ウキウキ", "excited and cheerful, light-hearted"],
  ["ポワーン", "a dreamy, floaty feeling; happily spacing out"],
  ["ムニュ", "squish: pressing into something soft"],
  ["ピト", "gently touching or snuggling up against someone"],
  ["ヒック", "a hiccup; a sob catching in the throat"],
  ["ゼーハー", "gasping for breath after running or exertion"],
  ["ぐぅ", "a stomach growling; or a strangled sound of being beaten in an argument"],
  ["ヒィ", "eek: a frightened squeak"],
  ["ウッ", "ugh: a pained or choked grunt (hurt, queasy, or caught off guard)"],
  ["シーッ", "shh!: telling someone to be quiet"],
  ["ズコー", "a comedy pratfall: falling over at something absurd"],
  ["ピロン", "a notification chime (a message arriving)"],
  ["プルルル", "a phone ringing"],
  ["ジリリリ", "an alarm clock or old phone bell ringing"],
];

/** One SFX dictionary entry: its kana forms (the first is shown), its meanings, and how common it is. */
export type SfxWord = { forms: string[]; meanings: string[]; source: "jmdict" | "koihongo"; rank: number };

type JmdictSfx = {
  id: string;
  kana: { text: string }[];
  sense: { misc: string[]; gloss: { text: string }[] }[];
};

/** JMdict's sound and mimetic words (only their on-mim senses), then the extras. */
export function sfxWords(jmdict: JmdictSfx[], priority: (id: string) => number): SfxWord[] {
  const words: SfxWord[] = SFX_EXTRAS.map(([form, meaning]) => ({ forms: [form], meanings: [meaning], source: "koihongo", rank: 0 }));
  for (const w of jmdict) {
    const meanings = w.sense.filter((s) => s.misc.includes("on-mim")).map((s) => s.gloss.map((g) => g.text).join("; "));
    if (meanings.length === 0 || w.kana.length === 0) continue;
    words.push({ forms: w.kana.map((k) => k.text), meanings, source: "jmdict", rank: priority(w.id) });
  }
  return words;
}
