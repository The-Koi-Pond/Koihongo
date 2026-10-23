// How marked text is matched (Reading): also used by the content build to
// index the SFX dictionary the same way.

export type MarkKind = "speech" | "sfx" | "sign" | "narration" | "other";

const KATAKANA = /[ァ-ヶ]/g;

/**
 * Text written so that the same words match however they're written: width,
 * katakana or hiragana, spaces and punctuation don't matter. SFX are matched
 * more loosely, since they're stretched and repeated freely: ドーン and ドン,
 * ドンッ and ドン, and ゴゴゴゴ and ゴゴゴ all match.
 */
export function textKey(text: string, kind: MarkKind): string {
  let key = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(KATAKANA, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s\p{P}\p{S}]/gu, "");
  if (kind === "sfx") {
    key = key
      .replace(/[ー〜]/g, "")
      .replace(/っ+$/, "")
      // Three or more of the same sound count as two: ゴゴゴゴ = ゴゴゴ = ゴゴ, ドキドキドキ = ドキドキ.
      .replace(/(.+?)\1{2,}/gu, "$1$1");
  }
  return key;
}
