// KRADFILE/RADKFILE write a component with a whole kanji when the component
// shape has no character code of its own (e.g. 化 stands for ⺅). These are
// the 22 stand-ins: each has more strokes than the component it represents.
// Names are our own (WaniKani's are theirs) and can be changed in-app later.
export const STAND_INS: Record<string, { display: string; name: string }> = {
  化: { display: "⺅", name: "person" },
  个: { display: "𠆢", name: "hat" },
  并: { display: "丷", name: "horns" },
  刈: { display: "刂", name: "knife" },
  乞: { display: "𠂉", name: "hook" },
  込: { display: "⻌", name: "road" },
  尚: { display: "⺌", name: "small" },
  忙: { display: "忄", name: "heart" },
  扎: { display: "扌", name: "hand" },
  汁: { display: "氵", name: "water" },
  犯: { display: "犭", name: "beast" },
  艾: { display: "艹", name: "grass" },
  邦: { display: "⻏", name: "village" },
  阡: { display: "⻖", name: "hill" },
  老: { display: "⺹", name: "old" },
  杰: { display: "灬", name: "fire" },
  礼: { display: "礻", name: "spirit" },
  疔: { display: "疒", name: "sickness" },
  禹: { display: "禸", name: "track" },
  初: { display: "衤", name: "clothing" },
  買: { display: "罒", name: "net" },
  滴: { display: "啇", name: "stem" },
};

// Components that aren't kanji, so KANJIDIC has no meaning to borrow.
export const NON_KANJI: Record<string, { display: string; name: string }> = {
  "｜": { display: "丨", name: "stick" },
  ノ: { display: "丿", name: "slide" },
  ハ: { display: "ハ", name: "fins" },
  マ: { display: "マ", name: "ma" },
  ユ: { display: "ユ", name: "yu" },
  ヨ: { display: "ヨ", name: "broom" },
};

// Components whose first KANJIDIC meaning is misleading as a component name
// (彳 "stop", 厂 "wild goose") or too technical.
export const NAME_OVERRIDES: Record<string, string> = {
  亠: "lid",
  冖: "crown",
  宀: "roof",
  冫: "ice",
  厂: "cliff",
  广: "slanted roof",
  厶: "private",
  乙: "second",
  又: "again",
  已: "already",
  彳: "step",
  尤: "especially",
  气: "steam",
  里: "village",
  身: "body",
  酉: "sake jar",
  豸: "badger",
  釆: "distinguish",
  非: "wrong",
  耒: "plow",
  斗: "ladle",
  斉: "even",
  也: "also",
  屮: "sprout",
  巛: "river",
  尢: "lame",
  爿: "split wood",
  癶: "footsteps",
  禾: "grain",
  舛: "opposite",
  廴: "stretch",
  彑: "pig's head",
  隹: "old bird",
};

/** "kettle lid radical (no. 8)" → "kettle lid" */
export function cleanName(meaning: string): string {
  return meaning.replace(/\s*\(no\.\s*\d+\)/, "").replace(/\s+radical\b.*$/, "").trim();
}

/** Display glyph and English name for a KRADFILE component. */
export function describeComponent(
  glyph: string,
  kanjiMeaning: (character: string) => string | undefined,
): { display: string; name: string } {
  const special = STAND_INS[glyph] ?? NON_KANJI[glyph];
  if (special) return special;
  const meaning = kanjiMeaning(glyph);
  return { display: glyph, name: NAME_OVERRIDES[glyph] ?? (meaning ? cleanName(meaning) : glyph) };
}
