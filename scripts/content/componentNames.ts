// Japanese names for components: what someone learning kanji in Japan calls
// the part (部首名 and the like), shown on component pages with what the name
// means. Mostly KANJIDIC2's radical names, looked up for the shape we show
// (氵, not its stand-in 汁) and checked by hand; plain kanji go by their
// everyday reading. A part with no common Japanese name gets none rather than
// a made-up one.

/** What we need from a KANJIDIC2 entry. */
export type KanjidicNames = { radicalNames: string[]; kun: string[]; on: string[] };

/**
 * Names to use instead of KANJIDIC's, or where it has none (keyed by the shape
 * shown). null: no common name.
 */
export const NAME_OVERRIDES: Record<string, string | null> = {
  // KANJIDIC's name is for another form of the part, or not the usual one.
  心: "こころ", // its りっしんべん is the 忄 form, a component of its own
  氵: "さんずい", // KANJIDIC: みず
  犭: "けものへん", // KANJIDIC also lists the katakana ケモノ
  罒: "あみがしら / よんかしら",
  丿: "の",
  // Shapes KANJIDIC has no name for.
  "⺅": "にんべん",
  "𠆢": "ひとやね",
  "⻌": "しんにょう / しんにゅう",
  艹: "くさかんむり",
  "⻏": "おおざと",
  "⻖": "こざとへん",
  "⺹": "おいかんむり / おいがしら",
  // Plain kanji whose everyday name isn't the reading our rule picks.
  一: "いち",
  二: "に",
  五: "ご",
  九: "きゅう",
  十: "じゅう",
  乙: "おつ",
  已: "すでに",
  勿: "なかれ",
  文: "ぶん",
  方: "ほう",
  止: "とめる",
  王: "おう",
  冊: "さつ",
  玄: "げん",
  生: "せい",
  疋: "ひき",
  示: "しめす",
  立: "たつ",
  羽: "はね",
  而: "しこうして",
  肉: "にく",
  自: "みずから",
  至: "いたる",
  行: "ぎょうがまえ / ゆきがまえ",
  見: "みる",
  角: "つの",
  言: "げん",
  走: "はしる",
  辛: "からい",
  奄: "えん",
  斉: "せい",
  齊: "せい",
  長: "ながい",
  門: "もん",
  非: "あらず",
  面: "めん",
  頁: "おおがい",
  飛: "とぶ",
  香: "かおり",
  高: "たかい",
  歯: "は",
  鬯: "ちょう",
  // No common name: the katakana-looking bits and strokes without one.
  ハ: null,
  マ: null,
  ユ: null,
  ヨ: null,
};

/**
 * What a special name means, or what the part is called where it sits (keyed
 * by the shape shown). Only for names worth explaining: a plain reading like
 * くち needs none.
 */
export const NAME_NOTES: Record<string, string> = {
  // Strokes and shapes named after what they look like.
  丿: "Named after the katakana ノ it looks like.",
  丶: "“Dot”.",
  亅: "“Flicked stick”: a stroke with a hook at the end.",
  丨: "“Stick”.",
  厶: "Named after the katakana ム it looks like.",
  冖: "“ワ crown”: shaped like the katakana ワ, on top.",
  宀: "“ウ crown”: shaped like the katakana ウ, on top.",
  广: "“マ hanging”: shaped like the katakana マ, hanging over the left.",
  爻: "“Two メ”: like two katakana メ.",
  釆: "“ノ and 米”: like 米 with a ノ on top.",
  攵: "“ノ and 文” (のぶん), or “strike on the right” (ぼくづくり).",
  支: "じゅうまた: “十 and 又”, the two parts it's made of.",
  殳: "“Spear on the right” (ほこつくり); るまた: “ル and 又”, which it looks like.",
  // Squeezed forms of whole kanji.
  "⺅": "“Person side”: 人 squeezed onto the left.",
  "𠆢": "“Person roof”: 人 spread over the top.",
  儿: "“Person legs”: 人 as legs at the bottom.",
  刂: "“Standing sword”: 刀 stood upright on the right.",
  忄: "“Standing heart side”: 心 stood upright on the left.",
  扌: "“Hand side”: 手 squeezed onto the left.",
  氵: "“Three water”: 水 as three drops on the left.",
  冫: "“Two water”: two drops on the left (ice).",
  灬: "“Lined-up fire”: 火 as four dots along the bottom.",
  礻: "“Show side”: 示 squeezed onto the left (it also looks like the kana ネ, hence ねへん).",
  衤: "“Clothes side”: 衣 squeezed onto the left.",
  犭: "“Beast side”, on the left.",
  艹: "“Grass crown”: grass on top.",
  "⺹": "“Old crown”: the top of 老 (old).",
  "⻌": "The “walking” wrap round the bottom left.",
  "⻏": "“Big village”: on the right side.",
  "⻖": "“Little village side”: on the left. The same shape on the right is おおざと.",
  罒: "“Net top” (あみがしら), or “四 top” (よんかしら), since it looks like 四.",
  // Enclosures, hangings and other positions.
  囗: "“Country enclosure”: the frame around 国 (country). Bigger than 口 (mouth), and always wraps around something.",
  冂: "An enclosure open at the bottom.",
  凵: "“Receiving box”: open at the top.",
  勹: "“Wrapping enclosure”, from 包 (wrap).",
  匚: "“Box enclosure”: open on the right.",
  厂: "“Wild-goose hanging”: hangs over the top left.",
  气: "“Steam enclosure”, from 気.",
  弋: "“The enclosure of 式”.",
  疒: "“Sickness hanging”: hangs over the left, as in 病 (illness).",
  廴: "“Stretching wrap”: wraps round the bottom left, as in 延 (stretch).",
  行: "“行 enclosure”: 行 split around something in the middle, as in 街 and 術.",
  亠: "“Pot lid”, on top.",
  夂: "“Winter top”: the top of 冬 (winter).",
  幺: "“Thread top”: the top of 糸 (thread).",
  癶: "“The top of 発”.",
  虍: "“Tiger crown”, as in 虎 (tiger).",
  髟: "“Hair top”, as in 髪 (hair).",
  彑: "“Pig's-head top”.",
  廾: "“Twenty legs”: like 廿 (twenty), at the bottom.",
  舛: "“Dancing legs”: the bottom of 舞 (dance).",
  禸: "“The legs of 禺”.",
  卩: "“Joint, on the right”.",
  聿: "“Brush on the right”, as in 筆 (brush).",
  隶: "“The right side of 隷”.",
  彡: "“Three on the right”: three strokes on the right side.",
  彳: "“行 person side”: the left half of 行 (go), like a doubled にんべん.",
  匕: "“The ひ of さじ (spoon)”.",
  卜: "Named after its two readings, ぼく and と (卜 means divination).",
  戸: "“The と of とびら (door)”.",
  辰: "“The たつ (dragon) of the zodiac”.",
  酉: "“The とり (bird) of the zodiac”; on the left it's とりへん.",
  頁: "“Big shell”: it looks like 貝 (shell) with a lid. Usually on the right.",
  // Named after what they mean.
  川: "“Three-stroke river”.",
  巛: "“Bent river”.",
  工: "“Craftsman”.",
  士: "“Samurai”.",
  巾: "“Width” (of a cloth).",
  尸: "“Corpse”.",
  屮: "“Old grass”.",
  尢: "“大 with a bent leg”.",
  几: "“Desk”.",
  斗: "“Measuring box”.",
  斤: "“Axe”.",
  欠: "“Yawn”.",
  歹: "“Bare-bone side”.",
  毋: "“Do not”.",
  爿: "“Split wood”, on the left.",
  牙: "“Fang side”.",
  皮: "“Fur skin”.",
  禾: "“Grain awn” (the bristle on an ear of grain); on the left it's のぎへん.",
  缶: "“Earthen jar”.",
  耒: "“Plough”.",
  豕: "“Pig”.",
  豸: "“Badger side”.",
  隹: "“Old bird”.",
  韭: "“Leek”.",
  韋: "“Tanned leather”.",
  // Plain kanji, and what they're called where they sit.
  心: "At the bottom it's したごころ (“heart below”); squeezed onto the left it becomes 忄 (りっしんべん).",
  日: "On the left of a kanji it's ひへん (“日 side”), as in 明 and 時.",
  口: "On the left it's くちへん (“mouth side”), as in 味. Not to be confused with the bigger 囗 (くにがまえ).",
  木: "On the left it's きへん (“tree side”), as in 林.",
  王: "On the left it's おうへん, or たまへん (“jewel side”): in 理 and 球 it was once 玉 (jewel).",
  女: "On the left it's おんなへん.",
  糸: "On the left it's いとへん (“thread side”).",
  言: "On the left it's ごんべん, as in 話 and 語.",
  金: "On the left it's かねへん (“metal side”).",
  火: "On the left it's ひへん (“fire side”); along the bottom it becomes 灬 (れっか).",
  土: "On the left it's つちへん (“soil side”).",
  山: "On the left it's やまへん.",
  石: "On the left it's いしへん.",
  目: "On the left it's めへん.",
  田: "On the left it's たへん.",
  足: "On the left it's あしへん.",
  車: "On the left it's くるまへん.",
  馬: "On the left it's うまへん.",
  魚: "On the left it's うおへん.",
  米: "On the left it's こめへん.",
  貝: "On the left it's かいへん.",
  耳: "On the left it's みみへん.",
  舟: "On the left it's ふねへん.",
  弓: "On the left it's ゆみへん.",
  方: "On the left it's ほうへん or かたへん.",
  牛: "On the left it's うしへん.",
  矢: "On the left it's やへん.",
  虫: "On the left it's むしへん.",
  月: "On the left it's つきへん.",
  子: "On the left it's こへん.",
  竹: "On top it's たけかんむり (“bamboo crown”).",
  雨: "On top it's あめかんむり (“rain crown”).",
  穴: "On top it's あなかんむり (“hole crown”).",
  門: "Wrapped around something it's もんがまえ (“gate enclosure”).",
  走: "Wrapping round the bottom left it's そうにょう.",
  水: "Squeezed onto the left it becomes 氵 (さんずい).",
  手: "Squeezed onto the left it becomes 扌 (てへん).",
  人: "Squeezed onto the left it becomes ⺅ (にんべん).",
  刀: "Stood upright on the right it becomes 刂 (りっとう).",
};

/** "ひと.つ" → null (not a plain noun), "かわ" → "かわ". */
function plainKun(kun: string): string | null {
  return kun.includes(".") || kun.startsWith("-") || kun.endsWith("-") ? null : kun;
}

const toHiragana = (katakana: string) => katakana.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/**
 * A component's Japanese name: an override, else KANJIDIC's radical names for
 * the shape shown (at most two), else, for a plain kanji, its everyday reading
 * (a noun kun'yomi, or the first on'yomi in hiragana). null if none fits.
 */
export function japaneseName(display: string, isStandIn: boolean, kanjidic: (character: string) => KanjidicNames | undefined): string | null {
  if (display in NAME_OVERRIDES) return NAME_OVERRIDES[display];
  const entry = kanjidic(display);
  if (entry?.radicalNames.length) return entry.radicalNames.slice(0, 2).join(" / ");
  // A stand-in's own kanji (化 for ⺅) says nothing about the part's name.
  if (isStandIn || !entry) return null;
  const kun = entry.kun.map(plainKun).find((k) => k !== null);
  if (kun) return kun;
  return entry.on[0] ? toHiragana(entry.on[0]) : null;
}
